'use client';

import React from 'react';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import PermissionGuard from '@/components/auth/PermissionGuard';
import CcManagementView from '@/components/alert-notifications/CcManagementView';

function CcManagementPage() {
  return (
    <div className="space-y-6">
      <div className="px-6 pt-6 flex items-center gap-2">
        <EnvelopeIcon className="h-6 w-6 text-blue-500 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mail CC</h1>
      </div>
      <CcManagementView />
    </div>
  );
}

export default function ProtectedCcManagement() {
  return (
    <PermissionGuard requiredPermissions={['organisation:update']}>
      <CcManagementPage />
    </PermissionGuard>
  );
}
