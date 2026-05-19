// src/app/api/otx-proxy/route.ts

import { NextRequest } from 'next/server';

// Types
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

// Enhanced IP Geolocation function with multiple fallbacks
const getIpLocation = async (ip: string): Promise<{lat: number, lng: number, country: string} | null> => {
  const services = [
    // Service 1: ip-api.com (free, no key required, 1000 requests/month)
    async () => {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,lat,lon`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          return {
            lat: parseFloat(data.lat) || 0,
            lng: parseFloat(data.lon) || 0,
            country: data.country || 'Unknown'
          };

        }
      }
      return null;
    },
    
    // Service 2: ipapi.co (backup)
    async () => {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          return {
            lat: parseFloat(data.latitude) || 0,
            lng: parseFloat(data.longitude) || 0,
            country: data.country_name || 'Unknown'
          };
        }
      }
      return null;
    },
    
    // Service 3: ipwhois.app (free)
    async () => {
      const response = await fetch(`http://ipwhois.app/json/${ip}`);
      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          return {
            lat: parseFloat(data.latitude) || 0,
            lng: parseFloat(data.longitude) || 0,
            country: data.country || 'Unknown'
          };
        }
      }
      return null;
    }
  ];

  // Try each service with timeout
  for (let index = 0; index < services.length; index++) {
    const service = services[index];
    try {
      // console.log(`🌐 Trying geolocation service ${index + 1} for IP: ${ip}`);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      const result = await Promise.race([service(), timeoutPromise]);
      
      if (result && result.lat !== 0 && result.lng !== 0) {
        // console.log(`✅ Geolocation success with service ${index + 1}:`, result);
        return result;
      }
    } catch (error) {
      // console.log(`❌ Geolocation service ${index + 1} failed for ${ip}:`, error instanceof Error ? error.message : 'Unknown error');
      continue;
    }
  }

  // console.log(`❌ All geolocation services failed for IP: ${ip}`);
  return null;
};

