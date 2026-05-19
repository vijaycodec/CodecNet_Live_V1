import axios from 'axios';

/**
 * Periodically refresh a given endpoint to keep Redis cache updated.
 * @param {string} endpoint - The Express route to trigger.
 * @param {number} interval - Interval in milliseconds.
 * @param {number} port - Port number for the server.
 */
function refreshCachePeriodically(endpoint, interval, port = 5001) {
  setInterval(async () => {
    try {
      console.log(`[CRON] Refreshing ${endpoint} cache...`);
      
      // Note: This will only work for endpoints that don't require authentication
      // For authenticated endpoints, we would need to implement a different strategy
      await axios.get(`http://localhost:${port}/api/v1${endpoint}`);
      console.log(`[✓] ${endpoint} cache refreshed`);
    } catch (err) {
      console.error(`[CRON] Failed to refresh ${endpoint} cache:`, err.message);
    }
  }, interval);
}

// Setup automatic refreshes for public/system caches
export function initializeCacheRefresh() {
  // Note: These endpoints require authentication, so auto-refresh is disabled
  // for now. In production, you might want to implement a system token
  // or refresh cache in a different way.
  
  // refreshCachePeriodically("/wazuh/alerts", 10 * 1000); // every 10 sec
  // refreshCachePeriodically("/wazuh/dashboard-metrics", 10 * 1000); // every 10 sec
  // refreshCachePeriodically("/wazuh/agents-summary", 10 * 1000); // every 10 sec
  // refreshCachePeriodically("/wazuh/compliance", 30 * 1000); // every 30 sec
  
  console.log("[CACHE] Cache refresh service initialized (currently disabled for authenticated endpoints)");
}

export { refreshCachePeriodically };