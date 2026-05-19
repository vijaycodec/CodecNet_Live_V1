'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  EnvelopeIcon,
  ListBulletIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import PermissionGuard from '@/components/auth/PermissionGuard';
import EmailLogsView from '@/components/alert-notifications/EmailLogsView';
import CcManagementView from '@/components/alert-notifications/CcManagementView';

type TabKey = 'logs' | 'cc';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'logs', label: 'Logs', icon: ListBulletIcon },
  { key: 'cc', label: 'Mail CC', icon: UserPlusIcon },
];

function EmailHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab: TabKey = (searchParams?.get('tab') as TabKey) === 'cc' ? 'cc' : 'logs';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Keep URL in sync (without full navigation) so refresh/bookmarks land on the right tab
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams?.entries() || []));
    params.set('tab', activeTab);
    router.replace(`/alert-notifications?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="px-6 pt-6 flex items-center gap-2">
        <EnvelopeIcon className="h-6 w-6 text-blue-500 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Email</h1>
      </div>

      <div className="px-6 border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  'inline-flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content - views already include their own padding wrapper */}
      <div className="-mt-6">
        {activeTab === 'logs' && <EmailLogsView />}
        {activeTab === 'cc' && <CcManagementView />}
      </div>
    </div>
  );
}

export default function ProtectedEmailHub() {
  return (
    <PermissionGuard requiredPermissions={['organisation:update']}>
      <EmailHub />
    </PermissionGuard>
  );
}
