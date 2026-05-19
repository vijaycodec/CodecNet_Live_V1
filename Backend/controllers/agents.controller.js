import { getWazuhToken, axiosInstance } from '../services/wazuhExtended.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { PasswordUtils } from '../utils/security.util.js';
import User from '../models/user.model.js';

// Get basic agents info only (fast - no SCA/CIS/vulnerabilities)
const getAgentsBasic = asyncHandler(async (req, res) => {
  try {
    // Get credentials from client credentials (set by auth middleware)
    const wazuhCreds = req.clientCreds?.wazuhCredentials;

    if (!wazuhCreds) {
      throw new ApiError(400, "Wazuh credentials not found for this client");
    }

    const { host: WAZUH_HOST, username: WAZUH_USER, password: WAZUH_PASS } = wazuhCreds;
    const token = await getWazuhToken(WAZUH_HOST, WAZUH_USER, WAZUH_PASS);

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const agentsResponse = await axiosInstance.get(`${WAZUH_HOST}/agents`, {
      headers,
    });
    const agents = agentsResponse.data.data?.affected_items || [];

    console.log(`[⚡] Fast response: Basic info for ${agents.length} agents`);

    // Build basic summary
    const summary = {};
    for (const agent of agents) {
      const agentId = agent.id;
      if (agentId === "000") continue; // Skip manager agent

      const os = agent.os || {};
      summary[agentId] = {
        name: agent.name || "Unknown Agent",
        ip: agent.ip,
        os_name: os.name,
        status: agent.status,
        os_version: os.version,
        last_keepalive: agent.lastKeepAlive || "N/A",
        nodename: agent.node_name || "N/A",
      };
    }

    const agentsData = { agents: summary };

    return res.status(200).json(
      new ApiResponse(200, agentsData, "Basic agents info fetched successfully")
    );
  } catch (error) {
    console.error("[✗] Error in getAgentsBasic:", error.message);
    throw new ApiError(500, error.message || "Failed to fetch basic agents info");
  }
});

