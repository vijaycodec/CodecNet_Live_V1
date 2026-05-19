import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { axiosInstance, getWazuhToken } from '../services/wazuhExtended.service.js';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateHtmlReport } from '../templates/reportTemplate.html.js';
import Report from '../models/report.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to calculate days based on frequency
const getFrequencyDays = (frequency) => {
  switch (frequency) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    case 'monthly':
      return 30;
    case 'quarterly':
      return 90;
    default:
      return 7;
  }
};

// Get severity level from numeric value
const getSeverityLevel = (level) => {
  if (level >= 15) return 'critical';
  if (level >= 12) return 'major';
  return 'minor';
};

// Format date
const formatDate = (date, long = false) => {
  if (long) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } else {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  }
};

// Format date and time
const formatDateTime = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
};

// Fetch SCA (Security Configuration Assessment) data from Wazuh
async function fetchSCAData(wazuhHost, token) {
  try {
    console.log('Fetching SCA data from Wazuh...');

    // Get all agents first to fetch SCA data for each
    const agentsResponse = await axiosInstance.get(
      `${wazuhHost}/agents`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      }
    );

    const agents = agentsResponse.data?.data?.affected_items || [];

    if (agents.length === 0) {
      console.log('No agents found for SCA data');
      return {
        overall_score: 0,
        total_checks: 0,
        total_passed: 0,
        total_failed: 0,
        policies: [],
        agents_sca: []
      };
    }

    // Collect SCA data from all agents
    const agentsScaResults = [];
    const scaDataPromises = agents.map(async (agent) => {
      try {
        const scaResponse = await axiosInstance.get(
          `${wazuhHost}/sca/${agent.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json'
            }
          }
        );

        const scaPolicies = scaResponse.data?.data?.affected_items || [];

        // Calculate agent's overall SCA score
        let agentTotalChecks = 0;
        let agentTotalPassed = 0;

        scaPolicies.forEach(policy => {
          const passed = policy.pass || 0;
          const failed = policy.fail || 0;
          agentTotalChecks += (passed + failed);
          agentTotalPassed += passed;
        });

        const agentScore = agentTotalChecks > 0 ? Math.round((agentTotalPassed / agentTotalChecks) * 100) : 0;

        agentsScaResults.push({
          agent_id: agent.id,
          agent_name: agent.name,
          total_checks: agentTotalChecks,
          total_passed: agentTotalPassed,
          total_failed: agentTotalChecks - agentTotalPassed,
          score: agentScore,
          policies_count: scaPolicies.length
        });

        return scaPolicies;
      } catch (err) {
        console.log(`Could not fetch SCA data for agent ${agent.id}:`, err.message);
        return [];
      }
    });

    const allScaData = await Promise.all(scaDataPromises);
    const flatScaData = allScaData.flat();

    if (flatScaData.length === 0) {
      console.log('No SCA policies found');
      return {
        overall_score: 0,
        total_checks: 0,
        total_passed: 0,
        total_failed: 0,
        policies: [],
        agents_sca: agentsScaResults
      };
    }

    // Aggregate SCA data by policy
    const policyMap = new Map();
    let totalChecks = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    flatScaData.forEach(policy => {
      const policyName = policy.name || policy.policy_id || 'Unknown Policy';
      const passed = policy.pass || 0;
      const failed = policy.fail || 0;
      const score = policy.score || 0;
      const total = passed + failed;

      totalChecks += total;
      totalPassed += passed;
      totalFailed += failed;

      if (policyMap.has(policyName)) {
        const existing = policyMap.get(policyName);
        existing.passed += passed;
        existing.failed += failed;
        existing.total += total;
        existing.score = existing.total > 0 ? Math.round((existing.passed / existing.total) * 100) : 0;
      } else {
        policyMap.set(policyName, {
          name: policyName,
          passed,
          failed,
          total,
          score: total > 0 ? Math.round((passed / total) * 100) : 0
        });
      }
    });

    const policies = Array.from(policyMap.values()).sort((a, b) => b.total - a.total);
    const overallScore = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;

    console.log(`SCA data fetched: ${policies.length} policies, ${totalChecks} checks, ${overallScore}% score`);
    console.log(`SCA per agent: ${agentsScaResults.length} agents with SCA data`);

    return {
      overall_score: overallScore,
      total_checks: totalChecks,
      total_passed: totalPassed,
      total_failed: totalFailed,
      policies,
      agents_sca: agentsScaResults.sort((a, b) => b.score - a.score) // Sort by score descending
    };
  } catch (error) {
    console.error('Error fetching SCA data:', error.message);
    return {
      overall_score: 0,
      total_checks: 0,
      total_passed: 0,
      total_failed: 0,
      policies: [],
      agents_sca: []
    };
  }
}

// Generate Report
const generateReport = asyncHandler(async (req, res) => {
  try {
    const { reportName, frequency = 'on-demand', description = '', template = 'executive', start_date, end_date } = req.body;

    // Get credentials from client credentials (set by auth middleware)
    const wazuhCreds = req.clientCreds?.wazuhCredentials;
    const indexerCreds = req.clientCreds?.indexerCredentials;
    const organizationId = req.clientCreds?.organizationId;
    const clientName = req.clientCreds?.clientName || 'Client';
    const organisationName = req.clientCreds?.organisationName || 'Organization';

    if (!wazuhCreds || !indexerCreds) {
      throw new ApiError(400, "Wazuh or Indexer credentials not found for this client");
    }

    const { host: WAZUH_HOST, username: WAZUH_USER, password: WAZUH_PASS } = wazuhCreds;
    const { host: INDEXER_HOST, username: INDEXER_USER, password: INDEXER_PASS } = indexerCreds;
    const authString = `${INDEXER_USER}:${INDEXER_PASS}`;
    const authEncoded = Buffer.from(authString).toString("base64");

    // Calculate time range - use custom dates if provided, otherwise default to last 7 days
    let startDate, endDate;
    if (start_date && end_date) {
      startDate = new Date(start_date);
      endDate = new Date(end_date);
    } else {
      // Default to last 7 days if no dates provided
      endDate = new Date();
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    console.log(`\n========== GENERATING REPORT ==========`);
    console.log(`Organization: ${organisationName}`);
    console.log(`Organization ID: ${organizationId}`);
    console.log(`Client Name: ${clientName}`);
    console.log(`Frequency: ${frequency}`);
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`Wazuh Host: ${WAZUH_HOST}`);
    console.log(`Indexer Host: ${INDEXER_HOST}`);
    console.log(`=======================================\n`);

    // Get Wazuh token first
    const token = await getWazuhToken(WAZUH_HOST, WAZUH_USER, WAZUH_PASS);

    // Fetch alerts from Wazuh Indexer (Level 8 and above only)
    const alertsQuery = {
      size: 10000,
      query: {
        bool: {
          must: [
            {
              range: {
                '@timestamp': {
                  gte: startDate.toISOString(),
                  lte: endDate.toISOString()
                }
              }
            },
            {
              range: {
                'rule.level': {
                  gte: 8
                }
              }
            }
          ]
        }
      },
      sort: [{ '@timestamp': { order: 'desc' } }],
      _source: [
        'rule.level',
        'rule.description',
        'rule.id',
        'rule.groups',
        '@timestamp',
        'predecoder.hostname',
        'agent.name',
        'agent.id',
        'full_log',
        'location',
        'data.srcip'
      ]
    };

    const alertsResponse = await axiosInstance.post(
      `${INDEXER_HOST}/wazuh-alerts*/_search`,
      alertsQuery,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Basic ${authEncoded}`
        }
      }
    );

    const hits = alertsResponse.data.hits?.hits || [];
    const alerts = hits.map(hit => {
      const source = hit._source || {};
      return {
        alert_id: hit._id,
        severity: source.rule?.level,
        alert_description: source.rule?.description || 'Unknown',
        rule_id: source.rule?.id,
        rule_groups: source.rule?.groups || [],
        timestamp: source['@timestamp'],
        host_name: source.predecoder?.hostname,
        agent_name: source.agent?.name || 'Unknown',
        agent_id: source.agent?.id,
        srcip: source.data?.srcip
      };
    });

    console.log(`✅ Fetched ${alerts.length} REAL alerts from Wazuh Indexer for ${organisationName}`);
    if (alerts.length > 0) {
      console.log(`   Sample alert: ${alerts[0].alert_description} (Severity: ${alerts[0].severity}, Time: ${alerts[0].timestamp})`);
    } else {
      console.log(`   ⚠️ No alerts found in the specified time range`);
    }

    // Fetch agents summary from Wazuh
    let agentsData = { total: 0, active: 0, disconnected: 0, never_connected: 0, agents: [] };
    try {
      const agentsResponse = await axiosInstance.get(
        `${WAZUH_HOST}/agents`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          }
        }
      );

      if (agentsResponse.data && agentsResponse.data.data && agentsResponse.data.data.affected_items) {
        const agentsList = agentsResponse.data.data.affected_items;
        agentsData.total = agentsList.length;
        agentsData.active = agentsList.filter(a => a.status === 'active').length;
        agentsData.disconnected = agentsList.filter(a => a.status === 'disconnected').length;
        agentsData.never_connected = agentsList.filter(a => a.status === 'never_connected').length;
        agentsData.agents = agentsList.map(a => ({
          id: a.id,
          name: a.name,
          ip: a.ip,
          status: a.status,
          os: a.os?.name || a.os?.platform || 'Unknown',
          lastKeepAlive: a.lastKeepAlive || null,
          version: a.version || 'Unknown'
        }));
        console.log(`✅ Fetched ${agentsData.total} agents from Wazuh API for ${organisationName}`);
        console.log(`   Active: ${agentsData.active}, Disconnected: ${agentsData.disconnected}, Never Connected: ${agentsData.never_connected}`);
      }
    } catch (err) {
      console.log('❌ Could not fetch agents data:', err.message);
    }

    // Fetch SCA compliance data
    console.log(`Fetching SCA compliance data for ${organisationName}...`);
    const scaData = await fetchSCAData(WAZUH_HOST, token);
    console.log(`✅ SCA Data: Overall Score: ${scaData.overall_score}%, Total Checks: ${scaData.total_checks}, Agents with SCA: ${scaData.agents_sca?.length || 0}`);

    // Calculate statistics
    const severityCounts = { critical: 0, major: 0, minor: 0, total: alerts.length };
    const alertGroups = {};
    const dailyCounts = {};
    const agents = new Set();
    const typeCounts = {};

    alerts.forEach(alert => {
      const level = alert.severity || 0;
      const severity = getSeverityLevel(level);
      severityCounts[severity]++;

      // Group alerts
      const desc = alert.alert_description || 'Unknown';
      if (!alertGroups[desc]) {
        alertGroups[desc] = {
          count: 0,
          description: desc,
          severity: severity,
          hosts: new Set(),
          last_seen: null
        };
      }
      alertGroups[desc].count++;
      alertGroups[desc].hosts.add(alert.agent_name || 'Unknown');

      if (alert.timestamp) {
        const alertTime = new Date(alert.timestamp);
        if (!alertGroups[desc].last_seen || alertTime > alertGroups[desc].last_seen) {
          alertGroups[desc].last_seen = alertTime;
        }

        // Daily trend
        const dateKey = alertTime.toISOString().split('T')[0];
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
      }

      // Agents
      if (alert.agent_name && alert.agent_name !== 'Unknown') {
        agents.add(alert.agent_name);
      }

      // Alert types
      const ruleGroups = alert.rule_groups || [];
      if (Array.isArray(ruleGroups) && ruleGroups.length > 0) {
        const primaryType = ruleGroups[0];
        typeCounts[primaryType] = (typeCounts[primaryType] || 0) + 1;
      }
    });

    // Top alerts
    const topAlerts = Object.values(alertGroups)
      .map(data => ({
        description: data.description,
        severity: data.severity,
        count: data.count,
        host: Array.from(data.hosts)[0] || 'Unknown',
        hosts_affected: data.hosts.size,
        last_seen: data.last_seen ? formatDateTime(data.last_seen) : 'N/A'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Alert types
    const alertTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Daily trend data
    const sortedDates = Object.keys(dailyCounts).sort();
    const last7Days = sortedDates.slice(-7);
    const dailyTrendText = last7Days.map(date => {
      const count = dailyCounts[date];
      const dateObj = new Date(date + 'T00:00:00Z');
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      return `${dayName}: ${count}`;
    }).join(' | ');

    // Severity percentages
    const total = severityCounts.total;
    const severityPercentages = total === 0 ? { critical: 0, major: 0, minor: 0 } : {
      critical: Math.round((severityCounts.critical / total) * 1000) / 10,
      major: Math.round((severityCounts.major / total) * 1000) / 10,
      minor: Math.round((severityCounts.minor / total) * 1000) / 10
    };

    const statistics = {
      severity_counts: severityCounts,
      severity_percentages: severityPercentages,
      top_alerts: topAlerts,
      daily_trend: dailyCounts,
      daily_trend_text: dailyTrendText,
      alert_types: alertTypes,
      agent_summary: {
        total_agents: agentsData.total,
        active_agents: agentsData.active,
        disconnected_agents: agentsData.disconnected,
        never_connected: agentsData.never_connected
      },
      agents_list: agentsData.agents,
      cis_compliance: scaData,
      report_period: {
        start_date: formatDate(startDate, true),
        end_date: formatDate(endDate, true)
      }
    };

    // Generate HTML report
    const htmlReport = generateHtmlReport(clientName, organisationName, statistics, reportName, frequency, template);

    // Generate PDF using Puppeteer
    console.log('Generating PDF...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    const page = await browser.newPage();
    await page.setContent(htmlReport, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });

    await browser.close();
    console.log('PDF generated successfully');

    // Generate time range string for filename
    const formatDateForFilename = (date) => {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };
    const timeRangeStr = `${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}`;

    // Generate filename in format: <orgName>_<reportType>_<timeRange>.pdf
    // SECURITY FIX: Sanitize all path components to prevent path traversal
    const sanitizedOrgName = organisationName.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedTemplate = template.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedOrgId = organizationId.replace(/[^a-zA-Z0-9_-]/g, '');

    // Validate no path traversal attempts
    if (sanitizedOrgId.includes('..') || sanitizedOrgId !== organizationId) {
      throw new ApiError(403, 'Invalid organization ID');
    }

    const filename = `${sanitizedOrgName}_${sanitizedTemplate}_${timeRangeStr}.pdf`;

    // Create organization directory if it doesn't exist
    const storageDir = path.join(__dirname, '..', 'storage', 'reports', sanitizedOrgId);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
      console.log(`Created directory: ${storageDir}`);
    }

    // Save PDF to disk
    const filePath = path.join(storageDir, filename);
    fs.writeFileSync(filePath, pdfBuffer);
    console.log(`PDF saved to: ${filePath}`);

    // Get file size
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;

    // Create database record
    const reportDoc = new Report({
      report_name: reportName || `${template} Report - ${frequency}`,
      description: description || `${template} security report generated ${frequency}`,
      frequency: frequency,
      template: template,
      file_path: filePath,
      file_name: filename,
      file_size: fileSize,
      file_extension: 'pdf',
      organisation_id: organizationId,
      created_by: req.user?._id || req.user?.id,
      recipients: '',
      priority: 'normal',
      report_period_start: startDate,
      report_period_end: endDate,
      metadata: {
        alerts_count: alerts.length,
        severity_counts: severityCounts,
        agents_count: agentsData.total,
        sca_score: scaData.overall_score
      }
    });

    await reportDoc.save();
    console.log(`Report document created in database with ID: ${reportDoc._id}`);

    // Return success response with report details
    return res.status(200).json(
      new ApiResponse(200, {
        report: {
          id: reportDoc._id,
          report_name: reportDoc.report_name,
          description: reportDoc.description,
          frequency: reportDoc.frequency,
          template: reportDoc.template,
          file_name: reportDoc.file_name,
          file_size: reportDoc.file_size,
          file_extension: reportDoc.file_extension,
          report_period_start: reportDoc.report_period_start,
          report_period_end: reportDoc.report_period_end,
          created_at: reportDoc.createdAt,
          metadata: reportDoc.metadata
        }
      }, "Report generated and saved successfully")
    );

  } catch (error) {
    console.error('Report generation error:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to generate report"
      });
    }
  }
});

