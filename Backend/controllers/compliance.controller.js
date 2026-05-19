import { getWazuhToken, axiosInstance } from '../services/wazuhExtended.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load compliance standards from JSON file
const complianceStandardsPath = path.join(__dirname, '../config/compliance-standards.json');
let complianceStandards = {};

try {
  const jsonData = fs.readFileSync(complianceStandardsPath, 'utf-8');
  complianceStandards = JSON.parse(jsonData);
  console.log('✅ Compliance standards loaded from JSON file');
} catch (error) {
  console.error('⚠️ Failed to load compliance standards JSON:', error.message);
  console.error('⚠️ Will use empty standards - all requirements will show with generic descriptions');
}

// Get compliance data
const getCompliance = asyncHandler(async (req, res) => {
  try {

    // Get credentials from client credentials (set by auth middleware)
    const wazuhCreds = req.clientCreds?.wazuhCredentials;

    if (!wazuhCreds) {
      throw new ApiError(400, "Wazuh credentials not found for this client");
    }

    const { host: WAZUH_HOST, username: WAZUH_USER, password: WAZUH_PASS } = wazuhCreds;

    const token = await getWazuhToken(WAZUH_HOST, WAZUH_USER, WAZUH_PASS);

    // Fetch ALL rules with pagination to avoid missing any rules
    let allRules = [];
    let offset = 0;
    const limit = 500; // Wazuh API limit per request
    let totalItems = 0;

    do {
      const response = await axiosInstance.get(`${WAZUH_HOST}/rules`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        params: {
          offset: offset,
          limit: limit,
          sort: '+id'
        }
      });

      const items = response.data?.data?.affected_items || [];
      totalItems = response.data?.data?.total_affected_items || 0;

      allRules = allRules.concat(items);
      offset += limit;

      console.log(`📥 Fetched ${allRules.length}/${totalItems} rules (offset: ${offset - limit})`);

      // Break if no more items
      if (items.length === 0 || allRules.length >= totalItems) {
        break;
      }
    } while (allRules.length < totalItems);

    console.log(`✅ Total rules fetched: ${allRules.length}/${totalItems}`);
    const rules = allRules;

    // Filter only the required fields
    const filtered = rules.map((rule) => ({
      filename: rule.filename,
      id: rule.id,
      level: rule.level,
      status: rule.status,
      pci_dss: rule.pci_dss,
      gpg13: rule.gpg13,
      gdpr: rule.gdpr,
      hipaa: rule.hipaa,
      nist_800_53: rule.nist_800_53,
      tsc: rule.tsc,
      mitre: rule.mitre,
      groups: rule.groups,
      description: rule.description,
    }));

    const complianceData = { compliance: filtered };


    return res.status(200).json(
      new ApiResponse(200, filtered, "Compliance data fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching compliance data:", error.message);
    throw new ApiError(500, error.message || "Failed to fetch compliance data");
  }
});

