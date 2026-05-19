import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import axios from 'axios';
import https from 'https';

// Axios instance with SSL verification disabled
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
});

/**
 * Get Wazuh authentication token
 */
async function getWazuhToken(wazuhHost, wazuhUser, wazuhPass) {
  const authString = `${wazuhUser}:${wazuhPass}`;
  const authEncoded = Buffer.from(authString).toString("base64");

  const response = await axiosInstance.post(
    `${wazuhHost}/security/user/authenticate`,
    {},
    {
      headers: {
        Authorization: `Basic ${authEncoded}`,
        Accept: "application/json",
      },
    }
  );

  if (response.data.error !== 0 || !response.data.data?.token) {
    throw new ApiError(401, "Wazuh authentication failed");
  }

  return response.data.data.token;
}

/**
 * GET /mitre/groups
 * Get MITRE ATT&CK Groups
 */
export const getMitreGroups = asyncHandler(async (req, res) => {
  const { offset = 0, limit = 500, sort = '+name', search } = req.query;

  const wazuhCreds = req.clientCreds?.wazuhCredentials;
  if (!wazuhCreds) {
    throw new ApiError(400, "Wazuh credentials not found");
  }

  const token = await getWazuhToken(wazuhCreds.host, wazuhCreds.username, wazuhCreds.password);

  const params = { offset, limit, sort };
  if (search) params.search = search;

  const response = await axiosInstance.get(
    `${wazuhCreds.host}/mitre/groups`,
    {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  res.status(200).json(
    new ApiResponse(200, response.data.data, "MITRE groups fetched successfully")
  );
});

/**
 * GET /mitre/mitigations
 * Get MITRE ATT&CK Mitigations
 */
export const getMitreMitigations = asyncHandler(async (req, res) => {
  const { offset = 0, limit = 500, sort = '+name', search } = req.query;

  const wazuhCreds = req.clientCreds?.wazuhCredentials;
  if (!wazuhCreds) {
    throw new ApiError(400, "Wazuh credentials not found");
  }

  const token = await getWazuhToken(wazuhCreds.host, wazuhCreds.username, wazuhCreds.password);

  const params = { offset, limit, sort };
  if (search) params.search = search;

  const response = await axiosInstance.get(
    `${wazuhCreds.host}/mitre/mitigations`,
    {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  res.status(200).json(
    new ApiResponse(200, response.data.data, "MITRE mitigations fetched successfully")
  );
});

/**
 * GET /mitre/software
 * Get MITRE ATT&CK Software
 */
export const getMitreSoftware = asyncHandler(async (req, res) => {
  const { offset = 0, limit = 500, sort = '+name', search } = req.query;

  const wazuhCreds = req.clientCreds?.wazuhCredentials;
  if (!wazuhCreds) {
    throw new ApiError(400, "Wazuh credentials not found");
  }

  const token = await getWazuhToken(wazuhCreds.host, wazuhCreds.username, wazuhCreds.password);

  const params = { offset, limit, sort };
  if (search) params.search = search;

  const response = await axiosInstance.get(
    `${wazuhCreds.host}/mitre/software`,
    {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  res.status(200).json(
    new ApiResponse(200, response.data.data, "MITRE software fetched successfully")
  );
});

/**
 * GET /mitre/tactics
 * Get MITRE ATT&CK Tactics
 */
export const getMitreTactics = asyncHandler(async (req, res) => {
  const { offset = 0, limit = 100, sort = '+name' } = req.query;

  const wazuhCreds = req.clientCreds?.wazuhCredentials;
  if (!wazuhCreds) {
    throw new ApiError(400, "Wazuh credentials not found");
  }

  const token = await getWazuhToken(wazuhCreds.host, wazuhCreds.username, wazuhCreds.password);

  const response = await axiosInstance.get(
    `${wazuhCreds.host}/mitre/tactics`,
    {
      params: { offset, limit, sort },
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  res.status(200).json(
    new ApiResponse(200, response.data.data, "MITRE tactics fetched successfully")
  );
});

/**
 * GET /mitre/techniques
 * Get MITRE ATT&CK Techniques
 */
export const getMitreTechniques = asyncHandler(async (req, res) => {
  const { offset = 0, limit = 1000, sort = '+name', search } = req.query;

  const wazuhCreds = req.clientCreds?.wazuhCredentials;
  if (!wazuhCreds) {
    throw new ApiError(400, "Wazuh credentials not found");
  }

  const token = await getWazuhToken(wazuhCreds.host, wazuhCreds.username, wazuhCreds.password);

  const params = { offset, limit, sort };
  if (search) params.search = search;

  const response = await axiosInstance.get(
    `${wazuhCreds.host}/mitre/techniques`,
    {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  res.status(200).json(
    new ApiResponse(200, response.data.data, "MITRE techniques fetched successfully")
  );
});

/**
 * GET /mitre/coverage
 * Analyze MITRE ATT&CK coverage based on alerts
 */
export const getMitreCoverage = asyncHandler(async (req, res) => {
  const { hours = 168 } = req.query; // Default 7 days

  const wazuhCreds = req.clientCreds?.wazuhCredentials;
  const indexerCreds = req.clientCreds?.indexerCredentials;

  if (!indexerCreds) {
    throw new ApiError(400, "Indexer credentials not found");
  }

  const auth = Buffer.from(`${indexerCreds.username}:${indexerCreds.password}`).toString('base64');

  // Fetch recent alerts with MITRE mapping (rule level 8 and above)
  const response = await axiosInstance.post(
    `${indexerCreds.host}/wazuh-alerts-*/_search`,
    {
      size: 10000,
      query: {
        bool: {
          must: [
            {
              range: {
                '@timestamp': {
                  gte: `now-${hours}h`,
                  lte: 'now'
                }
              }
            },
            {
              exists: {
                field: 'rule.mitre'
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
      _source: ['rule.mitre', 'rule.id', 'rule.description', 'rule.level', '@timestamp', 'agent.name', 'agent.id']
    },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const hits = response.data.hits?.hits || [];

  // Analyze coverage
  const tacticsCoverage = {};
  const techniquesCoverage = {};
  const techniqueDetails = {};
  const timeline = {};

  hits.forEach(hit => {
    const alert = hit._source;
    const mitre = alert.rule?.mitre;

    if (!mitre) return;

    // Extract tactics
    const tactics = Array.isArray(mitre.tactic) ? mitre.tactic : [mitre.tactic];
    tactics.forEach(tactic => {
      if (tactic) {
        tacticsCoverage[tactic] = (tacticsCoverage[tactic] || 0) + 1;
      }
    });

    // Extract techniques
    const techniques = Array.isArray(mitre.technique) ? mitre.technique : [mitre.technique];
    const ids = Array.isArray(mitre.id) ? mitre.id : [mitre.id];

    techniques.forEach((technique, index) => {
      if (technique) {
        const techniqueId = ids[index] || 'unknown';
        techniquesCoverage[techniqueId] = (techniquesCoverage[techniqueId] || 0) + 1;

        if (!techniqueDetails[techniqueId]) {
          techniqueDetails[techniqueId] = {
            id: techniqueId,
            name: technique,
            count: 0,
            tactics: new Set(tactics.filter(t => t)),
            alerts: []
          };
        }

        techniqueDetails[techniqueId].count++;
        techniqueDetails[techniqueId].alerts.push({
          ruleId: alert.rule.id,
          description: alert.rule.description,
          timestamp: alert['@timestamp'],
          agent: alert.agent?.name
        });
      }
    });

    // Timeline aggregation (by day)
    const date = new Date(alert['@timestamp']).toISOString().split('T')[0];
    if (!timeline[date]) {
      timeline[date] = { date, count: 0, techniques: new Set() };
    }
    timeline[date].count++;
    ids.forEach(id => timeline[date].techniques.add(id));
  });

  // Convert to arrays for frontend
  const tacticsArray = Object.entries(tacticsCoverage).map(([tactic, count]) => ({
    tactic,
    count,
    percentage: ((count / hits.length) * 100).toFixed(2)
  })).sort((a, b) => b.count - a.count);

  const techniquesArray = Object.values(techniqueDetails).map(t => ({
    ...t,
    tactics: Array.from(t.tactics),
    alerts: t.alerts.slice(0, 10) // Limit to 10 recent alerts per technique
  })).sort((a, b) => b.count - a.count);

  const timelineArray = Object.values(timeline).map(t => ({
    date: t.date,
    count: t.count,
    uniqueTechniques: t.techniques.size
  })).sort((a, b) => a.date.localeCompare(b.date));

  res.status(200).json(
    new ApiResponse(200, {
      summary: {
        totalAlerts: hits.length,
        totalTactics: Object.keys(tacticsCoverage).length,
        totalTechniques: Object.keys(techniquesCoverage).length,
        timeRange: `${hours} hours`,
        coverage: {
          tactics: tacticsArray,
          techniques: techniquesArray.slice(0, 50), // Top 50 techniques
          timeline: timelineArray
        }
      }
    }, "MITRE coverage analyzed successfully")
  );
});

/**
 * GET /mitre/statistics
 * Get overall MITRE ATT&CK statistics
 */
export const getMitreStatistics = asyncHandler(async (req, res) => {
  const wazuhCreds = req.clientCreds?.wazuhCredentials;
  if (!wazuhCreds) {
    throw new ApiError(400, "Wazuh credentials not found");
  }

  const token = await getWazuhToken(wazuhCreds.host, wazuhCreds.username, wazuhCreds.password);

  // Fetch counts from all endpoints
  const [groupsRes, mitigationsRes, softwareRes, tacticsRes, techniquesRes] = await Promise.all([
    axiosInstance.get(`${wazuhCreds.host}/mitre/groups`, {
      params: { limit: 1 },
      headers: { Authorization: `Bearer ${token}` }
    }),
    axiosInstance.get(`${wazuhCreds.host}/mitre/mitigations`, {
      params: { limit: 1 },
      headers: { Authorization: `Bearer ${token}` }
    }),
    axiosInstance.get(`${wazuhCreds.host}/mitre/software`, {
      params: { limit: 1 },
      headers: { Authorization: `Bearer ${token}` }
    }),
    axiosInstance.get(`${wazuhCreds.host}/mitre/tactics`, {
      params: { limit: 1 },
      headers: { Authorization: `Bearer ${token}` }
    }),
    axiosInstance.get(`${wazuhCreds.host}/mitre/techniques`, {
      params: { limit: 1 },
      headers: { Authorization: `Bearer ${token}` }
    })
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      groups: groupsRes.data.data.total_affected_items || 0,
      mitigations: mitigationsRes.data.data.total_affected_items || 0,
      software: softwareRes.data.data.total_affected_items || 0,
      tactics: tacticsRes.data.data.total_affected_items || 0,
      techniques: techniquesRes.data.data.total_affected_items || 0,
    }, "MITRE statistics fetched successfully")
  );
});
