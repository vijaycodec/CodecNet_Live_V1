import axiosInstance from "../config/axiosConfig.js";

// No caching - fetch fresh data every time

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableErrors: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'timeout', '500', '502', '503', '504']
};

// Retry wrapper function
async function withRetry(operation, context = 'operation') {
  let lastError;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error;
      const isRetryable = RETRY_CONFIG.retryableErrors.some(errorType =>
        error.message.includes(errorType) ||
        error.code === errorType ||
        (error.response && RETRY_CONFIG.retryableErrors.includes(error.response.status?.toString()))
      );

      if (!isRetryable || attempt === RETRY_CONFIG.maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export const getWazuhToken = async (wazuhCredentials) => {
  const { host, username, password } = wazuhCredentials;

  console.log(`[i] Getting fresh Wazuh token for ${username} at ${host}...`);

  const authString = `${username}:${password}`;
  const authEncoded = Buffer.from(authString).toString("base64");

  return await withRetry(async () => {
    try {
      const response = await axiosInstance.post(
        `${host}/security/user/authenticate`,
        {},
        { headers: { Authorization: `Basic ${authEncoded}` } }
      );

      const { data } = response;
      if (data.error !== 0 || !data.data?.token) {
        throw new Error("Wazuh authentication failed");
      }

      console.log("[✓] Token acquired");
      return data.data.token;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error(`Wazuh authentication failed: Invalid credentials`);
      }
      throw error;
    }
  }, `Wazuh authentication for ${username}`);
};

export const getActiveAgentIds = async (wazuhCredentials, token) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  try {
    const response = await axiosInstance.get(
      `${wazuhCredentials.host}/agents?status=active`,
      { headers }
    );
    const agents = response.data.data?.affected_items || [];
    return agents.map((agent) => agent.id);
  } catch (error) {
    throw new Error(`Failed to fetch active agents: ${error.message}`);
  }
};

export const getAgentScore = async (wazuhCredentials, token, agentId) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  try {
    const response = await axiosInstance.get(
      `${wazuhCredentials.host}/sca/${agentId}`,
      { headers }
    );
    const items = response.data.data?.affected_items || [];
    return items[0]?.score || null;
  } catch (error) {
    console.error(`SCA score error for agent ${agentId}:`, error.message);
    return null;
  }
};

export const computeAverageComplianceScore = async (wazuhCredentials) => {
  try {
    const token = await getWazuhToken(wazuhCredentials);
    const agentIds = await getActiveAgentIds(wazuhCredentials, token);

    const scores = await Promise.all(
      agentIds.map(async (agentId) => {
        return await getAgentScore(wazuhCredentials, token, agentId);
      })
    );

    const validScores = scores.filter((score) => score !== null);
    if (validScores.length === 0) return 0;

    const avgScore =
      validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
    return Math.round(avgScore * 100) / 100;
  } catch (error) {
    console.error("Compliance score error:", error.message);
    return 0;
  }
};

export const getAgentsSummaryService = async (clientCreds) => {
  const { wazuhCredentials, indexerCredentials, organizationId } = clientCreds;

  const token = await getWazuhToken(wazuhCredentials);
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const [agentsRes, vulnRes] = await Promise.all([
      axiosInstance.get(`${wazuhCredentials.host}/agents`, { headers }),
      fetchVulnerabilities(indexerCredentials),
    ]);

    const agents = agentsRes.data.data?.affected_items || [];
    const summary = {};

    for (const agent of agents) {
      if (agent.id === "000") continue;

      const agentData = {
        name: agent.name || "Unknown",
        ip: agent.ip,
        os_name: agent.os?.name,
        status: agent.status,
        vulnerabilities: vulnRes[agent.id] || [],
      };

      try {
        const scaRes = await axiosInstance.get(
          `${wazuhCredentials.host}/sca/${agent.id}`,
          { headers }
        );
        const scaItem = scaRes.data.data?.affected_items?.[0];
        if (scaItem) {
          agentData.score = scaItem.score;
          agentData.total_checks = scaItem.total_checks;
          agentData.pass = scaItem.pass;
          agentData.fail = scaItem.fail;
          agentData.invalid = scaItem.invalid;

          if (scaItem.policy_id) {
            const checksRes = await axiosInstance.get(
              `${wazuhCredentials.host}/sca/${agent.id}/checks/${scaItem.policy_id}`,
              { headers }
            );
            agentData.cis_checks = checksRes.data.data?.affected_items || [];
          }
        }
      } catch (err) {
        console.warn(`SCA fetch failed for agent ${agent.id}:`, err.message);
      }

      summary[agent.id] = agentData;
    }

    return { agents: summary };
  } catch (err) {
    console.error("Agents summary error:", err.message);
    throw err;
  }
};

