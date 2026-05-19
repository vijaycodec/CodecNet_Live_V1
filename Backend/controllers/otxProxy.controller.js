import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import dotenv from 'dotenv';

dotenv.config();

/**
 * AlienVault OTX Proxy Controller
 *
 * PURPOSE: Proxy requests to AlienVault OTX API to avoid exposing API key in frontend
 *
 * SECURITY:
 * - API key stored server-side only (not exposed to frontend)
 * - Rate limiting applied to prevent abuse
 * - No authentication required (public threat intelligence data)
 *
 * PATCH 47 Extension: OTX proxy endpoint for threat map visualization
 */

// In-memory cache with 20-minute TTL
const otxCache = new Map();
const OTX_CACHE_TTL = 20 * 60 * 1000; // 20 minutes in milliseconds

/**
 * Fetch threat data from AlienVault OTX
 *
 * @route GET /api/otx-proxy
 * @access Public (no auth required - public threat intelligence)
 */
export const getOTXThreatData = asyncHandler(async (req, res) => {
  const OTX_API_KEY = process.env.ALIEN_VAULT_OTX_API_KEY;

  if (!OTX_API_KEY || OTX_API_KEY === 'YOUR_OTX_API_KEY_HERE') {
    console.warn('⚠️ OTX API key not configured, using mock data');
    const mockData = generateMockOTXData();
    return res.status(200).json(
      new ApiResponse(200, {
        threats: mockData.threats,
        arcs: mockData.arcs,
        source: 'mock'
      }, 'Mock OTX threat data generated')
    );
  }

  // Check cache first
  const cacheKey = 'otx:threat-data';
  const cached = otxCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < OTX_CACHE_TTL) {
    console.log('✅ OTX Cache hit - returning cached data');
    return res.status(200).json(
      new ApiResponse(200, {
        ...cached.data,
        cached: true,
        cached_at: new Date(cached.timestamp).toISOString()
      }, 'OTX threat data retrieved from cache')
    );
  }

  try {
    console.log('🔐 Fetching fresh OTX threat data...');

    // Fetch subscribed pulses from OTX
    let pulsesResponse = await fetch('https://otx.alienvault.com/api/v1/pulses/subscribed?limit=50', {
      method: 'GET',
      headers: {
        'X-OTX-API-KEY': OTX_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'SOC-Dashboard/1.0'
      },
      timeout: 10000
    });

    // If subscribed pulses fail, try public pulses
    let pulsesData;
    if (!pulsesResponse.ok) {
      console.log('⚠️ Subscribed pulses failed, trying public pulses...');
      pulsesResponse = await fetch('https://otx.alienvault.com/api/v1/pulses/activity?limit=50', {
        method: 'GET',
        headers: {
          'X-OTX-API-KEY': OTX_API_KEY,
          'Content-Type': 'application/json',
          'User-Agent': 'SOC-Dashboard/1.0'
        },
        timeout: 10000
      });
    }

    if (!pulsesResponse.ok) {
      console.error(`❌ OTX API request failed: ${pulsesResponse.status}`);
      throw new ApiError(pulsesResponse.status, `OTX API request failed: ${pulsesResponse.status}`);
    }

    pulsesData = await pulsesResponse.json();

    const threats = [];
    const processedIPs = new Set();

    if (pulsesData.results && Array.isArray(pulsesData.results)) {
      console.log(`🔄 Processing ${pulsesData.results.length} OTX pulses...`);

      // Process first 15 pulses for performance (reduced from 20 for faster response)
      const pulsePromises = pulsesData.results.slice(0, 15).map(async (pulse) => {
        try {
          // Get indicators for this pulse
          const indicatorsResponse = await fetch(
            `https://otx.alienvault.com/api/v1/pulses/${pulse.id}/indicators`,
            {
              headers: {
                'X-OTX-API-KEY': OTX_API_KEY,
                'User-Agent': 'SOC-Dashboard/1.0'
              },
              timeout: 5000
            }
          );

          if (!indicatorsResponse.ok) return [];

          const indicatorsData = await indicatorsResponse.json();

          // Process IPv4 indicators
          const ipIndicators = indicatorsData.results?.filter(
            (indicator) => indicator.type === 'IPv4' && !processedIPs.has(indicator.indicator)
          ) || [];

          // Process first 2 IPs per pulse (reduced from 3 for faster response)
          const selectedIPs = ipIndicators.slice(0, 2);
          selectedIPs.forEach(ip => processedIPs.add(ip.indicator));

          // Fetch all geolocations in parallel
          const geoPromises = selectedIPs.map(async (ipIndicator) => {
            try {
              // Use our IP geolocation proxy with 1 second timeout (reduced from 3)
              const locationResponse = await fetch(
                `http://127.0.0.1:5000/api/ip-geolocation/${ipIndicator.indicator}`,
                { timeout: 1000 }
              );

              if (!locationResponse.ok) return null;

              const locationResult = await locationResponse.json();
              const location = locationResult.data;

              if (!location || location.lat === 0 || location.lng === 0) return null;

              // Determine threat type
              const threatType = pulse.malware_families?.[0]?.name ||
                (pulse.tags?.includes('phishing') ? 'Phishing' :
                  pulse.tags?.includes('malware') ? 'Malware' :
                    pulse.tags?.includes('botnet') ? 'Botnet' : 'Unknown');

              const otxColors = {
                'Malware': '#FF6B6B',
                'Phishing': '#4ECDC4',
                'Botnet': '#45B7D1',
                'APT': '#FFA07A',
                'Exploit': '#98D8C8',
                'Unknown': '#F7DC6F'
              };

              return {
                lat: location.lat,
                lng: location.lng,
                size: Math.random() * 0.8 + 0.4,
                color: otxColors[threatType] || otxColors['Unknown'],
                attackType: `${threatType}: ${pulse.name}`,
                count: pulse.indicator_count || 1,
                country: location.country
              };
            } catch (error) {
              return null;
            }
          });

          // Wait for all geolocation requests to complete
          const results = await Promise.all(geoPromises);
          return results.filter(r => r !== null);

        } catch (error) {
          console.error(`❌ Error processing pulse ${pulse.id}:`, error.message);
          return [];
        }
      });

      // Wait for all pulses to be processed
      const pulseResults = await Promise.all(pulsePromises);
      pulseResults.forEach(pulseThreats => threats.push(...pulseThreats));
    }

    // Generate arcs connecting threats
    const arcs = [];
    const arcColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

    const maxArcs = Math.min(30, threats.length * 2);
    for (let i = 0; i < maxArcs && threats.length > 1; i++) {
      const sourceIndex = Math.floor(Math.random() * threats.length);
      const targetIndex = Math.floor(Math.random() * threats.length);

      if (sourceIndex !== targetIndex) {
        const source = threats[sourceIndex];
        const target = threats[targetIndex];

        arcs.push({
          startLat: source.lat,
          startLng: source.lng,
          endLat: target.lat,
          endLng: target.lng,
          color: arcColors[Math.floor(Math.random() * arcColors.length)],
          strokeWidth: Math.random() * 3 + 0.5
        });
      }
    }

    console.log(`✅ OTX data fetched: ${threats.length} threats, ${arcs.length} arcs`);

    const responseData = {
      threats,
      arcs,
      source: 'otx'
    };

    // Cache the result
    otxCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });
    console.log(`💾 OTX data cached for ${OTX_CACHE_TTL / 60000} minutes`);

    res.status(200).json(
      new ApiResponse(200, responseData, 'OTX threat data retrieved successfully')
    );

  } catch (error) {
    console.error('❌ OTX Proxy Error:', error);

    // Return mock data as fallback
    const mockData = generateMockOTXData();
    res.status(200).json(
      new ApiResponse(200, {
        threats: mockData.threats,
        arcs: mockData.arcs,
        source: 'mock_fallback',
        error: error.message
      }, 'Returned mock data due to OTX API error')
    );
  }
});

