// PATCH 47: IP Geolocation Proxy with Caching and Fallback
// Purpose: Avoid CORS errors and rate limiting by proxying IP geolocation requests through backend
// CWE-942: Overly Permissive Cross-domain Whitelist (Indirect fix)

import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

// In-memory cache with 1-hour TTL
const geoCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// IP geolocation services (fallback chain)
const GEOLOCATION_SERVICES = [
  {
    name: 'ip-api.com',
    url: (ip) => `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`,
    parse: (data) => data.status === 'success' ? {
      lat: data.lat,
      lng: data.lon,
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      zip: data.zip,
      timezone: data.timezone,
      isp: data.isp,
      org: data.org,
      as: data.as
    } : null
  },
  {
    name: 'ipapi.co',
    url: (ip) => `https://ipapi.co/${ip}/json/`,
    parse: (data) => data.error ? null : {
      lat: data.latitude,
      lng: data.longitude,
      country: data.country_name,
      countryCode: data.country_code,
      region: data.region,
      city: data.city,
      zip: data.postal,
      timezone: data.timezone,
      isp: data.org,
      org: data.org,
      as: data.asn
    }
  },
  {
    name: 'ipwhois.app',
    url: (ip) => `http://ipwhois.app/json/${ip}`,
    parse: (data) => data.success ? {
      lat: data.latitude,
      lng: data.longitude,
      country: data.country,
      countryCode: data.country_code,
      region: data.region,
      city: data.city,
      zip: data.postal,
      timezone: data.timezone,
      isp: data.isp,
      org: data.org,
      as: data.asn
    } : null
  }
];

/**
 * Validate IP address format (IPv4 and IPv6)
 */
function isValidIP(ip) {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 regex (simplified)
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Fetch geolocation from external service with timeout
 */
async function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Get geolocation data with service fallback
 */
async function getGeolocation(ip) {
  // Check cache first
  const cacheKey = `geo:${ip}`;
  const cached = geoCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[IP Geolocation] Cache hit for ${ip} (service: ${cached.data.service})`);
    return { ...cached.data, cached: true };
  }

  // Try each service in order until one succeeds
  for (const service of GEOLOCATION_SERVICES) {
    try {
      console.log(`[IP Geolocation] Trying ${service.name} for ${ip}...`);
      const url = service.url(ip);
      const rawData = await fetchWithTimeout(url);
      const parsedData = service.parse(rawData);

      if (parsedData) {
        const result = {
          ...parsedData,
          service: service.name
        };

        // Cache the result
        geoCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });

        console.log(`[IP Geolocation] Success with ${service.name} for ${ip}`);
        return result;
      }
    } catch (error) {
      console.warn(`[IP Geolocation] ${service.name} failed for ${ip}:`, error.message);
      continue; // Try next service
    }
  }

  // All services failed
  throw new ApiError(503, "All geolocation services are unavailable");
}

/**
 * GET /api/ip-geolocation/:ip
 * Get geolocation data for a single IP address
 */
export const getIpGeolocation = async (req, res) => {
  try {
    const { ip } = req.params;

    // Validate IP address
    if (!ip || !isValidIP(ip)) {
      return res.status(400).json(
        new ApiResponse(400, null, "Invalid IP address format")
      );
    }

    // Get geolocation data
    const geoData = await getGeolocation(ip);

    return res.status(200).json(
      new ApiResponse(200, geoData, "IP geolocation retrieved successfully")
    );

  } catch (error) {
    console.error('[IP Geolocation] Error:', error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(
        new ApiResponse(error.statusCode, null, error.message)
      );
    }

    return res.status(500).json(
      new ApiResponse(500, null, "Failed to fetch IP geolocation data")
    );
  }
};

/**
 * POST /api/ip-geolocation/batch
 * Get geolocation data for multiple IP addresses
 */
export const getBatchIpGeolocation = async (req, res) => {
  try {
    const { ips } = req.body;

    // Validate input
    if (!Array.isArray(ips) || ips.length === 0) {
      return res.status(400).json(
        new ApiResponse(400, null, "Request body must contain an array of IPs")
      );
    }

    // Limit batch size
    if (ips.length > 100) {
      return res.status(400).json(
        new ApiResponse(400, null, "Maximum 100 IPs per batch request")
      );
    }

    // Validate all IPs
    const invalidIps = ips.filter(ip => !isValidIP(ip));
    if (invalidIps.length > 0) {
      return res.status(400).json(
        new ApiResponse(400, null, `Invalid IP addresses: ${invalidIps.join(', ')}`)
      );
    }

    // Fetch geolocation for all IPs
    const results = [];
    const errors = [];

    for (const ip of ips) {
      try {
        const geoData = await getGeolocation(ip);
        results.push({ ip, data: geoData });
      } catch (error) {
        errors.push({ ip, error: error.message });
      }
    }

    return res.status(200).json(
      new ApiResponse(200, {
        results,
        errors,
        total: ips.length,
        successful: results.length,
        failed: errors.length
      }, "Batch IP geolocation completed")
    );

  } catch (error) {
    console.error('[IP Geolocation Batch] Error:', error);

    return res.status(500).json(
      new ApiResponse(500, null, "Failed to process batch IP geolocation")
    );
  }
};

/**
 * POST /api/ip-geolocation/clear-cache
 * Clear the geolocation cache (admin only)
 */
export const clearGeolocationCache = async (req, res) => {
  try {
    const entriesCleared = geoCache.size;
    geoCache.clear();

    console.log(`[IP Geolocation] Cache cleared: ${entriesCleared} entries removed`);

    return res.status(200).json(
      new ApiResponse(200, { entriesCleared }, "Geolocation cache cleared successfully")
    );

  } catch (error) {
    console.error('[IP Geolocation] Cache clear error:', error);

    return res.status(500).json(
      new ApiResponse(500, null, "Failed to clear geolocation cache")
    );
  }
};

/**
 * GET /api/ip-geolocation/cache/stats
 * Get cache statistics
 */
export const getCacheStats = async (req, res) => {
  try {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, value] of geoCache.entries()) {
      if (now - value.timestamp < CACHE_TTL) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return res.status(200).json(
      new ApiResponse(200, {
        totalEntries: geoCache.size,
        validEntries,
        expiredEntries,
        cacheTTL: CACHE_TTL,
        cacheTTLHours: CACHE_TTL / (60 * 60 * 1000)
      }, "Cache statistics retrieved")
    );

  } catch (error) {
    console.error('[IP Geolocation] Cache stats error:', error);

    return res.status(500).json(
      new ApiResponse(500, null, "Failed to get cache statistics")
    );
  }
};

// Auto-cleanup expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of geoCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      geoCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[IP Geolocation] Auto-cleanup: ${cleaned} expired cache entries removed`);
  }
}, 10 * 60 * 1000); // 10 minutes
