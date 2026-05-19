'use client';

import React from 'react';
import { ThreatDataProvider, useThreatData } from '../../contexts/ThreatDataContext';
import { Globe3DFullscreen } from '../../components/dashboard/globe-3d-fullscreen';
import { useClient } from '@/contexts/ClientContext';

export default function GlobeIntelligencePage() {
  const { selectedClient, isClientMode } = useClient();

  // Get organization ID for client-specific threat data
  const orgId = isClientMode && selectedClient?.id ? selectedClient.id : undefined;

  return (
    <ThreatDataProvider refreshInterval={120000} orgId={orgId}>
      <GlobeIntelligenceContent />
    </ThreatDataProvider>
  );
}

function GlobeIntelligenceContent() {
  const { threats, arcs, isRefreshing, isLoading } = useThreatData();

  // Dummy data for loading state
  const dummyThreats = [
    { lat: 39.9042, lng: 116.4074, size: 0.8, color: '#ff6b6b', attackType: 'Loading...', count: 0, country: 'Loading...' },
    { lat: 55.7558, lng: 37.6173, size: 1.0, color: '#feca57', attackType: 'Loading...', count: 0, country: 'Loading...' },
    { lat: 28.6139, lng: 77.2090, size: 0.6, color: '#48dbfb', attackType: 'Loading...', count: 0, country: 'Loading...' },
    { lat: -23.5505, lng: -46.6333, size: 0.7, color: '#ff9ff3', attackType: 'Loading...', count: 0, country: 'Loading...' }
  ];
  
  const dummyArcs = [
    { startLat: 39.9042, startLng: 116.4074, endLat: 37.7749, endLng: -122.4194, color: '#ff6b6b', strokeWidth: 2 },
    { startLat: 55.7558, startLng: 37.6173, endLat: 40.7128, endLng: -74.0060, color: '#feca57', strokeWidth: 2 },
    { startLat: 28.6139, startLng: 77.2090, endLat: 51.5074, endLng: -0.1278, color: '#48dbfb', strokeWidth: 2 }
  ];

  // Only show dummy data if we have no real data and are loading (initial load)
  const displayThreats = (isLoading && threats.length === 0) ? dummyThreats : threats;
  const displayArcs = (isLoading && arcs.length === 0) ? dummyArcs : arcs;

  return (
    <div className="h-screen bg-gray-900 overflow-hidden flex flex-col">
      {/* Minimal header */}
      <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border-b border-gray-600/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Global Threat Intelligence
              </h1>
              <p className="text-sm text-gray-400">3D global threat visualization and intelligence monitoring</p>
            </div>
          </div>
          
          <button
            onClick={() => window.close()}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>
        </div>
      </div>

      {/* Full-screen 3D Globe */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-600/30 shadow-2xl h-full overflow-hidden">
          <div className="p-4 h-full">
            <Globe3DFullscreen threats={displayThreats} arcs={displayArcs} isRefreshing={isRefreshing || (isLoading && threats.length === 0)} />
          </div>
        </div>
      </div>
    </div>
  );
}