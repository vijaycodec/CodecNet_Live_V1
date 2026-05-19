import axiosInstance from "../config/axiosConfig.js";
import { getCache, setCache } from "../utils/cache.js";

// Cache TTLs
const CACHE_TTL = {
  METRICS: 60, // 1 minute
  AGENTS: 120, // 2 minutes
  ALERTS: 30, // 30 seconds
};

export const getDashboardMetricsService = async ({
  wazuhCredentials,
  indexerCredentials,
}) => {
  const cacheKey = `metrics:${wazuhCredentials.host}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const [compliance, agents, alerts, health] = await Promise.all([
    getComplianceScore(wazuhCredentials),
    getAgentStatusSummary(wazuhCredentials),
    getAlertStatistics(indexerCredentials),
    getWazuhHealth(wazuhCredentials),
  ]);

  const result = {
    compliance_score: compliance,
    active_agents: agents.active,
    total_alerts: alerts.total,
    alerts_last_24h: alerts.last24h,
    wazuh_health: health,
  };

  await setCache(cacheKey, result, CACHE_TTL.METRICS);
  return result;
};

// Implement all the helper functions used above:
const getComplianceScore = async (wazuhCredentials) => {
  // Implementation from previous examples
};

const getAgentStatusSummary = async (wazuhCredentials) => {
  // Implementation from previous examples
};

const getAlertStatistics = async (indexerCredentials) => {
  // Implementation from previous examples
};

const getWazuhHealth = async (wazuhCredentials) => {
  // Implementation from previous examples
};

// Other service functions...