// Get compliance framework requirements
const getComplianceFramework = asyncHandler(async (req, res) => {
  try {
    const { framework } = req.params;
    const { hours, from, to } = req.query;

    if (!framework) {
      throw new ApiError(400, "Framework parameter is required");
    }

    // Determine time range for Elasticsearch query
    let esTimeRange;
    let timeRangeLabel;

    if (hours) {
      // Relative time range
      const hoursNum = parseInt(hours);
      if (hoursNum === 1) {
        esTimeRange = 'now-1h';
        timeRangeLabel = 'Last Hour';
      } else if (hoursNum === 6) {
        esTimeRange = 'now-6h';
        timeRangeLabel = 'Last 6 Hours';
      } else if (hoursNum === 24) {
        esTimeRange = 'now-1d';
        timeRangeLabel = 'Last 24 Hours';
      } else if (hoursNum === 168) {
        esTimeRange = 'now-7d';
        timeRangeLabel = 'Last 7 Days';
      } else if (hoursNum === 720) {
        esTimeRange = 'now-30d';
        timeRangeLabel = 'Last 30 Days';
      } else if (hoursNum === 2160) {
        esTimeRange = 'now-90d';
        timeRangeLabel = 'Last 90 Days';
      } else if (hoursNum === 0) {
        // All time - no time filter
        esTimeRange = null;
        timeRangeLabel = 'All Time';
      } else {
        esTimeRange = `now-${hoursNum}h`;
        timeRangeLabel = `Last ${hoursNum} Hours`;
      }
    } else if (from && to) {
      // Absolute time range
      esTimeRange = { gte: from, lte: to };
      timeRangeLabel = `${new Date(from).toLocaleDateString()} - ${new Date(to).toLocaleDateString()}`;
    } else {
      // Default to last 7 days if no time parameters provided
      esTimeRange = 'now-7d';
      timeRangeLabel = 'Last 7 Days';
    }

    const supportedFrameworks = ['pci_dss', 'gdpr', 'hipaa', 'nist_800_53', 'tsc', 'gpg13', 'iso27001'];
    if (!supportedFrameworks.includes(framework)) {
      throw new ApiError(400, `Unsupported framework. Supported: ${supportedFrameworks.join(', ')}`);
    }

    // ISO27001 uses NIST mapping - handle separately
    if (framework === 'iso27001') {
      return handleISO27001Compliance(req, res);
    }

    // Caching disabled - fetch fresh data

    // Get credentials from client credentials
    const wazuhCreds = req.clientCreds?.wazuhCredentials;
    if (!wazuhCreds) {
      throw new ApiError(400, "Wazuh credentials not found for this client");
    }

    const { host: WAZUH_HOST, username: WAZUH_USER, password: WAZUH_PASS } = wazuhCreds;
    const { host: INDEXER_HOST, username: INDEXER_USER, password: INDEXER_PASS } = req.clientCreds?.indexerCredentials || {};

    const token = await getWazuhToken(WAZUH_HOST, WAZUH_USER, WAZUH_PASS);

    // Fetch ALL rules with pagination to avoid missing any rules
    console.log(`🔍 Fetching ALL rules for framework: ${framework}`);
    let allRules = [];
    let offset = 0;
    const limit = 500; // Wazuh API limit per request
    let totalItems = 0;

    do {
      const response = await axiosInstance.get(`${WAZUH_HOST}/rules`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        params: {
          offset: offset,
          limit: limit,
          sort: '+id'
        }
      });

      const items = response.data?.data?.affected_items || [];
      totalItems = response.data?.data?.total_affected_items || 0;

      allRules = allRules.concat(items);
      offset += limit;

      console.log(`📥 Fetched ${allRules.length}/${totalItems} rules (offset: ${offset - limit})`);

      // Break if no more items
      if (items.length === 0 || allRules.length >= totalItems) {
        break;
      }
    } while (allRules.length < totalItems);

    console.log(`✅ Total rules fetched: ${allRules.length}/${totalItems}`);
    const rules = allRules;

    // Filter rules that have the specific framework compliance mappings
    const frameworkRules = rules.filter(rule =>
      rule[framework] && Array.isArray(rule[framework]) && rule[framework].length > 0
    );

    console.log(`🎯 Filtered to ${frameworkRules.length} rules with ${framework} compliance mappings`);

    // Transform to requirements format with detailed information
    const requirementsMap = new Map();

    // Step 1: Dynamically discover ALL unique requirement IDs from Wazuh rules
    const discoveredRequirements = new Set();
    frameworkRules.forEach(rule => {
      const frameworkItems = rule[framework] || [];
      frameworkItems.forEach(reqId => discoveredRequirements.add(reqId));
    });

    console.log(`🔍 Discovered ${discoveredRequirements.size} unique requirements from Wazuh rules`);

    // Step 2: Get standards from JSON file
    const frameworkStandards = complianceStandards[framework] || {};
    const jsonRequirements = Object.keys(frameworkStandards);

    console.log(`📚 Found ${jsonRequirements.length} requirements in JSON standards file`);

    // Step 3: Find new requirements not in JSON (for logging/warning)
    const newRequirements = Array.from(discoveredRequirements).filter(
      req => !jsonRequirements.includes(req)
    );

    if (newRequirements.length > 0) {
      console.warn(`⚠️ Found ${newRequirements.length} NEW requirements in Wazuh but not in JSON file:`);
      console.warn(`   ${newRequirements.join(', ')}`);
      console.warn(`   💡 Consider adding these to compliance-standards.json`);
    }

    // Step 4: Only use requirements discovered from Wazuh (has actual rules)
    // This ensures we only show requirements that Wazuh actually supports
    const allRequirementIds = discoveredRequirements;

    console.log(`📋 Total unique requirements to process: ${allRequirementIds.size} (only showing requirements with Wazuh rules)`);

    // Step 5: Create requirements with available data (from JSON or generic)
    allRequirementIds.forEach(requirementId => {
      const details = frameworkStandards[requirementId];

      requirementsMap.set(requirementId, {
        id: requirementId,
        title: `${framework.toUpperCase()} Control ${requirementId}`,
        goals: details?.goals || 'Compliance requirement',
        description: details?.description || `Refer to official ${framework.toUpperCase()} documentation`,
        status: 'compliant',
        severity: 'medium',
        rules: [],
        alertCount: 0,
        ruleCount: 0,
        hasDetails: !!details  // Track if we have full details from JSON
      });
    });

    console.log(`✅ Created ${requirementsMap.size} total requirements in map`);

    // Step 6: Add rule information to requirements
    let totalRuleMappings = 0;
    frameworkRules.forEach(rule => {
      const frameworkItems = rule[framework];

      frameworkItems.forEach(item => {
        if (requirementsMap.has(item)) {
          const requirement = requirementsMap.get(item);
          requirement.rules.push({
            id: rule.id,
            description: rule.description,
            level: rule.level,
            status: rule.status,
            filename: rule.filename
          });
          requirement.ruleCount = requirement.rules.length;
          totalRuleMappings++;
          // Update severity based on rule level if higher
          const ruleSeverity = rule.level >= 10 ? 'high' : rule.level >= 7 ? 'medium' : 'low';
          if (requirement.severity === 'low' || (requirement.severity === 'medium' && ruleSeverity === 'high')) {
            requirement.severity = ruleSeverity;
          }
        }
      });
    });

    const requirementsWithRules = Array.from(requirementsMap.values()).filter(r => r.ruleCount > 0).length;
    const requirementsWithoutRules = Array.from(requirementsMap.values()).filter(r => r.ruleCount === 0).length;
    console.log(`📊 Rule mapping complete:`);
    console.log(`   • ${requirementsWithRules} requirements have Wazuh rules (${totalRuleMappings} total rule mappings)`);
    console.log(`   • ${requirementsWithoutRules} requirements have no Wazuh rules`);

    // Log top 5 requirements with most rules for verification
    const topRequirements = Array.from(requirementsMap.values())
      .sort((a, b) => b.ruleCount - a.ruleCount)
      .slice(0, 5);
    console.log(`🏆 Top 5 requirements by rule count:`);
    topRequirements.forEach(req => {
      console.log(`   • ${req.id}: ${req.ruleCount} rules`);
    });
    
    // console.log(`📊 Updated requirements with rule mappings:`);
    // console.log(`   • ${Array.from(requirementsMap.values()).filter(r => r.ruleCount > 0).length} requirements have Wazuh rules`);
    // console.log(`   • ${Array.from(requirementsMap.values()).filter(r => r.ruleCount === 0).length} requirements have no Wazuh rules (but still displayed)`);

    // Get alert counts from indexer (previous working logic, but for ALL requirements)
    if (INDEXER_HOST && INDEXER_USER && INDEXER_PASS) {
      try {
        // console.log('📊 Fetching alert counts from indexer for all compliance requirements...');
        // console.log(`🔍 Framework: ${framework}, Time Range: ${timeRangeLabel}`);
        // console.log(`🌐 Indexer host: ${INDEXER_HOST}`);

        // Get all rule IDs that have compliance mappings for this framework
        const ruleIds = frameworkRules.map(rule => rule.id);
        // console.log(`📋 Found ${ruleIds.length} rules with ${framework} compliance mappings`);
        // console.log(`🔍 Sample rule IDs:`, ruleIds.slice(0, 5));

        // Method 1: Try to get alerts by compliance framework field directly
        // console.log(`🎯 Method 1: Trying direct compliance field query for ${framework}...`);
        let requirementAlertCounts = {};
        
        try {
          const complianceFieldResponse = await axiosInstance.post(
            `${INDEXER_HOST}/wazuh-alerts-*/_search`,
            {
              query: {
                bool: {
                  must: [
                    { exists: { field: `rule.${framework}` } },
                    ...(esTimeRange ? [{ range: { "@timestamp": typeof esTimeRange === 'string' ? { gte: esTimeRange } : esTimeRange } }] : [])
                  ]
                }
              },
              aggs: {
                compliance_requirements: {
                  terms: {
                    field: `rule.${framework}`,
                    size: 65536  // Maximum Elasticsearch allows - effectively unlimited
                  }
                }
              },
              size: 0
            },
            {
              headers: { 'Content-Type': 'application/json' },
              auth: { username: INDEXER_USER, password: INDEXER_PASS }
            }
          );

          const complianceBuckets = complianceFieldResponse.data?.aggregations?.compliance_requirements?.buckets || [];
          // console.log(`✅ Method 1 success: Found ${complianceBuckets.length} compliance requirements with direct field mapping`);
          
          complianceBuckets.forEach(bucket => {
            requirementAlertCounts[bucket.key] = bucket.doc_count;
          });
          
          // console.log(`📊 Direct compliance alert counts:`, Object.entries(requirementAlertCounts).slice(0, 5));
        } catch (directError) {
          console.warn(`⚠️ Method 1 failed (direct compliance field):`, directError.message);
        }

        // Method 2: Fallback to rule-based approach for comprehensive coverage
        // console.log(`🔄 Method 2: Rule-based approach for comprehensive coverage...`);
        let ruleAlertCounts = {};
        
        try {
          const ruleBasedResponse = await axiosInstance.post(
            `${INDEXER_HOST}/wazuh-alerts-*/_search`,
            {
              query: {
                bool: {
                  must: [
                    { terms: { "rule.id": ruleIds } },
                    ...(esTimeRange ? [{ range: { "@timestamp": typeof esTimeRange === 'string' ? { gte: esTimeRange } : esTimeRange } }] : [])
                  ]
                }
              },
              aggs: {
                rule_alerts: {
                  terms: {
                    field: "rule.id",
                    size: 65536  // Maximum Elasticsearch allows - effectively unlimited
                  }
                }
              },
              size: 0
            },
            {
              headers: { 'Content-Type': 'application/json' },
              auth: { username: INDEXER_USER, password: INDEXER_PASS }
            }
          );

          const ruleBuckets = ruleBasedResponse.data?.aggregations?.rule_alerts?.buckets || [];
          console.log(`✅ Method 2 success: Found ${ruleBuckets.length} rules with alerts`);
          
          ruleBuckets.forEach(bucket => {
            ruleAlertCounts[bucket.key] = bucket.doc_count;
          });
        } catch (ruleError) {
          console.warn(`⚠️ Method 2 failed (rule-based):`, ruleError.message);
        }

        // Update requirements with alert counts ensuring ALL requirements get data
        let totalRequirementsWithAlerts = 0;
        let totalAlertsProcessed = 0;
        
        requirementsMap.forEach(requirement => {
          let totalAlerts = 0;
          
          // First, try direct compliance field data
          if (requirementAlertCounts[requirement.id]) {
            totalAlerts = requirementAlertCounts[requirement.id];
          } else {
            // Fallback to rule-based calculation
            requirement.rules.forEach(rule => {
              const alertCount = ruleAlertCounts[rule.id] || 0;
              
              // Get the original rule to see how many compliance requirements it maps to
              const originalRule = frameworkRules.find(r => r.id === rule.id);
              const requirementIds = originalRule ? originalRule[framework] || [] : [];
              
              // Distribute alerts proportionally across compliance requirements
              const alertsPerRequirement = requirementIds.length > 0 ? alertCount / requirementIds.length : 0;
              totalAlerts += alertsPerRequirement;
            });
          }
          
          requirement.alertCount = Math.round(totalAlerts);
          totalAlertsProcessed += requirement.alertCount;
          
          if (requirement.alertCount > 0) {
            totalRequirementsWithAlerts++;
          }
          
          // Update compliance status based on alert count
          if (totalAlerts > 0) {
            requirement.status = 'non-compliant';
          } else {
            requirement.status = 'compliant';
          }
        });

        console.log(`✅ Alert processing complete: ${totalRequirementsWithAlerts}/${requirementsMap.size} requirements have alerts (${totalAlertsProcessed} total alerts)`);
        
      } catch (alertError) {
        console.error("❌ Could not fetch alert counts from indexer:", alertError.message);
        console.error("❌ Alert error details:", alertError.response?.data || alertError.message);
        
        // Set default values when API fails (no hardcoded counts)
        requirementsMap.forEach(requirement => {
          requirement.alertCount = 0;
          requirement.status = 'compliant';
        });
        
        console.log('⚠️ Using default alert counts (0) due to indexer error');
      }
    } else {
      console.warn('⚠️ No indexer credentials found, using default alert counts (0)');
      requirementsMap.forEach(requirement => {
        requirement.alertCount = 0;
        requirement.status = 'compliant';
      });
    }

    const requirements = Array.from(requirementsMap.values());
    
    const frameworkData = {
      framework: framework,
      timeRange: timeRangeLabel,
      total: requirements.length,
      compliant: requirements.filter(r => r.status === 'compliant').length,
      nonCompliant: requirements.filter(r => r.status === 'non-compliant').length,
      requirements: requirements
    };

    // Caching disabled

    return res.status(200).json(
      new ApiResponse(200, frameworkData, `${framework.toUpperCase()} compliance requirements (${timeRangeLabel}) fetched successfully`)
    );
  } catch (error) {
    console.error(`Error fetching compliance framework ${req.params.framework}:`, error.message);
    throw new ApiError(500, error.message || "Failed to fetch compliance framework data");
  }
});

