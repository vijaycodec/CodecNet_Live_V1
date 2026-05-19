import { getWazuhToken, computeAverageComplianceScore, axiosInstance } from '../services/wazuhExtended.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Get dashboard metrics
const getDashboardMetrics = asyncHandler(async (req, res) => {
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

    const agentSummaryResponse = await axiosInstance.get(
      `${WAZUH_HOST}/agents/summary/status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const hourlyAlertsQuery = {
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
    };

    const hourlyAlertsResponse = await axiosInstance.post(
      `${INDEXER_HOST}/wazuh-alerts*/_search`,
      hourlyAlertsQuery,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        auth: {
          username: INDEXER_USER,
          password: INDEXER_PASS,
        },
      }
    );

    const hourlyBuckets =
      hourlyAlertsResponse.data.aggregations.severity_levels.buckets;

    // Structure hourly alerts by severity with array of { hour, count }
    const hourlyAlertCounts = {};

    hourlyBuckets.forEach((severityBucket) => {
      const severityKey = severityBucket.key.toLowerCase(); // minor, major, critical
      hourlyAlertCounts[severityKey] =
        severityBucket.alerts_per_hour.buckets.map((bucket) => {
          const date = new Date(bucket.key_as_string);
          const hour = date.getHours().toString(); // Use local time instead of UTC
          return {
            hour,
            count: bucket.doc_count,
          };
        });
    });

    const agentSummary = agentSummaryResponse.data;

    const totalAlertQuery = {
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
    };

    const totalAlertsResponse = await axiosInstance.post(
      `${INDEXER_HOST}/wazuh-alerts-4.x-*/_search`,
      totalAlertQuery,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        auth: {
          username: INDEXER_USER,
          password: INDEXER_PASS,
        },
      }
    );

    const totalAlertsData = totalAlertsResponse.data;
    const buckets = totalAlertsData.aggregations?.severity?.buckets || [];
    const totalAlerts = buckets.reduce(
      (sum, bucket) => sum + (bucket.doc_count || 0),
      0
    );

    const complianceScore = await computeAverageComplianceScore(WAZUH_HOST, WAZUH_USER, WAZUH_PASS);

    const wazuhHealthResponse = await axiosInstance.get(
      `${WAZUH_HOST}/manager/configuration/validation`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );
    const wazuhHealthData = wazuhHealthResponse.data;

    const now = new Date();
    const timeFilter = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    ).toISOString();

    const last24hrQuery = {
      size: 0,
      query: {
        range: {
          timestamp: {
            gte: timeFilter,
            lte: now.toISOString(),
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
    };

    const recent24hrResponse = await axiosInstance.post(
      `${INDEXER_HOST}/wazuh-alerts-4.x-*/_search`,
      last24hrQuery,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        auth: {
          username: INDEXER_USER,
          password: INDEXER_PASS,
        },
      }
    );

    const severityBuckets =
      recent24hrResponse.data.aggregations?.severity?.buckets || [];
    const alertsLast24hr = severityBuckets.reduce(
      (sum, bucket) => sum + bucket.doc_count,
      0
    );

    const criticalAlertsLast24hr =
      severityBuckets.find((bucket) => bucket.key === "Critical")?.doc_count ||
      0;
    const majorAlertsLast24hr =
      severityBuckets.find((bucket) => bucket.key === "Major")?.doc_count || 0;
    const minorAlertsLast24hr =
      severityBuckets.find((bucket) => bucket.key === "Minor")?.doc_count || 0;

    const activeAgents = agentSummary.data?.connection?.active || 0;
    const wazuhHealth = wazuhHealthData.data?.affected_items?.[0]?.status;

    const responseData = {
      total_alerts: totalAlerts,
      alerts_last_24hr: alertsLast24hr,
      critical_alerts: criticalAlertsLast24hr,
      major_alerts: majorAlertsLast24hr,
      minor_alerts: minorAlertsLast24hr,
      open_tickets: 0,
      resolved_today: 0,
      avg_response_time: "0s",
      compliance_score: `${complianceScore}%`,
      active_agents: activeAgents,
      wazuh_health: wazuhHealth,
      hourly_alert_counts: hourlyAlertCounts,
    };

    return res.status(200).json(
      new ApiResponse(200, responseData, "Dashboard metrics fetched successfully")
    );
  } catch (error) {
    console.error("Dashboard metrics error:", error.message);
    throw new ApiError(500, error.message || "Failed to fetch dashboard metrics");
  }
});

export {
  getDashboardMetrics
};