// Get all reports for an organization
const getAllReports = asyncHandler(async (req, res) => {
  try {
    const organizationId = req.clientCreds?.organizationId;

    if (!organizationId) {
      throw new ApiError(400, "Organization ID not found");
    }

    // Use the Report model's static method to find by organisation
    const reports = await Report.findByOrganisation(organizationId, false);

    // Populate user details
    await Report.populate(reports, [
      { path: 'created_by', select: 'username full_name email' },
      { path: 'updated_by', select: 'username full_name email' }
    ]);

    // Filter reports to only include those whose files exist in the filesystem
    const validReports = [];
    for (const report of reports) {
      // Check if file exists
      if (fs.existsSync(report.file_path)) {
        validReports.push({
          id: report._id,
          report_name: report.report_name,
          description: report.description,
          frequency: report.frequency,
          template: report.template,
          file_name: report.file_name,
          file_size: report.file_size,
          file_extension: report.file_extension,
          priority: report.priority,
          report_period_start: report.report_period_start,
          report_period_end: report.report_period_end,
          created_at: report.createdAt,
          created_by: report.created_by,
          updated_at: report.updatedAt,
          metadata: report.metadata
        });
      } else {
        // Log warning for missing files
        console.warn(`Report file not found: ${report.file_path} (Report ID: ${report._id})`);
      }
    }

    return res.status(200).json(
      new ApiResponse(200, {
        reports: validReports,
        total: validReports.length
      }, "Reports fetched successfully")
    );
  } catch (error) {
    console.error('Error fetching reports:', error.message);
    throw new ApiError(500, error.message || "Failed to fetch reports");
  }
});

