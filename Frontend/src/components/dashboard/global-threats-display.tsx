'use client';

import React, { useState, useMemo } from 'react';
import { useThreatData } from '../../contexts/ThreatDataContext';

interface ThreatData {
  lat: number;
  lng: number;
  size: number;
  color: string;
  attackType: string;
  count: number;
  country?: string;
}

interface GlobalThreatsDisplayProps {
  className?: string;
}

// Helper function to clean up display text
const cleanDisplayText = (text: string): string => {
  if (!text || text.toLowerCase() === 'unknown') {
    return 'Global Network';
  }
  return text;
};

// Helper function to clean up attack type text
const cleanAttackType = (attackType: string): string => {
  if (!attackType) return 'Cyber Threat';
  
  // Remove "Unknown:" prefix if present
  let cleaned = attackType.replace(/^Unknown:\s*/i, '');
  
  // If the whole string was just "Unknown", replace it
  if (cleaned.toLowerCase() === 'unknown' || cleaned.trim() === '') {
    return 'Cyber Threat';
  }
  
  return cleaned;
};

export function GlobalThreatsDisplay({ className = '' }: GlobalThreatsDisplayProps) {
  const { threats, isLoading, isRefreshing, lastUpdated } = useThreatData();
  const [selectedThreatType, setSelectedThreatType] = useState<string>('all');

  // Group threats by type and country
  const threatStats = useMemo(() => {
    const stats = {
      byType: {} as Record<string, number>,
      byCountry: {} as Record<string, number>,
      total: threats.length,
      topThreats: [] as Array<{ type: string; count: number; color: string }>
    };

    threats.forEach(threat => {
      // Count by type (clean up the attack type)
      const type = cleanAttackType(threat.attackType || 'Unknown').split(':')[0].trim();
      stats.byType[type] = (stats.byType[type] || 0) + threat.count;

      // Count by country (clean up the country name)
      const countryName = cleanDisplayText(threat.country || 'Global Network');
      stats.byCountry[countryName] = (stats.byCountry[countryName] || 0) + threat.count;
    });

    // Get top 5 threat types
    stats.topThreats = Object.entries(stats.byType)
      .map(([type, count]) => {
        const threat = threats.find(t => t.attackType && t.attackType.startsWith(type));
        return {
          type,
          count,
          color: threat?.color || '#666'
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return stats;
  }, [threats]);

  if (isLoading && threats.length === 0) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 border border-gray-700 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-300 mt-2">Loading global threats...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Modern glass-morphism container */}
      <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-2xl border border-gray-600/30 shadow-2xl">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-2xl"></div>
        
        <div className="relative p-8">
          {/* Enhanced Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="p-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Global Threat Intelligence
                </h3>
                <p className="text-sm text-gray-400 mt-1">Real-time cybersecurity monitoring</p>
              </div>
              
              {/* Live status */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                isRefreshing 
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' 
                  : 'bg-green-500/10 border-green-500/30 text-green-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isRefreshing ? 'bg-yellow-400' : 'bg-green-400'
                } animate-pulse`}></div>
                <span className="text-xs font-medium">
                  {isRefreshing ? 'Updating...' : 'Live Feed'}
                </span>
              </div>
            </div>
            
            {lastUpdated && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Last Updated</p>
                <p className="text-sm text-gray-300 font-mono">
                  {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>

          {/* Enhanced Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative bg-gray-800/60 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-red-500/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-400">{threatStats.total}</div>
                    <div className="text-sm text-gray-400">Active Threats</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative bg-gray-800/60 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-orange-500/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-orange-400">{Object.keys(threatStats.byType).length}</div>
                    <div className="text-sm text-gray-400">Threat Types</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative bg-gray-800/60 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-400">{Object.keys(threatStats.byCountry).length}</div>
                    <div className="text-sm text-gray-400">Countries Affected</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Current Active Threats */}
            <div className="group">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-white">Current Active Threats</h4>
                <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
              </div>
              
              <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                {threats.slice(0, 10).map((threat, index) => (
                  <div key={index} className="group/item relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/20 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                    <div className="relative bg-gray-800/40 backdrop-blur-sm rounded-xl p-4 border border-gray-700/30 hover:border-gray-600/50 transition-all duration-300">
                      <div className="flex items-start gap-4">
                        <div 
                          className="w-4 h-4 rounded-full animate-pulse mt-1 shadow-lg" 
                          style={{ 
                            backgroundColor: threat.color,
                            boxShadow: `0 0 10px ${threat.color}40`
                          }}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white mb-1 truncate">
                            {cleanAttackType(threat.attackType)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {cleanDisplayText(threat.country || 'Unknown')}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              {threat.count} indicators
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Affected Countries */}
            <div className="group">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-white">Most Affected Countries</h4>
                <div className="flex-1 h-px bg-gradient-to-r from-red-500/50 to-transparent"></div>
              </div>
              
              <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                {Object.entries(threatStats.byCountry)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 10)
                  .map(([country, count], index) => {
                    const percentage = (count / Object.values(threatStats.byCountry).reduce((a, b) => a + b, 0)) * 100;
                    return (
                      <div key={country} className="group/item relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                        <div className="relative bg-gray-800/40 backdrop-blur-sm rounded-xl p-4 border border-gray-700/30 hover:border-red-500/30 transition-all duration-300">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold text-white/80">#{index + 1}</span>
                              <span className="text-sm font-medium text-white">{country}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-red-400">{count}</div>
                              <div className="text-xs text-gray-400">threats</div>
                            </div>
                          </div>
                          <div className="relative">
                            <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-red-500 to-pink-500 h-2 rounded-full transition-all duration-1000 ease-out shadow-lg" 
                                style={{ 
                                  width: `${Math.min(percentage, 100)}%`,
                                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
                                }}
                              ></div>
                            </div>
                            <div className="absolute right-0 top-3 text-xs text-gray-400">
                              {percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}