/**
 * Generate mock OTX threat data for fallback
 */
function generateMockOTXData() {
  const otxThreatTypes = ['APT Campaign', 'Malware Family', 'Phishing Campaign', 'Botnet C2', 'Exploit Kit'];
  const otxColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

  const realThreatLocations = [
    { lat: 39.9042, lng: 116.4074, country: 'China' },
    { lat: 55.7558, lng: 37.6173, country: 'Russia' },
    { lat: 28.6139, lng: 77.2090, country: 'India' },
    { lat: 40.7128, lng: -74.0060, country: 'USA' },
    { lat: 52.5200, lng: 13.4050, country: 'Germany' },
    { lat: 51.5074, lng: -0.1278, country: 'UK' },
    { lat: 35.6762, lng: 139.6503, country: 'Japan' },
    { lat: -23.5505, lng: -46.6333, country: 'Brazil' }
  ];

  const threats = Array.from({ length: 50 }, (_, i) => {
    const location = realThreatLocations[i % realThreatLocations.length];
    return {
      lat: location.lat + (Math.random() - 0.5) * 8,
      lng: location.lng + (Math.random() - 0.5) * 8,
      size: Math.random() * 0.8 + 0.4,
      color: otxColors[Math.floor(Math.random() * otxColors.length)],
      attackType: otxThreatTypes[Math.floor(Math.random() * otxThreatTypes.length)],
      count: Math.floor(Math.random() * 1000) + 100,
      country: location.country
    };
  });

  const arcs = Array.from({ length: 30 }, () => {
    const source = realThreatLocations[Math.floor(Math.random() * realThreatLocations.length)];
    const target = realThreatLocations[Math.floor(Math.random() * realThreatLocations.length)];

    return {
      startLat: source.lat + (Math.random() - 0.5) * 5,
      startLng: source.lng + (Math.random() - 0.5) * 5,
      endLat: target.lat + (Math.random() - 0.5) * 5,
      endLng: target.lng + (Math.random() - 0.5) * 5,
      color: otxColors[Math.floor(Math.random() * otxColors.length)],
      strokeWidth: Math.random() * 2 + 1
    };
  });

  return { threats, arcs };
}

/**
 * Clear OTX cache
 * @route POST /api/otx-proxy/clear-cache
 * @access Public (admin recommended)
 */
export const clearOTXCache = asyncHandler(async (req, res) => {
  const entriesCleared = otxCache.size;
  otxCache.clear();

  console.log(`🗑️ OTX cache cleared: ${entriesCleared} entries removed`);

  res.status(200).json(
    new ApiResponse(200, { entriesCleared }, 'OTX cache cleared successfully')
  );
});

/**
 * Get OTX cache statistics
 * @route GET /api/otx-proxy/cache/stats
 * @access Public
 */
export const getOTXCacheStats = asyncHandler(async (req, res) => {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const [key, value] of otxCache.entries()) {
    if (now - value.timestamp < OTX_CACHE_TTL) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  res.status(200).json(
    new ApiResponse(200, {
      totalEntries: otxCache.size,
      validEntries,
      expiredEntries,
      cacheTTL: OTX_CACHE_TTL,
      cacheTTLMinutes: OTX_CACHE_TTL / 60000
    }, 'OTX cache statistics retrieved')
  );
});

// Auto-cleanup expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of otxCache.entries()) {
    if (now - value.timestamp >= OTX_CACHE_TTL) {
      otxCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 OTX auto-cleanup: ${cleaned} expired cache entries removed`);
  }
}, 10 * 60 * 1000); // 10 minutes