// Download a specific report
const downloadReport = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.clientCreds?.organizationId;

    // PATCH 2: Use permission-based checks instead of hardcoded role names
    const permissions = req.user?.role_id?.permissions || {};
    const hasOrgAccessAll = permissions['organisation:access:all'] === true ||
                           permissions.client?.read === true ||
                           permissions.client?.manage === true;
    const hasReportReadAll = permissions['report:read:all'] === true ||
                            permissions.report?.read === true;
    const isInternalUser = req.user?.user_type === "internal";
    const canAccessAllOrgs = hasOrgAccessAll || hasReportReadAll;

    // Internal users with permissions can download from any organization
    // External users need organization validation
    if (!canAccessAllOrgs && !isInternalUser && !organizationId) {
      throw new ApiError(400, "Organization ID not found");
    }

    // Find the report
    const report = await Report.findById(id);

    if (!report) {
      throw new ApiError(404, "Report not found");
    }

    // Check if report belongs to the user's organization
    // Skip check for users with appropriate permissions
    if (!canAccessAllOrgs && !isInternalUser && report.organisation_id.toString() !== organizationId) {
      throw new ApiError(403, "Access denied. Report belongs to a different organization");
    }

    // Check if report is deleted
    if (report.is_deleted) {
      throw new ApiError(410, "Report has been deleted");
    }

    // Check if file exists
    if (!fs.existsSync(report.file_path)) {
      throw new ApiError(404, "Report file not found on server");
    }

    // PATCH 2: Use permission-based access type instead of hardcoded role check
    const accessType = canAccessAllOrgs ? 'Full Access (Internal/Admin)' : isInternalUser ? 'Internal User' : `Organization: ${organizationId}`;
    console.log(`Downloading report: ${report.file_name} (${accessType})`);

    // Set headers and send file using Express's download method
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.file_name}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Use res.download() which properly handles CORS and other Express middleware
    res.download(report.file_path, report.file_name, (err) => {
      if (err) {
        console.error('Error sending file:', err.message);
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            message: "Error sending file"
          });
        }
      } else {
        console.log(`Successfully sent report: ${report.file_name}`);
      }
    });
  } catch (error) {
    console.error('Error downloading report:', error.message);
    if (!res.headersSent) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to download report"
      });
    }
  }
});

