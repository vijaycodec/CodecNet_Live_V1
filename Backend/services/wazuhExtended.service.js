import axios from 'axios';
import https from 'https';

// Axios instance with SSL verification disabled
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
});

// No token caching - fetch fresh token every time

/**
 * Get Wazuh authentication token
 */
async function getWazuhToken(wazuhHost, wazuhUser, wazuhPass) {
  console.log(`[i] Getting fresh Wazuh token for ${wazuhUser} at ${wazuhHost}...`);

  const authString = `${wazuhUser}:${wazuhPass}`;
  const authEncoded = Buffer.from(authString).toString("base64");

  const headers = {
    Authorization: `Basic ${authEncoded}`,
    Accept: "application/json",
  };

  try {
    const response = await axiosInstance.post(
      `${wazuhHost}/security/user/authenticate`,
      {},
      { headers }
    );

    const data = response.data;

    if (data.error !== 0 || !data.data?.token) {
      throw new Error("Wazuh authentication failed");
    }

    console.log("[✓] Token acquired");
    return data.data.token;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error(`Wazuh authentication failed: Invalid credentials`);
    }
    throw new Error(`Wazuh authentication failed: ${error.message}`);
  }
}

/**
 * Fetch all active agent IDs
 */
async function getActiveAgentIds(wazuhHost, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  try {
    const response = await axiosInstance.get(
      `${wazuhHost}/agents?status=active`,
      { headers }
    );

    const data = response.data;
    const agents = data.data?.affected_items || [];
    return agents.map((agent) => agent.id);
  } catch (error) {
    throw new Error(`Failed to fetch active agents: ${error.message}`);
  }
}

/**
 * Fetch SCA score for a single agent
 */
async function getAgentScore(wazuhHost, token, agentId) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  try {
    const response = await axiosInstance.get(`${wazuhHost}/sca/${agentId}`, {
      headers,
    });

    const data = response.data;
    const items = data.data?.affected_items || [];

    if (items.length > 0 && "score" in items[0]) {
      return items[0].score;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Compute average compliance score across all agents
 */
async function computeAverageComplianceScore(wazuhHost, wazuhUser, wazuhPass) {
  try {
    const token = await getWazuhToken(wazuhHost, wazuhUser, wazuhPass);
    const agentIds = await getActiveAgentIds(wazuhHost, token);

    const scores = [];

    for (const agentId of agentIds) {
      const score = await getAgentScore(wazuhHost, token, agentId);
      if (score !== null) {
        scores.push(score);
      }
    }

    if (scores.length > 0) {
      const avgScore =
        scores.reduce((sum, score) => sum + score, 0) / scores.length;
      return Math.round(avgScore * 100) / 100;
    } else {
      return 0;
    }
  } catch (error) {
    console.error(`[✗] Error computing compliance score: ${error.message}`);
    return 0;
  }
}

// IP Geolocation function (using all 3 services like in OTX proxy)
const getIpLocation = async (ip) => {
  // Skip private IP ranges
  if (isPrivateIP(ip)) {
    return null;
  }

  const services = [
    // Service 1: ip-api.com (free, no key required)
    async () => {
      const response = await axiosInstance.get(
        `http://ip-api.com/json/${ip}?fields=status,message,country,lat,lon`
      );
      if (response.status === 200) {
        const data = response.data;
        if (data.status === "success") {
          return {
            lat: parseFloat(data.lat) || 0,
            lng: parseFloat(data.lon) || 0,
            country: data.country || "Unknown",
          };
        }
      }
      return null;
    },

    // Service 2: ipapi.co (backup)
    async () => {
      const response = await axiosInstance.get(`https://ipapi.co/${ip}/json/`);
      if (response.status === 200) {
        const data = response.data;
        if (data.latitude && data.longitude) {
          return {
            lat: parseFloat(data.latitude) || 0,
            lng: parseFloat(data.longitude) || 0,
            country: data.country_name || "Unknown",
          };
        }
      }
      return null;
    },

    // Service 3: ipwhois.app (free)
    async () => {
      const response = await axiosInstance.get(`http://ipwhois.app/json/${ip}`);
      if (response.status === 200) {
        const data = response.data;
        if (data.latitude && data.longitude) {
          return {
            lat: parseFloat(data.latitude) || 0,
            lng: parseFloat(data.longitude) || 0,
            country: data.country || "Unknown",
          };
        }
      }
      return null;
    },
  ];

  // Try each service with timeout
  for (const [index, service] of services.entries()) {
    try {
      // console.log(`🌐 Trying geolocation service ${index + 1} for IP: ${ip}`);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000)
      );

      const result = await Promise.race([service(), timeoutPromise]);

      if (result && result.lat !== 0 && result.lng !== 0) {
        // console.log(
        //   `✅ Geolocation success with service ${index + 1}:`,
        //   result
        // );
        return result;
      }
    } catch (error) {
      // console.log(
      //   `❌ Geolocation service ${index + 1} failed for ${ip}:`,
      //   error.message
      // );
      continue;
    }
  }

  // console.log(`❌ All geolocation services failed for IP: ${ip}`);
  return null;
};

// Check if IP is private/internal
const isPrivateIP = (ip) => {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fe80::/,
  ];

  return privateRanges.some((range) => range.test(ip));
};

export {
  getWazuhToken,
  getActiveAgentIds,
  getAgentScore,
  computeAverageComplianceScore,
  getIpLocation,
  isPrivateIP,
  axiosInstance
};