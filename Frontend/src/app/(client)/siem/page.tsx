'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import {
  CpuChipIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { useClient } from '@/contexts/ClientContext'
import { organisationsApi } from '@/lib/api'
import PermissionGuard from '@/components/auth/PermissionGuard'
import { getUserFromCookies } from '@/lib/auth'

interface WazuhDashboardCredentials {
  dashboard_ip: string;
  dashboard_port: number;
  dashboard_username: string;
  dashboard_password: string;
  dashboard_url: string;
  organization_name: string;
}

function SIEMPageContent() {
  const [credentials, setCredentials] = useState<WazuhDashboardCredentials | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const { selectedClient, isClientMode } = useClient()

  // Memoize the client ID to prevent unnecessary re-renders
  const clientId = useMemo(() => selectedClient?.id || null, [selectedClient?.id])

  // PATCH 33: Secure copy to clipboard handler with fallback
  const handleCopy = async (text: string, fieldName: string) => {
    try {
      // Modern Clipboard API (preferred)
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  useEffect(() => {
    const fetchWazuhCredentials = async () => {
      console.log('🔄 [SIEM] Effect running - clientId:', clientId, 'isClientMode:', isClientMode)

      // PATCH 33: Check for organisation:access:all permission for SuperAdmin/Admin
      const user = getUserFromCookies()
      const hasOrgAccessAll = user?.permissions?.organisation?.['access:all'] === true

      // For SuperAdmin/Admin with organisation:access:all OR users without client mode
      if (hasOrgAccessAll || !isClientMode || !clientId) {
        // Show default credentials immediately
        console.log('🔧 [SIEM] Setting default credentials (SuperAdmin/no client mode)')
        setCredentials({
          dashboard_ip: '122.176.142.223',
          dashboard_port: 443,
          dashboard_username: 'admin',
          dashboard_password: 'N3w.*e4.wwyTC?uYi31VqjSIT*k8d5.i',
          dashboard_url: 'https://122.176.142.223:443',
          organization_name: 'Default'
        })
        setIsLoading(false)
        return
      }

      setError(null)

      try {
        console.log('🔄 [SIEM] Fetching credentials for client:', clientId)

        const response = await organisationsApi.getOrganisationById(clientId, true) // Include credentials

        if (response.success && response.data) {
          const org = response.data

          // Construct dashboard URL
          const dashboardUrl = `https://${org.wazuh_dashboard_ip}:${org.wazuh_dashboard_port || 443}`

          setCredentials({
            dashboard_ip: org.wazuh_dashboard_ip,
            dashboard_port: org.wazuh_dashboard_port || 443,
            dashboard_username: org.wazuh_dashboard_username,
            dashboard_password: org.wazuh_dashboard_password,
            dashboard_url: dashboardUrl,
            organization_name: org.organisation_name || org.client_name
          })

          console.log(`✅ Successfully loaded Wazuh credentials for ${org.organisation_name}`)
        } else {
          throw new Error('Failed to fetch organization details')
        }
      } catch (err: any) {
        console.error('❌ Error fetching Wazuh dashboard credentials:', err)
        setError(`Failed to load SIEM credentials: ${err.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchWazuhCredentials()
  }, [clientId, isClientMode]) // Use memoized clientId

  const handleRedirect = () => {
    if (credentials?.dashboard_url) {
      console.log(`🔗 Opening Wazuh dashboard: ${credentials.dashboard_url}`)
      window.open(credentials.dashboard_url, '_blank')
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            SIEM Portal
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {isLoading
              ? 'Loading SIEM credentials...'
              : credentials?.organization_name
                ? `Access the Codec Net SIEM platform for ${credentials.organization_name}`
                : 'Access the Codec Net SIEM platform for advanced security monitoring'
            }
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && credentials && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Portal Access Card */}
        <div className="card-gradient p-6 rounded-xl">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
              <CpuChipIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                SIEM Platform
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Full-featured security monitoring
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Real-time security monitoring</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Advanced threat detection</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Comprehensive log analysis</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Incident response tools</span>
            </div>
          </div>

          <button
            onClick={handleRedirect}
            disabled={!credentials?.dashboard_url}
            className="w-full inline-flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <CpuChipIcon className="w-5 h-5 mr-2" />
            Access Codec Net Portal
            <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2" />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          {/* Username Card - PATCH 33: Secure copy functionality */}
          <div className="card-gradient p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Username</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {credentials?.dashboard_username || 'Loading...'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {credentials?.dashboard_username && (
                  <button
                    onClick={() => handleCopy(credentials.dashboard_username, 'username')}
                    title={copiedField === 'username' ? 'Copied!' : 'Copy username'}
                    className="focus:outline-none"
                  >
                    {copiedField === 'username' ? (
                      <CheckIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <ClipboardIcon className="w-5 h-5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Password Card - PATCH 33: Secure password display */}
          <div className="card-gradient p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Password</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white select-none">
                  {/* PASSWORD NEVER RENDERED IN HTML - ALWAYS BULLETS */}
                  {credentials?.dashboard_password ? '••••••••••••••••' : 'Loading...'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {credentials?.dashboard_password && (
                  <button
                    onClick={() => handleCopy(credentials.dashboard_password, 'password')}
                    title={copiedField === 'password' ? 'Copied!' : 'Copy password'}
                    className="focus:outline-none"
                  >
                    {copiedField === 'password' ? (
                      <CheckIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <ClipboardIcon className="w-5 h-5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Platform Status Card */}
          <div className="card-gradient p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Platform Status</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {credentials ? 'Online' : 'Checking...'}
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${credentials ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="card-gradient p-6 rounded-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          About Codec Net SIEM
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Codec Net SIEM is an enterprise-ready security monitoring solution for threat detection,
          integrity monitoring, incident response and compliance. It provides unified XDR and SIEM protection
          for endpoints and cloud workloads.
        </p>
        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
          <span>• Enterprise Ready</span>
          <span>• Cloud Native</span>
          <span>• Scalable</span>
        </div>
      </div>
        </>
      )}
    </div>
  )
}

export default function SIEMPage() {
  return (
    <PermissionGuard requiredPermissions={['siem:access']}>
      <SIEMPageContent />
    </PermissionGuard>
  )
}