// Soft delete a report
const deleteReport = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.clientCreds?.organizationId;
    const userId = req.user?._id || req.user?.id;

    // PATCH 2: Use permission-based checks instead of hardcoded role names
    const permissions = req.user?.role_id?.permissions || {};
    const hasOrgAccessAll = permissions['organisation:access:all'] === true ||
                           permissions.client?.read === true ||
                           permissions.client?.manage === true;
    const hasReportDeleteAll = permissions['report:delete:all'] === true ||
                              permissions.report?.delete === true;
    const isInternalUser = req.user?.user_type === "internal";
    const canAccessAllOrgs = hasOrgAccessAll || hasReportDeleteAll;

    // Internal users with permissions can delete from any organization
    // External users need organization validation
    if (!canAccessAllOrgs && !isInternalUser && !organizationId) {
      throw new ApiError(400, "Organization ID not found");
    }

    if (!userId) {
      throw new ApiError(400, "User ID not found");
    }

    // Find the report
    const report = await Report.findById(id);

    if (!report) {
      throw new ApiError(404, "Report not found");
    }

    // Check if report belongs to the user's organization
    // Skip check for users with appropriate permissions
    if (!canAccessAllOrgs && !isInternalUser && report.organisation_id.toString() !== organizationId) {
      throw new ApiError(403, "Access denied. Report belongs to a different organization");
    }

    // Check if already deleted
    if (report.is_deleted) {
      throw new ApiError(400, "Report is already deleted");
    }

    // Soft delete the report
    await report.softDelete(userId);

    const accessType = canAccessAllOrgs ? 'Privileged User' : isInternalUser ? 'Internal User' : `Organization: ${organizationId}`;
    console.log(`Report deleted: ${report.file_name} by ${accessType}`);

    return res.status(200).json(
      new ApiResponse(200, {
        id: report._id
      }, "Report deleted successfully")
    );
  } catch (error) {
    console.error('Error deleting report:', error.message);
    throw new ApiError(error.statusCode || 500, error.message || "Failed to delete report");
  }
});