// Rate limiting helper
const rateLimitDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Main OTX data fetching function
const fetchOTXThreatData = async (apiKey: string): Promise<{ threats: ThreatData[], arcs: ArcData[] }> => {
  try {
    // console.log('🔐 Making OTX API request...');
    
    // Fetch subscribed pulses from OTX (increased from 50 to 100)
    let pulsesResponse = await fetch('https://otx.alienvault.com/api/v1/pulses/subscribed?limit=100', {
      method: 'GET',
      headers: {
        'X-OTX-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'ThreatMap/1.0'
      }
    });

    // console.log('📡 OTX Subscribed Pulses Response status:', pulsesResponse.status);

    // If subscribed pulses fail or return empty, try public pulses
    let pulsesData;
    if (!pulsesResponse.ok) {
      console.log('⚠️ Subscribed pulses failed, trying public pulses...');
      pulsesResponse = await fetch('https://otx.alienvault.com/api/v1/pulses/activity?limit=100', {
        method: 'GET',
        headers: {
          'X-OTX-API-KEY': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'ThreatMap/1.0'
        }
      });
      console.log('📡 OTX Public Pulses Response status:', pulsesResponse.status);
    }

    if (!pulsesResponse.ok) {
      const errorText = await pulsesResponse.text();
      console.error('❌ OTX API Error Response:', errorText);
      throw new Error(`OTX API request failed: ${pulsesResponse.status} - ${errorText}`);
    }

    pulsesData = await pulsesResponse.json();
    // console.log('📦 Pulses data structure:', {
    //   hasResults: !!pulsesData.results,
    //   resultsType: Array.isArray(pulsesData.results) ? 'array' : typeof pulsesData.results,
    //   resultsLength: pulsesData.results?.length || 0,
    //   samplePulse: pulsesData.results?.[0] ? {
    //     id: pulsesData.results[0].id,
    //     name: pulsesData.results[0].name,
    //     tags: pulsesData.results[0].tags,
    //     indicatorCount: pulsesData.results[0].indicator_count
    //   } : 'none'
    // });

    const threats: ThreatData[] = [];
    const processedIPs = new Set<string>();

    if (pulsesData.results && Array.isArray(pulsesData.results)) {
      // console.log(`🔄 Processing ${pulsesData.results.length} pulses...`);
      
      // Extract IP indicators from pulses (increased from 10 to 30)
      for (const [pulseIndex, pulse] of pulsesData.results.slice(0, 50).entries()) {
        try {
          // console.log(`📋 Processing pulse ${pulseIndex + 1}: ${pulse.name}`);
          
          // Get indicators for this pulse
          const indicatorsResponse = await fetch(`https://otx.alienvault.com/api/v1/pulses/${pulse.id}/indicators`, {
            headers: { 
              'X-OTX-API-KEY': apiKey,
              'User-Agent': 'ThreatMap/1.0'
            }
          });

          if (indicatorsResponse.ok) {
            const indicatorsData = await indicatorsResponse.json();
            
            // console.log(`📊 Indicators for pulse ${pulse.name}:`, {
            //   totalResults: indicatorsData.results?.length || 0,
            //   ipv4Count: indicatorsData.results?.filter((i: any) => i.type === 'IPv4').length || 0
            // });
            
            // Process IP indicators
            const ipIndicators = indicatorsData.results?.filter((indicator: any) => 
              indicator.type === 'IPv4' && !processedIPs.has(indicator.indicator)
            ) || [];

            // console.log(`🎯 Found ${ipIndicators.length} unique IPv4 indicators`);

            for (const [ipIndex, ipIndicator] of ipIndicators.slice(0, 5).entries()) {
              processedIPs.add(ipIndicator.indicator);
              
              // console.log(`🌍 Getting geolocation for IP ${ipIndex + 1}: ${ipIndicator.indicator}`);
              
              // Get geolocation for IP
              const location = await getIpLocation(ipIndicator.indicator);
              
              // console.log(`📍 Location result:`, location);
              
              if (location && location.lat !== 0 && location.lng !== 0) {
                // Determine threat type and color
                const threatType = pulse.malware_families?.[0]?.name || 
                                 (pulse.tags?.includes('phishing') ? 'Phishing' :
                                  pulse.tags?.includes('malware') ? 'Malware' :
                                  pulse.tags?.includes('botnet') ? 'Botnet' : 'Unknown');

                const otxColors: { [key: string]: string } = {
                  'Malware': '#FF6B6B',
                  'Phishing': '#4ECDC4', 
                  'Botnet': '#45B7D1',
                  'APT': '#FFA07A',
                  'Exploit': '#98D8C8',
                  'Unknown': '#F7DC6F'
                };

                const threat = {
                  lat: location.lat,
                  lng: location.lng,
                  size: Math.random() * 0.8 + 0.4,
                  color: otxColors[threatType] || otxColors['Unknown'],
                  attackType: `${threatType}: ${pulse.name}`,
                  count: pulse.indicator_count || 1,
                  country: location.country
                };

                threats.push(threat);
                // console.log(`✅ Added threat:`, threat);
              } else {
                console.log(`❌ Skipping IP ${ipIndicator.indicator} - invalid location`);
              }

              // Rate limiting - wait between requests
              await rateLimitDelay(100);
            }
          } else {
            console.error(`❌ Failed to get indicators for pulse ${pulse.id}:`, indicatorsResponse.status);
          }
        } catch (error) {
          console.error(`❌ Error processing pulse ${pulse.id}:`, error);
        }
      }
    } else {
      console.error('❌ No valid results array in pulses data');
    }

    // console.log(`🎉 Final threats collected: ${threats.length}`);

    // Generate more arcs connecting threats (increased from 20 to 50)
    const arcs: ArcData[] = [];
    const arcColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6'];
    
    // Create more diverse arc patterns
    const maxArcs = Math.min(50, threats.length * 2);
    for (let i = 0; i < maxArcs && i < threats.length - 1; i++) {
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
          strokeWidth: Math.random() * 3 + 0.5 // Varied thickness
        });
      }
    }

    // console.log(`🔗 Generated ${arcs.length} arcs`);

    return { threats, arcs };
  } catch (error) {
    console.error('❌ Failed to fetch OTX data:', error);
    throw error;
  }
};

