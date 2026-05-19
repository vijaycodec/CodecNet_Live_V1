// src/contexts/ThreatDataContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { wazuhApi } from '@/lib/api';
const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP

// Types
interface AttackData {
  id: string;
  sourceIp: string;
  sourceLat: number;
  sourceLng: number;
  sourceCountry: string;
  targetIp: string;
  targetLat: number;
  targetLng: number;
  targetCountry: string;
  attackType: string;
  severity: 'minor' | 'major' | 'critical';
  timestamp: Date;
}

interface CachedThreatData {
  attacks: AttackData[];
  threats: ThreatData[];
  arcs: ArcData[];
  serverLocations: ServerLocation[];
  timestamp: number;
  orgId?: string;
}

interface ThreatData {
  lat: number;
  lng: number;
  size: number;
  color: string;
  attackType: string;
  count: number;
  country?: string;
}

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  strokeWidth: number;
}

interface ServerLocation {
  ip: string;
  lat: number;
  lng: number;
  country: string;
}

interface ThreatDataContextType {
  attacks: AttackData[];
  threats: ThreatData[];
  arcs: ArcData[];
  serverLocations: ServerLocation[];
  isLoading: boolean;
  lastUpdated: Date | null;
  refreshData: () => Promise<void>;
  isRefreshing: boolean;
  clearCache: () => void;
}

const ThreatDataContext = createContext<ThreatDataContextType | undefined>(undefined);

// Custom hook to use the context
export const useThreatData = () => {
  const context = useContext(ThreatDataContext);
  if (context === undefined) {
    throw new Error('useThreatData must be used within a ThreatDataProvider');
  }
  return context;
};

// PATCH 47: IP Geolocation proxy function - fixes CORS and rate limiting issues
// Now uses backend proxy endpoint instead of direct external API calls
// Backend has application-wide cache (1 hour) - dramatically reduces API calls for repeated IPs
const getIpLocation = async (ip: string): Promise<{ lat: number, lng: number, country: string } | null> => {
  try {
    // Call backend proxy endpoint (no CORS issues, server-to-server request with shared cache)
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://codecnet.codecnetworks.in/api';
    const response = await fetch(`${apiBaseUrl}/ip-geolocation/${ip}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return {
          lat: result.data.lat || 0,
          lng: result.data.lng || 0,
          country: result.data.country || 'Unknown'
        };
      }
    } else {
      console.warn(`⚠️ IP geolocation failed for ${ip}: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error(`❌ IP geolocation error for ${ip}:`, error instanceof Error ? error.message : 'Unknown error');
  }

  return null;
};

// Cache utility functions
const CACHE_KEY = 'threat_data_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes cache expiry

const saveThreatDataToCache = (data: CachedThreatData) => {
  try {
    const cacheData = {
      ...data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log(`💾 Threat data cached for org: ${data.orgId || 'global'}`);
  } catch (error) {
    console.warn('Failed to save threat data to cache:', error);
  }
};

const loadThreatDataFromCache = (orgId?: string): CachedThreatData | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cacheData: CachedThreatData = JSON.parse(cached);

    // Check if cache is for the correct organization
    if (cacheData.orgId !== orgId) {
      console.log(`🗑️ Cache org mismatch: cached=${cacheData.orgId}, requested=${orgId}`);
      return null;
    }

    // Check if cache is still valid (not expired)
    const age = Date.now() - cacheData.timestamp;
    if (age > CACHE_EXPIRY_MS) {
      console.log(`⏰ Cache expired (${Math.round(age / 1000)}s old), fetching fresh data`);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Convert timestamp strings back to Date objects
    const restoredData = {
      ...cacheData,
      attacks: cacheData.attacks.map(attack => ({
        ...attack,
        timestamp: new Date(attack.timestamp)
      }))
    };

    console.log(`📦 Loaded cached threat data for org: ${orgId || 'global'} (${Math.round(age / 1000)}s old)`);
    return restoredData;
  } catch (error) {
    console.warn('Failed to load threat data from cache:', error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
};

const clearThreatDataCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Threat data cache cleared');
  } catch (error) {
    console.warn('Failed to clear threat data cache:', error);
  }
};

const isCacheStale = (refreshInterval: number): boolean => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return true;

    const cacheData: CachedThreatData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;

    // Consider cache stale if it's older than half the refresh interval
    const staleThreshold = refreshInterval / 2;
    return age > staleThreshold;
  } catch {
    return true;
  }
};

