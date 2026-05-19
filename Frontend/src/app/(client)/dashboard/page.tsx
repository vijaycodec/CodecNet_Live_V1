'use client';

import { Dashboard } from '@/components/dashboard/dashboard';
import { ThreatDataProvider } from '@/contexts/ThreatDataContext';
import { useClient } from '@/contexts/ClientContext';

export default function DashboardPage() {
  const { selectedClient, isClientMode } = useClient();

  // Get organization ID for client-specific threat data
  const orgId = isClientMode && selectedClient?.id ? selectedClient.id : undefined;

  return (
    <ThreatDataProvider refreshInterval={60000} orgId={orgId}>
      <Dashboard />
    </ThreatDataProvider>
  );
} 