// Additional function to fetch from OTX public activity for more data
const fetchOTXPublicData = async (apiKey: string): Promise<{ threats: ThreatData[], arcs: ArcData[] }> => {
  try {
    // console.log('🔐 Making OTX Public Activity API request...');
    
    const pulsesResponse = await fetch('https://otx.alienvault.com/api/v1/pulses/activity?limit=50', {
      method: 'GET',
      headers: {
        'X-OTX-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'ThreatMap/1.0'
      }
    });

    if (!pulsesResponse.ok) {
      throw new Error(`OTX Public API request failed: ${pulsesResponse.status}`);
    }

    const pulsesData = await pulsesResponse.json();
    const threats: ThreatData[] = [];
    const processedIPs = new Set<string>();

    if (pulsesData.results && Array.isArray(pulsesData.results)) {
      // console.log(`🔄 Processing ${pulsesData.results.length} public pulses...`);
      
      for (const [pulseIndex, pulse] of pulsesData.results.slice(0, 15).entries()) {
        try {
          const indicatorsResponse = await fetch(`https://otx.alienvault.com/api/v1/pulses/${pulse.id}/indicators`, {
            headers: { 
              'X-OTX-API-KEY': apiKey,
              'User-Agent': 'ThreatMap/1.0'
            }
          });

          if (indicatorsResponse.ok) {
            const indicatorsData = await indicatorsResponse.json();
            const ipIndicators = indicatorsData.results?.filter((indicator: any) => 
              indicator.type === 'IPv4' && !processedIPs.has(indicator.indicator)
            ) || [];

            for (const [ipIndex, ipIndicator] of ipIndicators.slice(0, 4).entries()) {
              processedIPs.add(ipIndicator.indicator);
              
              const location = await getIpLocation(ipIndicator.indicator);
              
              if (location && location.lat !== 0 && location.lng !== 0) {
                const threatType = pulse.malware_families?.[0]?.name || 
                                 (pulse.tags?.includes('phishing') ? 'Phishing' :
                                  pulse.tags?.includes('malware') ? 'Malware' :
                                  pulse.tags?.includes('botnet') ? 'Botnet' : 'Public Threat');

                const otxColors: { [key: string]: string } = {
                  'Malware': '#FF6B6B',
                  'Phishing': '#4ECDC4', 
                  'Botnet': '#45B7D1',
                  'APT': '#FFA07A',
                  'Exploit': '#98D8C8',
                  'Public Threat': '#E67E22'
                };

                threats.push({
                  lat: location.lat,
                  lng: location.lng,
                  size: Math.random() * 0.8 + 0.4,
                  color: otxColors[threatType] || otxColors['Public Threat'],
                  attackType: `${threatType}: ${pulse.name}`,
                  count: pulse.indicator_count || 1,
                  country: location.country
                });
              }

              await rateLimitDelay(150);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing public pulse ${pulse.id}:`, error);
        }
      }
    }

    const arcs: ArcData[] = [];
    const arcColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
    
    for (let i = 0; i < Math.min(25, threats.length - 1); i++) {
      if (i + 1 < threats.length) {
        const source = threats[i];
        const target = threats[i + 1];
        
        arcs.push({
          startLat: source.lat,
          startLng: source.lng,
          endLat: target.lat,
          endLng: target.lng,
          color: arcColors[Math.floor(Math.random() * arcColors.length)],
          strokeWidth: Math.random() * 2 + 1
        });
      }
    }

    // console.log(`🎉 Public data collected: ${threats.length} threats, ${arcs.length} arcs`);
    return { threats, arcs };
  } catch (error) {
    console.error('❌ Failed to fetch OTX public data:', error);
    return { threats: [], arcs: [] };
  }
};

// Mock data fallback
const generateMockOTXData = (): { threats: ThreatData[], arcs: ArcData[] } => {
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

  const threats = Array.from({ length: 100 }, (_, i) => { // Increased from 50 to 100
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

  const arcs = Array.from({ length: 75 }, () => { // Increased from 25 to 75
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
};

// App Router GET Handler
export async function GET(request: Request) {
  try {
    // Get OTX API key from environment variables
    const OTX_API_KEY = process.env.ALIEN_VAULT_OTX_API_KEY;
    
    // console.log('🔍 DEBUG - API Key check:', {
    //   hasApiKey: !!OTX_API_KEY,
    //   keyLength: OTX_API_KEY?.length || 0,
    //   firstChars: OTX_API_KEY?.substring(0, 8) || 'none'
    // });
    
    if (!OTX_API_KEY || OTX_API_KEY === 'YOUR_OTX_API_KEY_HERE') {
      console.warn('⚠️ OTX API key not configured, using enhanced mock data');
      const mockData = generateMockOTXData();
      return Response.json({
        success: true,
        threats: mockData.threats,
        arcs: mockData.arcs,
        source: 'mock'
      });
    }

    // console.log('🚀 Fetching enhanced OTX data from multiple sources...');
    
    // Fetch from multiple OTX endpoints in parallel for more data
    const [subscribedData, activityData] = await Promise.allSettled([
      fetchOTXThreatData(OTX_API_KEY),
      fetchOTXPublicData(OTX_API_KEY)
    ]);
    
    let allThreats: ThreatData[] = [];
    let allArcs: ArcData[] = [];
    
    // Combine data from both sources
    if (subscribedData.status === 'fulfilled') {
      allThreats.push(...subscribedData.value.threats);
      allArcs.push(...subscribedData.value.arcs);
      // console.log(`✅ Added ${subscribedData.value.threats.length} threats from subscribed pulses`);
    }
    
    if (activityData.status === 'fulfilled') {
      allThreats.push(...activityData.value.threats);
      allArcs.push(...activityData.value.arcs);
      // console.log(`✅ Added ${activityData.value.threats.length} threats from activity pulses`);
    }
    
    // Remove duplicates based on coordinates
    const uniqueThreats = allThreats.filter((threat, index, self) => 
      index === self.findIndex(t => t.lat === threat.lat && t.lng === threat.lng)
    );
    
    // console.log(`📊 Total unique threats: ${uniqueThreats.length}, Total arcs: ${allArcs.length}`);
    
    return Response.json({
      success: true,
      threats: uniqueThreats,
      arcs: allArcs,
      source: 'otx_enhanced'
    });

  } catch (error) {
    console.error('❌ OTX Proxy API Error:', error);
    
    // Return enhanced mock data as fallback
    const mockData = generateMockOTXData();
    return Response.json({
      success: true,
      threats: mockData.threats,
      arcs: mockData.arcs,
      source: 'mock_fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}