// Get agents summary (with all data - slower)
const getAgentsSummary = asyncHandler(async (req, res) => {
  try {

    // Get credentials from client credentials (set by auth middleware)
    const wazuhCreds = req.clientCreds?.wazuhCredentials;
    const indexerCreds = req.clientCreds?.indexerCredentials;

    if (!wazuhCreds || !indexerCreds) {
      throw new ApiError(400, "Wazuh or Indexer credentials not found for this client");
    }

    const { host: WAZUH_HOST, username: WAZUH_USER, password: WAZUH_PASS } = wazuhCreds;
    const { host: INDEXER_HOST, username: INDEXER_USER, password: INDEXER_PASS } = indexerCreds;

    const token = await getWazuhToken(WAZUH_HOST, WAZUH_USER, WAZUH_PASS);

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const agentsResponse = await axiosInstance.get(`${WAZUH_HOST}/agents`, {
      headers,
    });
    const agents = agentsResponse.data.data?.affected_items || [];

    console.log(`[⏱️] Step 1: Building basic agent info for ${agents.length} agents...`);
    const startTime = Date.now();

    // Build initial summary with basic agent info
    const summary = {};
    for (const agent of agents) {
      const agentId = agent.id;
      if (agentId === "000") continue; // Skip manager agent

      const os = agent.os || {};
      summary[agentId] = {
        name: agent.name || "Unknown Agent",
        ip: agent.ip,
        os_name: os.name,
        status: agent.status,
        os_version: os.version,
        last_keepalive: agent.lastKeepAlive || "N/A",
        nodename: agent.node_name || "N/A",
      };
    }

    console.log(`[⏱️] Step 2: Fetching SCA info for ${Object.keys(summary).length} agents in parallel...`);

    // STEP 1: Fetch ALL SCA metadata in parallel
    const scaPromises = Object.keys(summary).map(async (agentId) => {
      try {
        const scaMetaResponse = await axiosInstance.get(
          `${WAZUH_HOST}/sca/${agentId}`,
          { headers }
        );
        const scaItem = scaMetaResponse.data.data?.affected_items?.[0];

        if (scaItem?.policy_id) {
          summary[agentId].policy_id = scaItem.policy_id;
          summary[agentId].score = scaItem.score;
          summary[agentId].total_checks = scaItem.total_checks;
          summary[agentId].pass = scaItem.pass;
          summary[agentId].invalid = scaItem.invalid;
          summary[agentId].fail = scaItem.fail;
          summary[agentId].cis_benchmark_name = scaItem.name;
          summary[agentId].cis_scan_date = scaItem.end_scan;
          return { agentId, policyId: scaItem.policy_id };
        }
        return { agentId, policyId: null };
      } catch (err) {
        console.warn(`[!] SCA fetch failed for agent ${agentId}: ${err.message}`);
        return { agentId, policyId: null };
      }
    });

    const scaResults = await Promise.all(scaPromises);
    console.log(`[⏱️] Step 3: Fetching CIS checks sequentially for agents with policies...`);

    // STEP 2: Fetch CIS checks SEQUENTIALLY (one by one) to avoid overwhelming the server
    const agentsWithPolicies = scaResults.filter(result => result.policyId);
    for (const { agentId, policyId } of agentsWithPolicies) {
      try {
        console.log(`  → Fetching CIS checks for agent ${agentId}...`);
        const checksResponse = await axiosInstance.get(
          `${WAZUH_HOST}/sca/${agentId}/checks/${policyId}`,
          { headers }
        );
        const checks = checksResponse.data.data?.affected_items || [];

        summary[agentId].cis_checks = checks.map((check) => ({
          id: check.id,
          command: check.command,
          title: check.title,
          description: check.description,
          result: check.result,
          rationale: check.rationale,
          remediation: check.remediation,
          compliance: check.compliance,
          condition: check.condition,
          rules: check.rules,
        }));
      } catch (err) {
        console.warn(`[!] CIS checks fetch failed for agent ${agentId}: ${err.message}`);
      }
    }

    console.log(`[⏱️] Step 4: Fetching vulnerabilities sequentially for all agents using scroll API with track_total_hits...`);

    // STEP 3: Fetch vulnerabilities SEQUENTIALLY using Scroll API with track_total_hits
    const elasticAuth = Buffer.from(`${INDEXER_USER}:${INDEXER_PASS}`).toString("base64");
    const SCROLL_SIZE = 5000; // Fetch 5000 vulnerabilities per scroll
    const SCROLL_TIMEOUT = '2m'; // Keep scroll context alive for 2 minutes

    for (const agentId of Object.keys(summary)) {
      try {
        console.log(`  → Fetching vulnerabilities for agent ${agentId}...`);

        // First request to get EXACT total count (not capped at 10k)
        const countResponse = await axiosInstance.post(
          `${INDEXER_HOST}/wazuh-states-vulnerabilities-*/_count`,
          {
            query: {
              bool: {
                filter: [
                  { match_phrase: { "agent.id": { query: agentId } } }
                ]
              }
            }
          },
          {
            headers: {
              Authorization: `Basic ${elasticAuth}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const totalVulns = countResponse.data?.count || 0;
        console.log(`    Estimated vulnerabilities for agent ${agentId}: ${totalVulns} (fetching all via scroll)...`);

        // Initialize scroll with track_total_hits
        const scrollInitResponse = await axiosInstance.post(
          `${INDEXER_HOST}/wazuh-states-vulnerabilities-*/_search?scroll=${SCROLL_TIMEOUT}`,
          {
            size: SCROLL_SIZE,
            track_total_hits: true, // Get exact count beyond 10k
            query: {
              bool: {
                filter: [
                  { match_phrase: { "agent.id": { query: agentId } } }
                ]
              }
            }
          },
          {
            headers: {
              Authorization: `Basic ${elasticAuth}`,
              'Content-Type': 'application/json',
            },
          }
        );

        let scrollId = scrollInitResponse.data?._scroll_id;
        let allVulnerabilities = scrollInitResponse.data?.hits?.hits || [];
        let fetchedCount = allVulnerabilities.length;

        if (fetchedCount === 0) {
          summary[agentId].vulnerabilities = [];
          console.log(`    ✅ No vulnerabilities for agent ${agentId}`);
          continue;
        }

        console.log(`    Fetched batch 1 (${fetchedCount} vulnerabilities)...`);

        // Continue scrolling until no more results (ignore count, scroll until empty)
        let batchNum = 2;
        while (scrollId) {
          const scrollResponse = await axiosInstance.post(
            `${INDEXER_HOST}/_search/scroll`,
            {
              scroll: SCROLL_TIMEOUT,
              scroll_id: scrollId
            },
            {
              headers: {
                Authorization: `Basic ${elasticAuth}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const hits = scrollResponse.data?.hits?.hits || [];

          if (hits.length === 0) {
            break; // No more results
          }

          allVulnerabilities.push(...hits);
          fetchedCount += hits.length;
          scrollId = scrollResponse.data?._scroll_id;

          console.log(`    Fetched batch ${batchNum} (${fetchedCount} vulnerabilities)...`);
          batchNum++;
        }

        // Clear scroll context
        if (scrollId) {
          try {
            await axiosInstance.delete(
              `${INDEXER_HOST}/_search/scroll`,
              {
                data: { scroll_id: scrollId },
                headers: {
                  Authorization: `Basic ${elasticAuth}`,
                  'Content-Type': 'application/json',
                },
              }
            );
          } catch (clearErr) {
            // Ignore scroll clear errors
          }
        }

        console.log(`    ✅ Aggregated ${allVulnerabilities.length} vulnerabilities for agent ${agentId}`);

        summary[agentId].vulnerabilities = allVulnerabilities.map((hit) => {
          const source = hit._source || {};
          return {
            name: source.package?.name,
            id: source.vulnerability?.id,
            severity: source.vulnerability?.severity,
            description: source.vulnerability?.description,
            reference: source.vulnerability?.reference,
            cvss: source.vulnerability?.cvss,
            published: source.vulnerability?.published,
            updated: source.vulnerability?.updated,
          };
        });
      } catch (err) {
        console.warn(`[!] Vulnerability fetch failed for agent ${agentId}: ${err.message}`);
        summary[agentId].vulnerabilities = [];
      }
    }

    const endTime = Date.now();
    console.log(`[✅] Fetched complete data for ${Object.keys(summary).length} agents in ${endTime - startTime}ms`);

    const agentsData = { agents: summary };


    return res.status(200).json(
      new ApiResponse(200, agentsData, "Agents summary fetched successfully")
    );
  } catch (error) {
    console.error("[✗] Error in getAgentsSummary:", error.message);
    throw new ApiError(500, error.message || "Failed to fetch agents summary");
  }
});

// Quarantine/Unquarantine agent
const quarantineAgent = asyncHandler(async (req, res) => {
  try {
    const { agentId, action, agentOS, whitelistIPs, password } = req.body;

    // Validate required fields
    if (!agentId || !action) {
      throw new ApiError(400, 'Missing required fields: agentId, action');
    }

    // Validate action
    if (!['isolate', 'release'].includes(action)) {
      throw new ApiError(400, 'Invalid action. Must be "isolate" or "release"');
    }

    // Verify user is authenticated
    if (!req.user || !req.user.id) {
      throw new ApiError(401, 'Authentication required. Please login first.');
    }

    // Get user with role information
    const user = await User.findById(req.user.id).populate('role_id');

    if (!user || !user.role_id) {
      throw new ApiError(403, 'User role not found');
    }

    // SECURITY: Permission-based validation instead of hardcoded role check
    const hasPermission = user.role_id.permissions &&
      (user.role_id.permissions['agents']?.['quarantine'] === true ||
       user.role_id.permissions['agents']?.['manage'] === true);

    if (!hasPermission) {
      throw new ApiError(403, 'You do not have permission to quarantine agents. Required permissions: agents:quarantine or agents:manage');
    }

    // SECURITY: Validate password against any privileged user for critical quarantine operation
    // PATCH 2: Use permission-based lookup instead of hardcoded role name
    if (!password) {
      throw new ApiError(400, 'Password is required for quarantine operations');
    }

    // Find all users with quarantine approval permissions
    const allUsers = await User.find({
      status: 'active',
      is_deleted: false
    })
    .populate('role_id')
    .select('+password_hash');

    // Filter users who have quarantine approval permissions
    const privilegedUsers = allUsers.filter(u => {
      if (!u.role_id || !u.role_id.permissions) return false;
      const perms = u.role_id.permissions;
      return perms['agents']?.['quarantine'] === true ||
             perms['agents']?.['manage'] === true ||
             perms['agents']?.['*'] === true;
    });

    if (privilegedUsers.length === 0) {
      throw new ApiError(500, 'No users with quarantine approval permissions found');
    }

    // Check password against all privileged users
    let isPasswordValid = false;
    for (const admin of privilegedUsers) {
      const passwordMatch = await PasswordUtils.comparePassword(password, admin.password_hash);
      if (passwordMatch) {
        isPasswordValid = true;
        break;
      }
    }

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid password. Please verify your privileged user password and try again.');
    }

    // Get credentials from client credentials (set by auth middleware)
    const wazuhCreds = req.clientCreds?.wazuhCredentials;

    if (!wazuhCreds) {
      throw new ApiError(400, "Wazuh credentials not found for this client");
    }

    const { host: WAZUH_HOST, username: WAZUH_USER, password: WAZUH_PASS } = wazuhCreds;
    const token = await getWazuhToken(WAZUH_HOST, WAZUH_USER, WAZUH_PASS);

    // Determine command based on agent OS
    let command;
    if (agentOS && agentOS.toLowerCase().includes('windows')) {
      command = "!isolation.exe";
    } else {
      // Default to Linux/Unix for all non-Windows systems
      command = "!ar-test.sh";
    }

    // Extract Wazuh manager IP from client credentials
    const wazuhManagerIP = WAZUH_HOST ? WAZUH_HOST.replace(/^https?:\/\//, '').split(':')[0] : 'localhost';
    
    // Always include Wazuh manager IP + any additional user-provided IPs
    let argumentIPs = [wazuhManagerIP]; // Always start with Wazuh manager IP
    
    if (whitelistIPs && Array.isArray(whitelistIPs)) {
      // Filter out empty strings and add valid IPs
      const validUserIPs = whitelistIPs.filter(ip => ip && ip.trim() !== '');
      // Combine Wazuh manager IP with user IPs (remove duplicates)
      const combinedIPs = [...new Set([wazuhManagerIP, ...validUserIPs])];
      argumentIPs = combinedIPs;
    }

    let argument = ["one", "two"];

    // Prepare request data
    const requestData = {
      command: command,
      arguments: argument,
      alert: {
        data: {
          action: action, // 'isolate' or 'release'
          user: "admin",
          debug: true
        }
      }
    };


    const response = await axiosInstance.put(
      `${WAZUH_HOST}/active-response?agents_list=${agentId}`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Store quarantine state in cache
    const quarantineKey = `quarantine_${agentId}`;
    // Cache disabled - quarantine status stored in memory only during request

    return res.status(200).json(
      new ApiResponse(200, {
        success: true,
        data: response.data,
        message: `Agent ${agentId} ${action === 'isolate' ? 'quarantined' : 'released'} successfully`
      }, `Agent ${action === 'isolate' ? 'quarantined' : 'released'} successfully`)
    );

  } catch (error) {
    console.error('Quarantine error:', error.message);
    throw new ApiError(500, error.message || 'Quarantine operation failed');
  }
});

// Get quarantine status
const getQuarantineStatus = asyncHandler(async (req, res) => {
  try {
    const { agentId } = req.params;

    // Since caching is disabled, return default active status
    return res.status(200).json(
      new ApiResponse(200, {
        agentId,
        status: 'active',
        timestamp: null
      }, 'Quarantine status fetched successfully (cache disabled)')
    );
  } catch (error) {
    console.error('Quarantine status error:', error.message);
    throw new ApiError(500, error.message || 'Failed to fetch quarantine status');
  }
});

// Get agents with streaming updates (SSE - Server-Sent Events)
const getAgentsStream = asyncHandler(async (req, res) => {
  try {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get credentials from client credentials (set by auth middleware)
    const wazuhCreds = req.clientCreds?.wazuhCredentials;
    const indexerCreds = req.clientCreds?.indexerCredentials;

    if (!wazuhCreds || !indexerCreds) {
      res.write(`data: ${JSON.stringify({ error: "Wazuh or Indexer credentials not found" })}\n\n`);
      res.end();
      return;
    }

    const { host: WAZUH_HOST, username: WAZUH_USER, password: WAZUH_PASS } = wazuhCreds;
    const { host: INDEXER_HOST, username: INDEXER_USER, password: INDEXER_PASS } = indexerCreds;

    const token = await getWazuhToken(WAZUH_HOST, WAZUH_USER, WAZUH_PASS);
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    console.log(`[⚡ SSE] Starting agent stream...`);

    // Step 1: Get basic agent info
    const agentsResponse = await axiosInstance.get(`${WAZUH_HOST}/agents`, { headers });
    const agents = agentsResponse.data.data?.affected_items || [];

    const summary = {};
    for (const agent of agents) {
      const agentId = agent.id;
      if (agentId === "000") continue;

      const os = agent.os || {};
      summary[agentId] = {
        name: agent.name || "Unknown Agent",
        ip: agent.ip,
        os_name: os.name,
        status: agent.status,
        os_version: os.version,
        last_keepalive: agent.lastKeepAlive || "N/A",
        nodename: agent.node_name || "N/A",
      };
    }

    // Send basic info immediately
    res.write(`data: ${JSON.stringify({ type: 'basic', agents: summary })}\n\n`);
    console.log(`[⚡ SSE] Sent basic info for ${Object.keys(summary).length} agents`);

    // Step 2: Fetch SCA for all agents in parallel
    const scaPromises = Object.keys(summary).map(async (agentId) => {
      try {
        const scaMetaResponse = await axiosInstance.get(`${WAZUH_HOST}/sca/${agentId}`, { headers });
        const scaItem = scaMetaResponse.data.data?.affected_items?.[0];

        if (scaItem?.policy_id) {
          summary[agentId].policy_id = scaItem.policy_id;
          summary[agentId].score = scaItem.score;
          summary[agentId].total_checks = scaItem.total_checks;
          summary[agentId].pass = scaItem.pass;
          summary[agentId].invalid = scaItem.invalid;
          summary[agentId].fail = scaItem.fail;
          summary[agentId].cis_benchmark_name = scaItem.name;
          summary[agentId].cis_scan_date = scaItem.end_scan;
          return { agentId, policyId: scaItem.policy_id };
        }
        return { agentId, policyId: null };
      } catch (err) {
        console.warn(`[!] SCA fetch failed for agent ${agentId}: ${err.message}`);
        return { agentId, policyId: null };
      }
    });

    await Promise.all(scaPromises);

    // Send SCA updates
    res.write(`data: ${JSON.stringify({ type: 'sca', agents: summary })}\n\n`);
    console.log(`[⚡ SSE] Sent SCA info`);

    // Step 3: Fetch CIS checks sequentially and stream each one
    const scaResults = Object.entries(summary)
      .map(([agentId, data]) => ({ agentId, policyId: data.policy_id }))
      .filter(r => r.policyId);

    for (const { agentId, policyId } of scaResults) {
      try {
        const checksResponse = await axiosInstance.get(
          `${WAZUH_HOST}/sca/${agentId}/checks/${policyId}`,
          { headers }
        );
        const checks = checksResponse.data.data?.affected_items || [];

        summary[agentId].cis_checks = checks.map((check) => ({
          id: check.id,
          command: check.command,
          title: check.title,
          description: check.description,
          result: check.result,
          rationale: check.rationale,
          remediation: check.remediation,
          compliance: check.compliance,
          condition: check.condition,
          rules: check.rules,
        }));

        // Stream CIS update for this agent
        res.write(`data: ${JSON.stringify({ type: 'cis', agentId, agent: summary[agentId] })}\n\n`);
        console.log(`[⚡ SSE] Sent CIS checks for agent ${agentId}`);
      } catch (err) {
        console.warn(`[!] CIS checks fetch failed for agent ${agentId}: ${err.message}`);
      }
    }

    // Step 4: Fetch vulnerabilities sequentially and stream each one
    const elasticAuth = Buffer.from(`${INDEXER_USER}:${INDEXER_PASS}`).toString("base64");
    const SCROLL_SIZE = 5000;
    const SCROLL_TIMEOUT = '2m';

    for (const agentId of Object.keys(summary)) {
      try {
        // Get count
        const countResponse = await axiosInstance.post(
          `${INDEXER_HOST}/wazuh-states-vulnerabilities-*/_count`,
          { query: { bool: { filter: [{ match_phrase: { "agent.id": { query: agentId } } }] } } },
          { headers: { Authorization: `Basic ${elasticAuth}`, 'Content-Type': 'application/json' } }
        );

        const totalVulns = countResponse.data?.count || 0;

        // Initialize scroll
        const scrollInitResponse = await axiosInstance.post(
          `${INDEXER_HOST}/wazuh-states-vulnerabilities-*/_search?scroll=${SCROLL_TIMEOUT}`,
          {
            size: SCROLL_SIZE,
            track_total_hits: true,
            query: { bool: { filter: [{ match_phrase: { "agent.id": { query: agentId } } }] } }
          },
          { headers: { Authorization: `Basic ${elasticAuth}`, 'Content-Type': 'application/json' } }
        );

        let scrollId = scrollInitResponse.data?._scroll_id;
        let allVulnerabilities = scrollInitResponse.data?.hits?.hits || [];

        if (allVulnerabilities.length === 0) {
          summary[agentId].vulnerabilities = [];
          res.write(`data: ${JSON.stringify({ type: 'vulnerabilities', agentId, agent: summary[agentId] })}\n\n`);
          console.log(`[⚡ SSE] Sent 0 vulnerabilities for agent ${agentId}`);
          continue;
        }

        // Continue scrolling
        while (scrollId) {
          const scrollResponse = await axiosInstance.post(
            `${INDEXER_HOST}/_search/scroll`,
            { scroll: SCROLL_TIMEOUT, scroll_id: scrollId },
            { headers: { Authorization: `Basic ${elasticAuth}`, 'Content-Type': 'application/json' } }
          );

          const hits = scrollResponse.data?.hits?.hits || [];
          if (hits.length === 0) break;

          allVulnerabilities.push(...hits);
          scrollId = scrollResponse.data?._scroll_id;
        }

        // Clear scroll
        if (scrollId) {
          try {
            await axiosInstance.delete(`${INDEXER_HOST}/_search/scroll`, {
              data: { scroll_id: scrollId },
              headers: { Authorization: `Basic ${elasticAuth}`, 'Content-Type': 'application/json' }
            });
          } catch (clearErr) {}
        }

        summary[agentId].vulnerabilities = allVulnerabilities.map((hit) => {
          const source = hit._source || {};
          return {
            name: source.package?.name,
            id: source.vulnerability?.id,
            severity: source.vulnerability?.severity,
            description: source.vulnerability?.description,
            reference: source.vulnerability?.reference,
            cvss: source.vulnerability?.cvss,
            published: source.vulnerability?.published,
            updated: source.vulnerability?.updated,
          };
        });

        // Stream vulnerability update for this agent
        res.write(`data: ${JSON.stringify({ type: 'vulnerabilities', agentId, agent: summary[agentId] })}\n\n`);
        console.log(`[⚡ SSE] Sent ${allVulnerabilities.length} vulnerabilities for agent ${agentId}`);
      } catch (err) {
        console.warn(`[!] Vulnerability fetch failed for agent ${agentId}: ${err.message}`);
        summary[agentId].vulnerabilities = [];
        // Still send the update even if it failed (empty vulnerabilities)
        res.write(`data: ${JSON.stringify({ type: 'vulnerabilities', agentId, agent: summary[agentId] })}\n\n`);
        console.log(`[⚡ SSE] Sent 0 vulnerabilities for agent ${agentId} (error)`);
      }
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    console.log(`[⚡ SSE] Stream complete`);
    res.end();

  } catch (error) {
    console.error("[✗] Error in getAgentsStream:", error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

export {
  getAgentsBasic,
  getAgentsSummary,
  getAgentsStream,
  quarantineAgent,
  getQuarantineStatus
};