// PATCH 43: Secure File Download with Signed URLs (CWE-862)
import { SignedUrlGenerator } from '../utils/signedUrl.util.js';

// Define secure reports directory (outside webroot)
const SECURE_REPORTS_DIR = path.join(__dirname, '..', 'private', 'reports');

/**
 * List static compliance reports with signed download URLs
 * @route GET /api/reports/compliance
 * @access Private (requires reports:read permission)
 */
const listComplianceReports = asyncHandler(async (req, res) => {
  try {
    console.log(`📋 User ${req.user?.email} requesting compliance reports list`);

    // Ensure secure directory exists
    if (!fs.existsSync(SECURE_REPORTS_DIR)) {
      fs.mkdirSync(SECURE_REPORTS_DIR, { recursive: true });
      console.log(`Created secure reports directory: ${SECURE_REPORTS_DIR}`);
    }

    // Read available reports from secure directory
    const files = fs.existsSync(SECURE_REPORTS_DIR) ? fs.readdirSync(SECURE_REPORTS_DIR) : [];
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

    // Generate signed URLs for each report (valid for 5 minutes)
    const reports = pdfFiles.map(filename => {
      const filePath = path.join(SECURE_REPORTS_DIR, filename);
      const stats = fs.statSync(filePath);

      return {
        filename,
        displayName: filename.replace('.pdf', '').replace(/_/g, ' '),
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        modified: stats.mtime,
        downloadUrl: SignedUrlGenerator.generateDownloadUrl(
          filename,
          req.user?.id || req.user?._id,
          5, // 5 minutes expiration
          '/api/reports/download/compliance'
        ),
        expiresIn: 5 // minutes
      };
    });

    console.log(`✅ Generated ${reports.length} signed URLs for user ${req.user?.email}`);

    return res.status(200).json(
      new ApiResponse(200, {
        reports,
        total: reports.length,
        message: reports.length === 0 ? 'No compliance reports available' : undefined
      }, 'Compliance reports retrieved successfully')
    );

  } catch (error) {
    console.error('Error listing compliance reports:', error);
    throw new ApiError(500, 'Failed to list compliance reports');
  }
});