// Handle ISO27001 compliance (mapped from NIST 800-53)
const handleISO27001Compliance = asyncHandler(async (req, res) => {
  try {
    const { hours, from, to } = req.query;

    // Determine time range for Elasticsearch query
    let esTimeRange;
    let timeRangeLabel;

    if (hours) {
      // Relative time range
      const hoursNum = parseInt(hours);
      if (hoursNum === 1) {
        esTimeRange = 'now-1h';
        timeRangeLabel = 'Last Hour';
      } else if (hoursNum === 6) {
        esTimeRange = 'now-6h';
        timeRangeLabel = 'Last 6 Hours';
      } else if (hoursNum === 24) {
        esTimeRange = 'now-1d';
        timeRangeLabel = 'Last 24 Hours';
      } else if (hoursNum === 168) {
        esTimeRange = 'now-7d';
        timeRangeLabel = 'Last 7 Days';
      } else if (hoursNum === 720) {
        esTimeRange = 'now-30d';
        timeRangeLabel = 'Last 30 Days';
      } else if (hoursNum === 2160) {
        esTimeRange = 'now-90d';
        timeRangeLabel = 'Last 90 Days';
      } else if (hoursNum === 0) {
        // All time - no time filter
        esTimeRange = null;
        timeRangeLabel = 'All Time';
      } else {
        esTimeRange = `now-${hoursNum}h`;
        timeRangeLabel = `Last ${hoursNum} Hours`;
      }
    } else if (from && to) {
      // Absolute time range
      esTimeRange = { gte: from, lte: to };
      timeRangeLabel = `${new Date(from).toLocaleDateString()} - ${new Date(to).toLocaleDateString()}`;
    } else {
      // Default to last 7 days if no time parameters provided
      esTimeRange = 'now-7d';
      timeRangeLabel = 'Last 7 Days';
    }

    console.log(`\n========== ISO27001 COMPLIANCE REQUEST ==========`);
    console.log(`🔍 Fetching ISO27001 compliance data (via NIST 800-53 mapping) for timeRange: ${timeRangeLabel}`);
    console.log(`📋 Organization ID from query: ${req.query.orgId || 'none (using default)'}`);
    console.log(`📋 req.clientCreds exists: ${!!req.clientCreds}`);
    console.log(`📋 req.clientCreds.wazuhCredentials exists: ${!!req.clientCreds?.wazuhCredentials}`);
    if (req.clientCreds?.wazuhCredentials) {
      console.log(`📋 Wazuh host from clientCreds: ${req.clientCreds.wazuhCredentials.host}`);
    }
    console.log(`================================================\n`);

    // Load ISO27001 mapping
    const iso27001MappingPath = path.join(__dirname, '../config/iso27001-mapping.json');
    let iso27001Data;
    try {
      const isoJsonData = fs.readFileSync(iso27001MappingPath, 'utf-8');
      iso27001Data = JSON.parse(isoJsonData).iso27001;
      console.log(`✅ ISO27001 mapping loaded: ${Object.keys(iso27001Data.nist_to_iso_mapping).length} NIST controls mapped`);
    } catch (error) {
      console.error('⚠️ Failed to load ISO27001 mapping JSON:', error.message);
      throw new ApiError(500, 'ISO27001 mapping file not found');
    }

    // Get credentials
    const wazuhCreds = req.clientCreds?.wazuhCredentials;
    if (!wazuhCreds) {
      throw new ApiError(400, "Wazuh credentials not found for this client");
    }

    const { host: WAZUH_HOST, username: WAZUH_USER, password: WAZUH_PASS } = wazuhCreds;
    const { host: INDEXER_HOST, username: INDEXER_USER, password: INDEXER_PASS } = req.clientCreds?.indexerCredentials || {};

    console.log(`🔗 Using Wazuh host: ${WAZUH_HOST}`);
    console.log(`🔗 Using Indexer host: ${INDEXER_HOST || 'none'}`);
    console.log(`👤 Wazuh user: ${WAZUH_USER}`);

    let token;
    try {
      token = await getWazuhToken(WAZUH_HOST, WAZUH_USER, WAZUH_PASS);
    } catch (authError) {
      console.error("❌ Wazuh authentication failed:", authError.message);
      throw new ApiError(500, `Wazuh authentication failed: ${authError.message}`);
    }

    // Fetch ALL NIST 800-53 rules from Wazuh
    console.log(`🔍 Fetching ALL NIST 800-53 rules from Wazuh...`);
    let allRules = [];
    let offset = 0;
    const limit = 500;
    let totalItems = 0;

    do {
      const response = await axiosInstance.get(`${WAZUH_HOST}/rules`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        params: {
          offset: offset,
          limit: limit,
          sort: '+id'
        }
      });

      const items = response.data?.data?.affected_items || [];
      totalItems = response.data?.data?.total_affected_items || 0;
      allRules = allRules.concat(items);
      offset += limit;

      if (items.length === 0 || allRules.length >= totalItems) {
        break;
      }
    } while (allRules.length < totalItems);

    console.log(`✅ Total rules fetched: ${allRules.length}/${totalItems}`);

    // Filter rules that have NIST 800-53 compliance tags
    const nistRules = allRules.filter(rule =>
      rule.nist_800_53 && Array.isArray(rule.nist_800_53) && rule.nist_800_53.length > 0
    );

    console.log(`📋 NIST 800-53 rules found: ${nistRules.length}`);

    // Debug: Show sample NIST tags from rules
    if (nistRules.length > 0) {
      const sampleRule = nistRules[0];
      console.log(`📋 Sample NIST tags from first rule (ID ${sampleRule.id}):`, sampleRule.nist_800_53);
    }

    // Build map of NIST control → alerts count and rules
    const nistControlData = new Map();

    // Initialize all NIST controls from mapping
    Object.keys(iso27001Data.nist_to_iso_mapping).forEach(nistControl => {
      nistControlData.set(nistControl, {
        alertCount: 0,
        ruleCount: 0,
        rules: []
      });
    });

    // Populate NIST control rules
    const unmatchedTags = new Set();
    nistRules.forEach(rule => {
      rule.nist_800_53.forEach(nistTag => {
        // Convert Wazuh format (AC.7) to standard format (AC-7)
        // Then extract base control (e.g., "AC-7" from "AC-7(a)")
        const normalizedTag = nistTag.replace('.', '-');
        const baseControl = normalizedTag.split('(')[0].trim();

        if (nistControlData.has(baseControl)) {
          const data = nistControlData.get(baseControl);
          data.ruleCount++;
          data.rules.push({
            id: rule.id,
            description: rule.description,
            level: rule.level,
            status: rule.status
          });
        } else {
          unmatchedTags.add(baseControl);
        }
      });
    });

    if (unmatchedTags.size > 0) {
      console.log(`⚠️  Unmatched NIST tags (first 10):`, Array.from(unmatchedTags).slice(0, 10));
    }

    console.log(`✅ NIST controls populated: ${nistControlData.size} controls`);

    // Debug: Check how many NIST controls have rules
    let nistWithRules = 0;
    nistControlData.forEach((data, control) => {
      if (data.ruleCount > 0) nistWithRules++;
    });
    console.log(`📋 NIST controls with rules: ${nistWithRules}/${nistControlData.size}`);

    // Fetch alert counts from Elasticsearch/Wazuh Indexer
    if (INDEXER_HOST && INDEXER_USER && INDEXER_PASS) {
      try {
        const esQuery = {
          size: 0,
          query: {
            bool: {
              must: [
                ...(esTimeRange ? [{ range: { '@timestamp': typeof esTimeRange === 'string' ? { gte: esTimeRange, lte: 'now' } : esTimeRange } }] : []),
                { exists: { field: 'rule.nist_800_53' } }
              ]
            }
          },
          aggs: {
            nist_controls: {
              terms: {
                field: 'rule.nist_800_53',
                size: 65536
              }
            }
          }
        };

        const auth = Buffer.from(`${INDEXER_USER}:${INDEXER_PASS}`).toString('base64');
        const esResponse = await axiosInstance.post(
          `${INDEXER_HOST}/wazuh-alerts-*/_search`,
          esQuery,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`
            },
            httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
          }
        );

        const buckets = esResponse.data?.aggregations?.nist_controls?.buckets || [];
        console.log(`📊 Alert aggregation returned ${buckets.length} NIST control buckets`);

        // Map alerts to NIST controls
        buckets.forEach(bucket => {
          const nistTag = bucket.key;
          const alertCount = bucket.doc_count;
          // Convert Wazuh format (AC.7) to standard format (AC-7)
          const normalizedTag = nistTag.replace('.', '-');
          const baseControl = normalizedTag.split('(')[0].trim();

          if (nistControlData.has(baseControl)) {
            const data = nistControlData.get(baseControl);
            data.alertCount += alertCount;
          }
        });

        console.log(`✅ Alert counts mapped to NIST controls`);
      } catch (alertError) {
        console.error("❌ Could not fetch alert counts from indexer:", alertError.message);
      }
    }

    // Now map NIST controls to ISO controls
    const isoControlsMap = new Map();

    // Process each ISO control in the mapping
    const allIsoControls = new Set();
    Object.values(iso27001Data.nist_to_iso_mapping).forEach(isoList => {
      isoList.forEach(iso => allIsoControls.add(iso));
    });

    console.log(`📋 Total unique ISO controls in mapping: ${allIsoControls.size}`);

    // Initialize ISO controls
    allIsoControls.forEach(isoControl => {
      const controlInfo = iso27001Data.controls[isoControl] || {
        title: `ISO 27001:2022 ${isoControl}`,
        description: `Refer to ISO 27001:2022 documentation for ${isoControl}`
      };

      isoControlsMap.set(isoControl, {
        id: isoControl,
        title: controlInfo.title,
        description: controlInfo.description,
        alertCount: 0,
        ruleCount: 0,
        rules: [], // Actual Wazuh rules
        associatedNistControls: [],
        status: 'compliant' // Default to compliant, will change if any NIST control has alerts
      });
    });

    // Map NIST to ISO and aggregate data
    let skippedNistControls = 0;
    for (const [nistControl, isoControlsList] of Object.entries(iso27001Data.nist_to_iso_mapping)) {
      const nistData = nistControlData.get(nistControl);
      if (!nistData) {
        skippedNistControls++;
        continue;
      }

      isoControlsList.forEach(isoControl => {
        if (isoControlsMap.has(isoControl)) {
          const isoData = isoControlsMap.get(isoControl);

          // Sum alerts from this NIST control
          isoData.alertCount += nistData.alertCount;

          // Sum rule counts
          isoData.ruleCount += nistData.ruleCount;

          // Add actual Wazuh rules from this NIST control
          if (nistData.rules && nistData.rules.length > 0) {
            nistData.rules.forEach(rule => {
              // Avoid duplicates
              if (!isoData.rules.some(r => r.id === rule.id)) {
                isoData.rules.push(rule);
              }
            });
          }

          // Track associated NIST controls (for reference)
          isoData.associatedNistControls.push({
            control: nistControl,
            alertCount: nistData.alertCount,
            ruleCount: nistData.ruleCount
          });

          // Determine status: compliant only if ALL associated NIST controls have 0 alerts
          if (nistData.alertCount > 0) {
            isoData.status = 'non-compliant';
          }
        }
      });
    }

    console.log(`✅ NIST-to-ISO mapping complete (skipped ${skippedNistControls} NIST controls with no data)`);
    console.log(`📋 Total ISO controls before filtering: ${isoControlsMap.size}`);

    // Debug: Check how many ISO controls have rules
    let isoWithRules = 0;
    isoControlsMap.forEach((data, control) => {
      if (data.ruleCount > 0) isoWithRules++;
    });
    console.log(`📋 ISO controls with rules (before filter): ${isoWithRules}/${isoControlsMap.size}`);

    // Convert to array and filter out controls with no rules
    const requirements = Array.from(isoControlsMap.values())
      .filter(control => control.ruleCount > 0) // Only show controls with actual Wazuh rules
      .map(control => ({
        id: control.id,
        title: control.title,
        goals: control.title, // For ISO27001, goals is the title
        description: control.description,
        alertCount: control.alertCount,
        ruleCount: control.ruleCount,
        status: control.status,
        rules: control.rules, // Include actual Wazuh rules
        associatedNistControls: control.associatedNistControls
      }));

    console.log(`✅ ISO controls with rules: ${requirements.length}`);

    const frameworkData = {
      framework: 'iso27001',
      timeRange: timeRangeLabel,
      total: requirements.length,
      compliant: requirements.filter(r => r.status === 'compliant').length,
      nonCompliant: requirements.filter(r => r.status === 'non-compliant').length,
      requirements: requirements
    };

    console.log(`📊 ISO27001 Response Summary: Total=${frameworkData.total}, Compliant=${frameworkData.compliant}, Non-Compliant=${frameworkData.nonCompliant}`);
    console.log(`✅ Sending ISO27001 response...`);

    return res.status(200).json(
      new ApiResponse(200, frameworkData, `ISO27001 compliance requirements (${timeRangeLabel}) fetched successfully`)
    );

  } catch (error) {
    console.error(`Error fetching ISO27001 compliance:`, error.message);

    // Return empty data instead of crashing
    const emptyResponse = {
      framework: 'iso27001',
      timeRange: req.query.timeRange || '7d',
      total: 0,
      compliant: 0,
      nonCompliant: 0,
      requirements: []
    };

    return res.status(500).json(
      new ApiResponse(500, emptyResponse, `Failed to fetch ISO27001 compliance data: ${error.message}`)
    );
  }
});

export {
  getCompliance,
  getComplianceFramework
};