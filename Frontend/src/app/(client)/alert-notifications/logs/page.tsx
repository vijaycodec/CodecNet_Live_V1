'use client';

import React from 'react';
import { ListBulletIcon } from '@heroicons/react/24/outline';
import PermissionGuard from '@/components/auth/PermissionGuard';
import EmailLogsView from '@/components/alert-notifications/EmailLogsView';

function EmailLogsPage() {
  return (
    <div className="space-y-6">
      <div className="px-6 pt-6 flex items-center gap-2">
        <ListBulletIcon className="h-6 w-6 text-blue-500 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Email Notification Logs</h1>
      </div>
      <EmailLogsView />
    </div>
  );
}

export default function ProtectedEmailLogs() {
  return (
    <PermissionGuard requiredPermissions={['organisation:update']}>
      <EmailLogsPage />
    </PermissionGuard>
  );
}