// Fetch real attack data from Wazuh alerts (only open status alerts with srcip and location)
const fetchRealAttackData = async (orgId?: string): Promise<{ attacks: AttackData[], serverLocations: ServerLocation[] }> => {
  try {
    // Try to use the new Wazuh API first with organization ID
    let alerts = [];
    try {
      const data = await wazuhApi.getAlerts(orgId);
      alerts = data.data?.alerts || data.alerts || [];
    } catch (wazuhError) {
      console.log('[!] Wazuh API unavailable, falling back to RBAC API:', (wazuhError as Error).message);

      // Fallback to RBAC API
      const token = Cookies.get('auth_token');
      const response = await fetch(`${BASE_URL}/dashboard/alerts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      alerts = data.alerts || [];
    }

    // Hardcoded server IPs (your infrastructure) - will be geolocated
    const serverIPs = [
      '122.176.142.223'
      //   '8.8.8.8',        // Google DNS (for testing)
      //   '1.1.1.1',        // Cloudflare DNS (for testing)
      //   '208.67.222.222', // OpenDNS (for testing)
      //   '9.9.9.9',        // Quad9 DNS (for testing)
      //   '76.76.19.19'     // Alternate DNS (for testing)
    ];

    // Get geolocation for server IPs
    const serverLocations = [];
    for (const serverIP of serverIPs) {
      const location = await getIpLocation(serverIP);
      if (location && location.lat !== 0 && location.lng !== 0) {
        serverLocations.push({
          ip: serverIP,
          lat: location.lat,
          lng: location.lng,
          country: location.country
        });
      }
    }

    // console.log(`Geolocated ${serverLocations.length} server IPs:`, serverLocations);

    const attackData: AttackData[] = [];

    // If no server locations were geolocated, fall back to default locations
    if (serverLocations.length === 0) {
      console.warn('No server IPs could be geolocated, using fallback locations');
      serverLocations.push(
        { ip: '8.8.8.8', lat: 37.4056, lng: -122.0775, country: 'USA' }, // Google approximate
        { ip: '1.1.1.1', lat: -37.7000, lng: 175.0000, country: 'Australia' } // Cloudflare approximate
      );
    }
    // Filter for open status alerts with srcip and location (same logic as live-alerts-table)
    for (const alert of alerts) {
      // All alerts from Wazuh are considered 'open' (like in live-alerts-table.tsx line 112)
      const status = 'open';

      // Only process alerts with srcip and valid location
      if (status === 'open' && alert.srcip && alert.location &&
        alert.location.lat !== 0 && alert.location.lng !== 0) {

        const target = serverLocations[Math.floor(Math.random() * serverLocations.length)];

        // Map severity levels to our categories (same as live-alerts-table.tsx)
        let severity: 'minor' | 'major' | 'critical';
        const level = alert.severity || 0;
        if (level >= 15) severity = 'critical';
        else if (level >= 11) severity = 'major';
        else if (level >= 7) severity = 'minor';
        else severity = 'minor';

        // Determine attack type from rule groups or description
        let attackType = 'Security Event';
        if (alert.rule_groups) {
          if (alert.rule_groups.includes('authentication')) attackType = 'Authentication Attack';
          else if (alert.rule_groups.includes('web')) attackType = 'Web Attack';
          else if (alert.rule_groups.includes('intrusion')) attackType = 'Intrusion Attempt';
          else if (alert.rule_groups.includes('malware')) attackType = 'Malware';
          else if (alert.rule_groups.includes('brute_force')) attackType = 'Brute Force';
          else if (alert.rule_groups.includes('sql_injection')) attackType = 'SQL Injection';
          else if (alert.rule_groups.includes('xss')) attackType = 'XSS';
          else if (alert.rule_groups.includes('ddos')) attackType = 'DDoS';
        }

        // Validate coordinates before adding attack
        // Skip attacks with invalid or (0,0) coordinates
        const hasValidSourceCoords = alert.location.lat && alert.location.lng &&
          Math.abs(alert.location.lat) > 0.1 && Math.abs(alert.location.lng) > 0.1 &&
          !isNaN(alert.location.lat) && !isNaN(alert.location.lng);

        const hasValidTargetCoords = target.lat && target.lng &&
          Math.abs(target.lat) > 0.1 && Math.abs(target.lng) > 0.1 &&
          !isNaN(target.lat) && !isNaN(target.lng);

        if (hasValidSourceCoords && hasValidTargetCoords) {
          attackData.push({
            id: `wazuh-attack-${alert.time}-${alert.srcip}`,
            sourceIp: alert.srcip,
            sourceLat: alert.location.lat,
            sourceLng: alert.location.lng,
            sourceCountry: alert.location.country || 'Unknown',
            targetIp: target.ip,
            targetLat: target.lat,
            targetLng: target.lng,
            targetCountry: target.country,
            attackType: attackType,
            severity: severity,
            timestamp: new Date(alert.time),
          });
        }
      }
    }

    // console.log(`Processed ${attackData.length} real open status attacks with geolocated source IPs`);
    return {
      attacks: attackData,
      serverLocations: serverLocations
    };
  } catch (error) {
    console.error('Failed to fetch real attack data:', error);
    const fallbackData = await generateFallbackAttackData();
    return fallbackData;
  }
};

// Generate fallback attack data when real data is unavailable
const generateFallbackAttackData = async (): Promise<{ attacks: AttackData[], serverLocations: ServerLocation[] }> => {
  const attackTypes = ['DDoS', 'Malware', 'Phishing', 'Brute Force', 'SQL Injection', 'XSS', 'Ransomware', 'Port Scan'];
  const severities: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];

  // Use the same hardcoded server IPs and geolocate them
  const serverIPs = [
    '8.8.8.8',        // Google DNS (for testing)
    '1.1.1.1',        // Cloudflare DNS (for testing)
    '208.67.222.222', // OpenDNS (for testing)
  ];
  // Try to geolocate server IPs
  const serverLocations: Array<{ ip: string; lat: number; lng: number; country: any }> = [];
  for (const serverIP of serverIPs) {
    try {
      const location = await getIpLocation(serverIP);
      if (location && location.lat !== 0 && location.lng !== 0) {
        serverLocations.push({
          ip: serverIP,
          lat: location.lat,
          lng: location.lng,
          country: location.country
        });
      }
    } catch (error) {
      // console.log(`Failed to geolocate fallback server IP ${serverIP}`);
    }
  }
  // If geolocation fails, use hardcoded fallback locations
  if (serverLocations.length === 0) {
    serverLocations.push(
      { ip: '8.8.8.8', lat: 37.4056, lng: -122.0775, country: 'USA' },
      { ip: '1.1.1.1', lat: -37.7000, lng: 175.0000, country: 'Australia' }
    );
  }

  const attackSources = [
    { lat: 39.9042, lng: 116.4074, country: 'China', threatLevel: 'high' },
    { lat: 55.7558, lng: 37.6173, country: 'Russia', threatLevel: 'critical' },
    { lat: 28.6139, lng: 77.2090, country: 'India', threatLevel: 'medium' },
    { lat: -23.5505, lng: -46.6333, country: 'Brazil', threatLevel: 'medium' },
    { lat: 52.5200, lng: 13.4050, country: 'Germany', threatLevel: 'low' },
    { lat: 25.2048, lng: 55.2708, country: 'UAE', threatLevel: 'low' },
    { lat: 40.7589, lng: -73.9851, country: 'USA', threatLevel: 'medium' },
    { lat: 51.5074, lng: -0.1278, country: 'UK', threatLevel: 'low' },
  ];

  const fallbackAttacks = Array.from({ length: 50 }, (_, i) => {
    const source = attackSources[Math.floor(Math.random() * attackSources.length)];
    const target = serverLocations[Math.floor(Math.random() * serverLocations.length)];
    let severity: 'minor' | 'major' | 'critical';
    switch (source.threatLevel) {
      case 'critical':
        severity = Math.random() > 0.3 ? 'critical' : 'major';
        break;
      case 'high':
        severity = Math.random() > 0.4 ? 'major' : 'minor';
        break;
      case 'medium':
        severity = Math.random() > 0.5 ? 'major' : 'minor';
        break;
      default:
        severity = Math.random() > 0.7 ? 'major' : 'minor';
    }

    return {
      id: `fallback-attack-${i}-${Date.now()}`,
      sourceIp: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      sourceLat: source.lat + (Math.random() - 0.5) * 6,
      sourceLng: source.lng + (Math.random() - 0.5) * 6,
      sourceCountry: source.country,
      targetIp: target.ip,
      targetLat: target.lat,
      targetLng: target.lng,
      targetCountry: target.country,
      attackType: attackTypes[Math.floor(Math.random() * attackTypes.length)],
      severity: severity,
      timestamp: new Date(Date.now() - Math.random() * 86400000),
    };
  });

  return {
    attacks: fallbackAttacks,
    serverLocations: serverLocations
  };
};

// Fetch OTX threat data
const fetchOTXThreatData = async (): Promise<{ threats: ThreatData[], arcs: ArcData[] }> => {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://codecnet.codecnetworks.in/api';
    const response = await fetch(`${apiBaseUrl}/otx-proxy`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout (OTX can be slow)
    });

    if (response.ok) {
      const result = await response.json();
      // Backend returns: { success: true, statusCode: 200, data: { threats, arcs } }
      if (result.success && result.data && result.data.threats && result.data.arcs) {
        console.log(`✅ Fetched ${result.data.threats.length} threats and ${result.data.arcs.length} arcs from OTX`);
        return {
          threats: result.data.threats,
          arcs: result.data.arcs
        };
      }
    }
    throw new Error('Failed to fetch OTX data');
  } catch (error) {
    console.error('Failed to fetch OTX data via proxy:', error);
    throw error;
  }
};

// Provider component
interface ThreatDataProviderProps {
  children: ReactNode;
  refreshInterval?: number; // in milliseconds, default 30 seconds
  orgId?: string; // Organization ID for client-specific data
}

export const ThreatDataProvider: React.FC<ThreatDataProviderProps> = ({
  children,
  refreshInterval = 30000,
  orgId
}) => {
  const [attacks, setAttacks] = useState<AttackData[]>([]);
  const [threats, setThreats] = useState<ThreatData[]>([]);
  const [arcs, setArcs] = useState<ArcData[]>([]);
  const [serverLocations, setServerLocations] = useState<ServerLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Function to fetch all data
  const fetchAllData = async (isManualRefresh = false, forceRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }

    // Try to load from cache first (if not forcing refresh)
    if (!forceRefresh && !isManualRefresh) {
      const cachedData = loadThreatDataFromCache(orgId);
      if (cachedData && mountedRef.current) {
        console.log('📦 Using cached threat data, checking if refresh needed...');
        setAttacks(cachedData.attacks);
        setServerLocations(cachedData.serverLocations);
        setThreats(cachedData.threats);
        setArcs(cachedData.arcs);
        setLastUpdated(new Date(cachedData.timestamp));
        setIsLoading(false);

        // Check if we should refresh in background
        if (!isCacheStale(refreshInterval)) {
          console.log('✅ Cache is fresh, no background refresh needed');
          return;
        } else {
          console.log('🔄 Cache is getting stale, fetching fresh data in background...');
          // Continue to fetch fresh data but don't show loading state
        }
      }
    }

    // Don't set isLoading to true for background refreshes - only for initial load when no cache
    if ((attacks.length === 0 && threats.length === 0) || forceRefresh) {
      setIsLoading(true);
    }

    try {
      const fetchStartTime = Date.now();
      console.log(`🔄 Fetching ${forceRefresh ? 'fresh' : 'updated'} threat data for organization: ${orgId || 'global'}...`);

      const [attackDataResponse, otxThreatResponse] = await Promise.all([
        fetchRealAttackData(orgId),
        fetchOTXThreatData()
      ]);

      // Only update state if component is still mounted
      if (mountedRef.current) {
        const fetchTime = Date.now() - fetchStartTime;
        console.log(`✅ Threat data fetched in ${fetchTime}ms`);

        setAttacks(attackDataResponse.attacks);
        setServerLocations(attackDataResponse.serverLocations);
        setThreats(otxThreatResponse.threats);
        setArcs(otxThreatResponse.arcs);
        setLastUpdated(new Date());

        // Cache the fresh data
        const cacheData: CachedThreatData = {
          attacks: attackDataResponse.attacks,
          serverLocations: attackDataResponse.serverLocations,
          threats: otxThreatResponse.threats,
          arcs: otxThreatResponse.arcs,
          timestamp: Date.now(),
          orgId: orgId
        };
        saveThreatDataToCache(cacheData);
      }
    } catch (error) {
      console.error('❌ Error fetching threat data:', error);
      // Only fallback to empty data on initial load failure when no cache exists
      if (mountedRef.current && attacks.length === 0 && threats.length === 0) {
        const fallbackData = await generateFallbackAttackData();
        setAttacks(fallbackData.attacks);
        setServerLocations(fallbackData.serverLocations);
        setThreats([]);
        setArcs([]);
        setLastUpdated(new Date());

        // Cache fallback data too
        const fallbackCacheData: CachedThreatData = {
          attacks: fallbackData.attacks,
          serverLocations: fallbackData.serverLocations,
          threats: [],
          arcs: [],
          timestamp: Date.now(),
          orgId: orgId
        };
        saveThreatDataToCache(fallbackCacheData);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  // Manual refresh function
  const refreshData = async () => {
    await fetchAllData(true, true); // Manual refresh with force refresh
  };

  // Handle organization change - clear cache and force refresh
  useEffect(() => {
    // Clear cache when switching organizations to prevent showing wrong data
    const currentCached = loadThreatDataFromCache(orgId);
    if (currentCached && currentCached.orgId !== orgId) {
      console.log(`🔄 Organization changed from ${currentCached.orgId} to ${orgId}, clearing cache`);
      clearThreatDataCache();
    }
  }, [orgId]);

  // Initial data load and interval setup
  useEffect(() => {
    mountedRef.current = true;
    // Initial load (will use cache if available and valid)
    fetchAllData();

    // Set up auto-refresh interval
    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchAllData();
      }
    }, refreshInterval);

    // Cleanup function
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshInterval, orgId]); // Re-fetch when orgId changes

  // Handle visibility change (pause/resume when tab is not visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, clear interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Tab is visible, resume interval if not already running
        if (!intervalRef.current && mountedRef.current) {
          intervalRef.current = setInterval(() => {
            if (mountedRef.current) {
              fetchAllData();
            }
          }, refreshInterval);
          // Also fetch fresh data when tab becomes visible
          fetchAllData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshInterval]);

  const contextValue: ThreatDataContextType = {
    attacks,
    threats,
    arcs,
    serverLocations,
    isLoading,
    lastUpdated,
    refreshData,
    isRefreshing,
    clearCache: clearThreatDataCache
  };

  return (
    <ThreatDataContext.Provider value={contextValue}>
      {children}
    </ThreatDataContext.Provider>
  );
};