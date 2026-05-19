'use client';

import React from 'react';
import { ThreatDataProvider, useThreatData } from '../../contexts/ThreatDataContext';
import { Map2DFullscreen } from '../../components/dashboard/map-2d-fullscreen';
import { useClient } from '@/contexts/ClientContext';

export default function AttackVectorsPage() {
  const { selectedClient, isClientMode } = useClient();

  // Get organization ID for client-specific threat data
  const orgId = isClientMode && selectedClient?.id ? selectedClient.id : undefined;

  return (
    <ThreatDataProvider refreshInterval={120000} orgId={orgId}>
      <AttackVectorsContent />
    </ThreatDataProvider>
  );
}

function AttackVectorsContent() {
  const { attacks, serverLocations, isRefreshing, isLoading } = useThreatData();

  // Dummy data for loading state
  const dummyAttacks = [
    { id: 'dummy-1', sourceIp: '***.***.***', sourceLat: 39.9042, sourceLng: 116.4074, sourceCountry: 'Loading...', targetIp: '***.***.***', targetLat: 37.7749, targetLng: -122.4194, targetCountry: 'Loading...', attackType: 'Loading...', severity: 'major' as const, timestamp: new Date() },
    { id: 'dummy-2', sourceIp: '***.***.***', sourceLat: 55.7558, sourceLng: 37.6173, sourceCountry: 'Loading...', targetIp: '***.***.***', targetLat: 40.7128, targetLng: -74.0060, targetCountry: 'Loading...', attackType: 'Loading...', severity: 'critical' as const, timestamp: new Date() },
    { id: 'dummy-3', sourceIp: '***.***.***', sourceLat: 28.6139, sourceLng: 77.2090, sourceCountry: 'Loading...', targetIp: '***.***.***', targetLat: 51.5074, targetLng: -0.1278, targetCountry: 'Loading...', attackType: 'Loading...', severity: 'minor' as const, timestamp: new Date() }
  ];
  
  const dummyServerLocations = [
    { ip: '***.***.***', lat: 37.7749, lng: -122.4194, country: 'Loading...' },
    { ip: '***.***.***', lat: 40.7128, lng: -74.0060, country: 'Loading...' },
    { ip: '***.***.***', lat: 51.5074, lng: -0.1278, country: 'Loading...' }
  ];

  // Only show dummy data if we have no real data and are loading (initial load)
  const displayAttacks = (isLoading && attacks.length === 0) ? dummyAttacks : attacks;
  const displayServerLocations = (isLoading && serverLocations.length === 0) ? dummyServerLocations : serverLocations;

  return (
    <div className="h-screen bg-gray-900 overflow-hidden flex flex-col">
      {/* Minimal header */}
      <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border-b border-gray-600/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-lg border border-red-500/30">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Live Attack Vectors
              </h1>
              <p className="text-sm text-gray-400">Real-time attack flow monitoring and visualization</p>
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

      {/* Full-screen 2D Map */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-600/30 shadow-2xl h-full overflow-hidden">
          <div className="p-4 h-full">
            <Map2DFullscreen attacks={displayAttacks} isRefreshing={isRefreshing || (isLoading && attacks.length === 0)} serverLocations={displayServerLocations} />
          </div>
        </div>
      </div>
    </div>
  );
}