export const getDashboardMetricsService = async (clientCreds) => {
  const { wazuhCredentials, indexerCredentials, organizationId } = clientCreds;

  return await withRetry(async () => {
    const token = await getWazuhToken(wazuhCredentials);
    const headers = { Authorization: `Bearer ${token}` };

    const [
      agentSummary,
      complianceScore,
      alertStats,
      wazuhHealth,
      hourlyAlerts,
    ] = await Promise.all([
      getAgentStatusSummary(wazuhCredentials, token),
      computeAverageComplianceScore(wazuhCredentials),
      getAlertStatistics(indexerCredentials),
      getWazuhHealth(wazuhCredentials, token),
      getHourlyAlerts(indexerCredentials),
    ]);

    const metrics = {
      total_alerts: alertStats.total,
      alerts_last_24hr: alertStats.last24h,
      critical_alerts: alertStats.critical,
      major_alerts: alertStats.major,
      minor_alerts: alertStats.minor,
      compliance_score: `${complianceScore}%`,
      active_agents: agentSummary,
      wazuh_health: wazuhHealth,
      hourly_alert_counts: hourlyAlerts,
    };

    return metrics;
  }, `Dashboard metrics for org ${organizationId}`);
};

export const getAlertsService = async (indexerCredentials, options = {}, organizationId = null) => {
  const { host, username, password } = indexerCredentials;
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  return await withRetry(async () => {
    const response = await axiosInstance.post(
      `${host}/wazuh-alerts-*/_search`,
      {
        query: { range: { "rule.level": { gte: 8 } } },
        sort: [{ "@timestamp": { order: "desc" } }],
        size: 10000, // Elasticsearch max limit without pagination
        // Removed _source to fetch complete alert JSON with all fields
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    const alerts =
      response.data.hits?.hits?.map((hit) => {
        const source = hit._source || {};
        // Return complete alert JSON with all fields
        return {
          alert_id: hit._id,
          // Include commonly used fields at top level for backward compatibility
          severity: source.rule?.level,
          alert_description: source.rule?.description,
          time: source["@timestamp"],
          host_name: source.predecoder?.hostname || "Host N/A",
          agent_name: source.agent?.name,
          agent_id: source.agent?.id,
          rule_groups: (source.rule?.groups || []).join(", "),
          // Include the complete alert data
          ...source
        };
      }) || [];

    return { alerts };
  }, `Alerts fetch for org ${organizationId}`);
};

// Helper functions
async function fetchVulnerabilities({ host, username, password }) {
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  try {
    const res = await axiosInstance.get(
      `${host}/wazuh-states-vulnerabilities-*/_search?size=1000`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    return (res.data.hits?.hits || []).reduce((acc, hit) => {
      const agentId = hit._source?.agent?.id;
      if (agentId) {
        acc[agentId] = acc[agentId] || [];
        acc[agentId].push({
          name: hit._source?.package?.name,
          id: hit._source?.vulnerability?.id,
          severity: hit._source?.vulnerability?.severity,
        });
      }
      return acc;
    }, {});
  } catch (err) {
    console.error("Vulnerabilities fetch error:", err.message);
    return {};
  }
}

async function getAgentStatusSummary(wazuhCredentials, token) {
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const res = await axiosInstance.get(
      `${wazuhCredentials.host}/agents/summary/status`,
      { headers }
    );
    return res.data.data?.connection?.active;
  } catch (err) {
    console.error("Agent status error:", err.message);
    return 0;
  }
}

async function getAlertStatistics({ host, username, password }) {
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  try {
    const [totalRes, last24hRes] = await Promise.all([
      axiosInstance.post(
        `${host}/wazuh-alerts-*/_search`,
        {
          size: 0,
          aggs: {
            severity: {
              range: {
                field: "rule.level",
                ranges: [
                  { key: "Minor", from: 8, to: 11 },
                  { key: "Major", from: 11, to: 14 },
                  { key: "Critical", from: 14 },
                ],
              },
            },
          },
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
        }
      ),
      axiosInstance.post(
        `${host}/wazuh-alerts-*/_search`,
        {
          size: 0,
          query: {
            range: {
              timestamp: {
                gte: "now-24h",
                lte: "now",
              },
            },
          },
          aggs: {
            severity: {
              range: {
                field: "rule.level",
                ranges: [
                  { key: "Minor", from: 8, to: 11 },
                  { key: "Major", from: 11, to: 14 },
                  { key: "Critical", from: 14 },
                ],
              },
            },
          },
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
        }
      ),
    ]);

    const totalBuckets = totalRes.data.aggregations?.severity?.buckets || [];
    const totalalerts = totalBuckets.reduce(
      (sum, bucket) => sum + bucket.doc_count,
      0
    );
    const last24hBuckets =
      last24hRes.data.aggregations?.severity?.buckets || [];
    const last24htotal = last24hBuckets.reduce(
      (sum, bucket) => sum + bucket.doc_count,
      0
    );

    return {
      total: totalalerts || 0,
      last24h: last24htotal || 0,
      critical:
        last24hBuckets.find((b) => b.key === "Critical")?.doc_count || 0,
      major: last24hBuckets.find((b) => b.key === "Major")?.doc_count || 0,
      minor: last24hBuckets.find((b) => b.key === "Minor")?.doc_count || 0,
    };
  } catch (err) {
    console.error("Alert statistics error:", err.message);
    return {
      total: 0,
      last24h: 0,
      critical: 0,
      major: 0,
      minor: 0,
    };
  }
}

async function getWazuhHealth(wazuhCredentials, token) {
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const res = await axiosInstance.get(
      `${wazuhCredentials.host}/manager/configuration/validation`,
      { headers }
    );
    return res.data.data?.affected_items?.[0]?.status || "unknown";
  } catch (err) {
    console.error("Wazuh health error:", err.message);
    return "error";
  }
}

async function getHourlyAlerts({ host, username, password }) {
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  try {
    const res = await axiosInstance.post(
      `${host}/wazuh-alerts*/_search`,
      {
        size: 0,
        query: {
          bool: {
            filter: [
              {
                range: {
                  "@timestamp": {
                    gte: "now-24h",
                    lt: "now",
                  },
                },
              },
            ],
          },
        },
        aggs: {
          severity_levels: {
            range: {
              field: "rule.level",
              ranges: [
                { key: "Minor", from: 8, to: 11 },
                { key: "Major", from: 11, to: 14 },
                { key: "Critical", from: 14 },
              ],
            },
            aggs: {
              alerts_per_hour: {
                date_histogram: {
                  field: "@timestamp",
                  calendar_interval: "hour",
                  min_doc_count: 0,
                },
              },
            },
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }
    );

    const hourlyBuckets = res.data.aggregations.severity_levels.buckets;
    const hourlyAlertCounts = {};
    hourlyBuckets.forEach((severityBucket) => {
      const severityKey = severityBucket.key.toLowerCase(); // minor, major, critical
      hourlyAlertCounts[severityKey] =
        severityBucket.alerts_per_hour.buckets.map((bucket) => {
          const date = new Date(bucket.key_as_string);
          const hour = date.getUTCHours().toString(); // No zero padding as per example
          return {
            hour,
            count: bucket.doc_count,
          };
        });
    });
    return hourlyAlertCounts;
  } catch (err) {
    console.error("graph fetch error:", err.message);
    return {};
  }
}

// Cache refresh service removed - no caching in use
export const refreshCacheService = async (cacheKey) => {
  // No-op since caching is disabled
  return { cleared: 0, message: "Caching disabled - no cache to clear" };
};