/**
 * Securely download a compliance report using signed token
 * @route GET /api/reports/download/compliance/:filename
 * @access Token-based (no JWT required, signed token provides authorization)
 */
const downloadComplianceReport = asyncHandler(async (req, res) => {
  try {
    const { filename } = req.params;
    const token = SignedUrlGenerator.extractToken(req);

    console.log(`📥 Download request for compliance report: ${filename}`);

    // Validate token
    if (!token) {
      throw new ApiError(401, 'Download token required');
    }

    // Verify and decode token
    let payload;
    try {
      payload = SignedUrlGenerator.verifyToken(token);
    } catch (error) {
      console.warn(`⚠️  Invalid token for ${filename}: ${error.message}`);
      throw new ApiError(401, error.message);
    }

    // Verify filename matches token
    if (payload.filename !== filename) {
      console.warn(`⚠️  Filename mismatch: token=${payload.filename}, request=${filename}`);
      throw new ApiError(403, 'Token does not match requested file');
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    if (sanitizedFilename !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      console.warn(`⚠️  Path traversal attempt: ${filename}`);
      throw new ApiError(403, 'Invalid filename');
    }

    // Only allow PDF files
    if (!sanitizedFilename.toLowerCase().endsWith('.pdf')) {
      throw new ApiError(403, 'Only PDF files are allowed');
    }

    // Build file path
    const filePath = path.join(SECURE_REPORTS_DIR, sanitizedFilename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, 'Report not found');
    }

    // Check if file is within reports directory (prevent directory traversal)
    const realPath = fs.realpathSync(filePath);
    const realReportsDir = fs.realpathSync(SECURE_REPORTS_DIR);
    if (!realPath.startsWith(realReportsDir)) {
      console.error(`🚨 SECURITY: Path traversal attempt blocked: ${filename}`);
      throw new ApiError(403, 'Access denied');
    }

    // Log successful download
    console.log(`✅ Authorized download: ${filename} by user ${payload.userId}`);

    // Get file stats
    const stat = fs.statSync(filePath);

    // Set security headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Stream file to client
    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        throw new ApiError(500, 'Error streaming file');
      }
    });

    fileStream.on('end', () => {
      console.log(`✅ Successfully streamed file: ${filename}`);
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading compliance report:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to download compliance report');
  }
});

/**
 * Helper function to format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export {
  generateReport,
  getAllReports,
  downloadReport,
  deleteReport,
  listComplianceReports,          // PATCH 43
  downloadComplianceReport         // PATCH 43
};
