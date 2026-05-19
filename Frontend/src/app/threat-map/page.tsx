'use client';

import { AttackMap } from '../../components/dashboard/attack-map';
import { ThreatDataProvider } from '../../contexts/ThreatDataContext';
import { useClient } from '@/contexts/ClientContext';

export default function ThreatMapPage() {
  const { selectedClient, isClientMode } = useClient();

  // Get organization ID for client-specific threat data
  const orgId = isClientMode && selectedClient?.id ? selectedClient.id : undefined;

  return (
    <ThreatDataProvider refreshInterval={60000} orgId={orgId}>
      <div className="h-screen bg-gray-900 overflow-hidden flex flex-col">
        {/* Minimal header */}
        <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border-b border-gray-600/30 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-500/30">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Global Threat Map
                </h1>
                <p className="text-sm text-gray-400">Live attack vectors and threat intelligence monitoring</p>
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

        {/* Full-screen Attack Map */}
        <div className="flex-1 p-2 overflow-hidden">
          <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-600/30 shadow-2xl h-full overflow-hidden">
            <div className="h-full">
              <AttackMap />
            </div>
          </div>
        </div>
      </div>
    </ThreatDataProvider>
  );
}