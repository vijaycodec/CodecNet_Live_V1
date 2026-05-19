'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RiskMatrix } from '@/components/dashboard/risk-matrix'
import { RiskMatrix3D } from '@/components/dashboard/risk-matrix-3d'
import { SecurityMetrics } from '@/components/dashboard/security-metrics'
import { MitreAttack } from '@/components/dashboard/mitre-attack'
import { usePermissions } from '@/hooks/usePermissions'

export default function RiskMatrixPage() {
  const router = useRouter()
  const { hasPermission, isLoading } = usePermissions()
  const [authorized, setAuthorized] = useState(false)

  // Persist view selection in localStorage
  const [view, setView] = useState<'3d' | 'metrics' | 'prototype' | 'mitre'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('riskMatrix_view') as any) || '3d'
    }
    return '3d'
  })

  // Save view to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('riskMatrix_view', view)
    }
  }, [view])

  useEffect(() => {
    if (isLoading) return

    // Check if user has risk-matrix read permission
    if (hasPermission('risk-matrix', 'read')) {
      setAuthorized(true)
    } else {
      // Don't redirect immediately, just show access denied
      setAuthorized(false)
    }
  }, [hasPermission, isLoading])

  // Show loading state while checking permissions
  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to access this feature.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      {/* View Toggle */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 bg-white dark:bg-gray-800">
          <button
            onClick={() => setView('3d')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === '3d'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            3D Risk Matrix
          </button>
          <button
            onClick={() => setView('metrics')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'metrics'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Security Metrics
          </button>
          {/* <button
            onClick={() => setView('prototype')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'prototype'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Prototype View
          </button> */}
          <button
            onClick={() => setView('mitre')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'mitre'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            MITRE ATT&CK
          </button>
        </div>
      </div>

      {/* Render selected view */}
      {view === '3d' && <RiskMatrix3D />}
      {view === 'metrics' && <SecurityMetrics />}
      {view === 'prototype' && <RiskMatrix />}
      {view === 'mitre' && <MitreAttack />}
    </div>
  )
}