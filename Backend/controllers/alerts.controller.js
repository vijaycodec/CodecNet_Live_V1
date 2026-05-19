import { getIpLocation, axiosInstance } from '../services/wazuhExtended.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { processAlertsForNotification } from '../services/alertNotification.service.js';

// Get alerts count (lightweight endpoint)
const getAlertsCount = asyncHandler(async (req, res) => {
  try {
    // Get credentials from client credentials (set by auth middleware)
    const indexerCreds = req.clientCreds?.indexerCredentials;
    const organizationId = req.clientCreds?.organizationId;

    if (!indexerCreds) {
      throw new ApiError(400, "Indexer credentials not found for this client");
    }

    const { host: INDEXER_HOST, username: INDEXER_USER, password: INDEXER_PASS } = indexerCreds;

    const authString = `${INDEXER_USER}:${INDEXER_PASS}`;
    const authEncoded = Buffer.from(authString).toString("base64");

    // Get time range parameters (hours for relative, or absolute from/to timestamps)
    const { hours, from, to } = req.query;

    // Build time filter
    let timeFilter = {};
    if (from && to) {
      // Absolute time range
      timeFilter = {
        gte: from,
        lte: to
      };
    } else if (hours) {
      // Relative time range (e.g., last 24 hours)
      const hoursAgo = parseInt(hours) || 24;
      const now = new Date();
      const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      timeFilter = {
        gte: startTime.toISOString(),
        lte: now.toISOString()
      };
    }

    // Build query with both severity and time filters
    const queryFilters = [
      {
        range: {
          "rule.level": {
            gte: 8,
          },
        },
      }
    ];

    // Add time filter if provided
    if (Object.keys(timeFilter).length > 0) {
      queryFilters.push({
        range: {
          "@timestamp": timeFilter
        }
      });
    }

    // Count query - only get the count, no documents
    const countQuery = {
      query: {
        bool: {
          must: queryFilters
        }
      },
      size: 0,  // Don't return any documents, just the count
      track_total_hits: true
    };

    const countResponse = await axiosInstance.post(
      `${INDEXER_HOST}/wazuh-alerts*/_search`,
      countQuery,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Basic ${authEncoded}`,
        },
      }
    );

    const totalCount = countResponse.data.hits?.total?.value || 0;

    return res.status(200).json(
      new ApiResponse(200, { count: totalCount }, "Alert count fetched successfully")
    );
  } catch (error) {
    console.error("Alerts count route error:", error.message);
    throw new ApiError(500, error.message || "Failed to fetch alert count");
  }
});

// Get alerts
const getAlerts = asyncHandler(async (req, res) => {
  try {
    // Get credentials from client credentials (set by auth middleware)
    const indexerCreds = req.clientCreds?.indexerCredentials;
    const organizationId = req.clientCreds?.organizationId;

    if (!indexerCreds) {
      throw new ApiError(400, "Indexer credentials not found for this client");
    }

    const { host: INDEXER_HOST, username: INDEXER_USER, password: INDEXER_PASS } = indexerCreds;

    const authString = `${INDEXER_USER}:${INDEXER_PASS}`;
    const authEncoded = Buffer.from(authString).toString("base64");

    // Get time range parameters (hours for relative, or absolute from/to timestamps)
    const { hours } = req.query;
    const timeFrom = req.query.from;
    const timeTo = req.query.to;

    // Build time filter
    let timeFilter = {};
    if (timeFrom && timeTo) {
      // Absolute time range
      timeFilter = {
        gte: timeFrom,
        lte: timeTo
      };
    } else if (hours) {
      // Relative time range (e.g., last 24 hours)
      const hoursAgo = parseInt(hours) || 24;
      const now = new Date();
      const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      timeFilter = {
        gte: startTime.toISOString(),
        lte: now.toISOString()
      };
    }

    // Build query with both severity and time filters
    const queryFilters = [
      {
        range: {
          "rule.level": {
            gte: 8,
          },
        },
      }
    ];

    // Add time filter if provided
    if (Object.keys(timeFilter).length > 0) {
      queryFilters.push({
        range: {
          "@timestamp": timeFilter
        }
      });
    }

    // Get pagination parameters
    const paginationSize = parseInt(req.query.limit) || 1000;
    const searchAfter = req.query.search_after ? JSON.parse(req.query.search_after) : null;

    const alertsQuery = {
      query: {
        bool: {
          must: queryFilters
        }
      },
      // Sort by timestamp DESC and _id for consistent pagination
      sort: [
        { "@timestamp": { order: "desc" } },
        { "_id": { order: "desc" } }
      ],
      size: paginationSize,  // Number of results to return (batch size)
      track_total_hits: true  // Track total hits for pagination
    };

    // Add search_after for deep pagination (avoids 10k limit)
    if (searchAfter) {
      alertsQuery.search_after = searchAfter;
    }

    const alertsResponse = await axiosInstance.post(
      `${INDEXER_HOST}/wazuh-alerts*/_search`,
      alertsQuery,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Basic ${authEncoded}`,
        },
      }
    );

    const hits = alertsResponse.data.hits?.hits || [];
    const totalCount = alertsResponse.data.hits?.total?.value || 0;

    const alerts = [];
    const processedIPs = new Set();

    for (const hit of hits) {
      const source = hit._source || {};
      const srcip = source.data?.srcip;

      let location = null;
      if (srcip && !processedIPs.has(srcip)) {
        processedIPs.add(srcip);
        try {
          location = await getIpLocation(srcip);
        } catch (error) {
          console.log(`Failed to get location for IP ${srcip}:`, error.message);
        }
      }

      // Return complete alert JSON with all fields
      alerts.push({
        alert_id: hit._id,
        // Include commonly used fields at top level for backward compatibility
        severity: source.rule?.level,
        alert_description: source.rule?.description,
        time: source["@timestamp"],
        host_name: source.predecoder?.hostname,
        agent_name: source.agent?.name,
        agent_id: source.agent?.id,
        rule_groups: (source.rule?.groups || []).join(", "),
        srcip: srcip,
        location: location,
        // Include the complete alert data
        ...source
      });
    }

    // Get sort values from the last hit for search_after pagination
    const lastHit = hits.length > 0 ? hits[hits.length - 1] : null;
    const nextSearchAfter = lastHit?.sort || null;

    const alertsData = {
      alerts,
      total: totalCount,
      limit: paginationSize,
      returned: alerts.length,
      search_after: nextSearchAfter  // For next batch pagination
    };

    // Fire-and-forget: send critical-alert emails. Dedup is enforced via EmailLog
    // so polling the endpoint won't email the same alert_id more than once.
    if (process.env.ALERT_EMAIL_ENABLED !== 'false') {
      processAlertsForNotification(alerts, organizationId).catch((err) => {
        console.error('[alert-email] dispatch failed:', err.message);
      });
    }

    return res.status(200).json(
      new ApiResponse(200, alertsData, "Alerts fetched successfully")
    );
  } catch (error) {
    console.error("Alerts route error:", error.message);
    throw new ApiError(500, error.message || "Failed to fetch alerts");
  }
});

export {
  getAlerts,
  getAlertsCount
};