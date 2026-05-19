'use client';

import React, { useState, useEffect, useMemo } from 'react';

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

interface GlobeThreatOverlayProps {
  threats: ThreatData[];
  arcs: ArcData[];
  isRefreshing?: boolean;
  className?: string;
  position?: 'bottom' | 'left';
}

interface AttackFlow {
  id: string;
  sourceCountry: string;
  targetCountry: string;
  attackType: string;
}

// Helper function to clean up country names
const cleanCountryName = (country: string): string => {
  if (!country || country.toLowerCase() === 'unknown' || country.toLowerCase() === 'unknown region') {
    return 'Global Network';
  }
  return country;
};

// Helper function to clean up attack type text
const cleanAttackType = (attackType: string): string => {
  if (!attackType) return 'Cyber Attack';
  
  // Remove "Unknown:" prefix if present
  let cleaned = attackType.replace(/^Unknown:\s*/i, '');
  
  // If the whole string was just "Unknown", replace it
  if (cleaned.toLowerCase() === 'unknown' || cleaned.trim() === '') {
    return 'Cyber Attack';
  }
  
  // Take only the first part before any colon for cleaner display
  return cleaned.split(':')[0].trim();
};

// Helper function to get country from coordinates (simplified)
const getCountryFromCoords = (lat: number, lng: number): string => {
  // Simplified country detection based on common coordinates
  if (lat > 35 && lat < 42 && lng > 115 && lng < 120) return 'China';
  if (lat > 55 && lat < 60 && lng > 35 && lng < 40) return 'Russia';
  if (lat > 25 && lat < 30 && lng > 75 && lng < 80) return 'India';
  if (lat > 38 && lat < 42 && lng > -75 && lng < -70) return 'United States';
  if (lat > 50 && lat < 55 && lng > 10 && lng < 15) return 'Germany';
  if (lat > 50 && lat < 52 && lng > -2 && lng < 2) return 'United Kingdom';
  if (lat > 35 && lat < 37 && lng > 138 && lng < 141) return 'Japan';
  if (lat > -25 && lat < -20 && lng > -50 && lng < -45) return 'Brazil';
  return 'Global Network';
};

export function GlobeThreatOverlay({ 
  threats, 
  arcs, 
  isRefreshing = false, 
  className = '',
  position = 'bottom'
}: GlobeThreatOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Create attack flows from threat data using country information
  const attackFlows = useMemo(() => {
    const flows: AttackFlow[] = [];
    
    // Use all threats and clean up country names
    const targetCountries = ['United States', 'Germany', 'United Kingdom', 'Japan', 'Australia', 'France', 'Canada', 'South Korea'];
    
    threats.slice(0, 15).forEach((threat, index) => {
      const sourceCountry = cleanCountryName(threat.country || 'Global Network');
      const targetCountry = targetCountries[index % targetCountries.length];
      const attackType = cleanAttackType(threat.attackType);
      
      // Avoid same source and target
      if (sourceCountry !== targetCountry) {
        flows.push({
          id: `flow-${index}`,
          sourceCountry,
          targetCountry,
          attackType
        });
      }
    });

    // Also process arcs for additional flows
    arcs.slice(0, 10).forEach((arc, index) => {
      const sourceCountry = getCountryFromCoords(arc.startLat, arc.startLng);
      const targetCountry = getCountryFromCoords(arc.endLat, arc.endLng);
      
      // Find related threat for attack type
      const relatedThreat = threats.find(t => 
        Math.abs(t.lat - arc.startLat) < 10 && Math.abs(t.lng - arc.startLng) < 10
      );
      
      const attackType = relatedThreat ? cleanAttackType(relatedThreat.attackType) : 'Cyber Attack';
      
      // Only add if countries are different (all should be valid now)
      if (sourceCountry !== targetCountry) {
        flows.push({
          id: `arc-flow-${index}`,
          sourceCountry,
          targetCountry,
          attackType
        });
      }
    });

    // Remove duplicates and shuffle for variety
    const uniqueFlows = flows.filter((flow, index, self) => 
      index === self.findIndex(f => f.sourceCountry === flow.sourceCountry && f.targetCountry === flow.targetCountry)
    );

    return uniqueFlows.sort(() => Math.random() - 0.5);
  }, [threats, arcs]);

  // Auto-cycle through attack flows
  useEffect(() => {
    if (attackFlows.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % attackFlows.length);
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, [attackFlows.length]);

  if (attackFlows.length === 0) {
    return null;
  }

  const positionClasses = position === 'left' 
    ? 'absolute top-6 left-6 bottom-6 w-80 pointer-events-none'
    : 'absolute bottom-6 left-6 right-6 pointer-events-none';

  return (
    <div className={`${positionClasses} ${className}`}>
      {/* Transparent background with subtle border */}
      <div className={`bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 ${position === 'left' ? 'h-full overflow-y-auto' : ''}`}>
        {/* Display current attack flows line by line */}
        <div className={`${position === 'left' ? 'space-y-4' : 'space-y-3'} text-white/90`}>
          {position === 'left' && (
            <div className="text-center mb-4 pb-4 border-b border-white/10">
              <h4 className="text-lg font-semibold text-cyan-400">Live Threat Intelligence</h4>
              <p className="text-xs text-gray-400 mt-1">Real-time attack flows</p>
            </div>
          )}
          {attackFlows.slice(currentIndex, position === 'left' ? currentIndex + 6 : currentIndex + 3).map((flow, index) => (
            <div 
              key={flow.id}
              className={`transition-all duration-500 ${
                index === 0 ? 'text-cyan-400 font-medium' : 'text-white/70'
              }`}
              style={{
                opacity: index === 0 ? 1 : 0.7 - (index * 0.15)
              }}
            >
              {/* Country to Country flow */}
              <div className="flex items-center gap-3 text-sm mb-1">
                <span className="font-medium">{flow.sourceCountry}</span>
                <span className="text-red-400 text-lg">→</span>
                <span className="font-medium">{flow.targetCountry}</span>
              </div>
              
              {/* Attack type on separate line */}
              <div className="text-xs text-gray-400 ml-1 truncate max-w-full">
                {flow.attackType}
              </div>
            </div>
          ))}
        </div>
        
        {/* Live indicator */}
        {/* <div className="flex items-center justify-center mt-3 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
            <span>Live Threat Intelligence</span>
          </div>
        </div> */}
      </div>
    </div>
  );
}