'use client'

import { useState, useEffect } from 'react'
import { useClient } from '@/contexts/ClientContext'
import { Shield, AlertTriangle, Clock, Activity, TrendingUp, CheckCircle } from 'lucide-react'
import { ShieldExclamationIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Cookies from 'js-cookie'

const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP

interface SecurityMetricsData {
  threatsBlocked: {
    total: number
    bySeverity: {
      critical: number
      major: number
      minor: number
    }
  }
  incidentsClosed: number
  incidentsOpened: number
  mttr: {
    hours: number
    minutes: number
    formatted: string
    bySeverity: {
      critical: { hours: number; minutes: number; formatted: string; count: number }
      major: { hours: number; minutes: number; formatted: string; count: number }
      minor: { hours: number; minutes: number; formatted: string; count: number }
    }
  }
  activeThreats: number
  topAttackTypes: Array<{
    type: string
    count: number
  }>
  responseRate: number
  timePeriod: {
    hours: number
    startTime: string
    endTime: string
  }
}

export function SecurityMetrics() {
  const { selectedClient } = useClient()
  const [data, setData] = useState<SecurityMetricsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Persist time period in localStorage
  const [timePeriod, setTimePeriod] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('securityMetrics_timePeriod') || '24')
    }
    return 24
  })

  // Save time period to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('securityMetrics_timePeriod', timePeriod.toString())
    }
  }, [timePeriod])

  useEffect(() => {
    if (selectedClient?.id) {
      fetchMetrics()
    }
  }, [selectedClient?.id, timePeriod])

  const fetchMetrics = async () => {
    if (!selectedClient?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const token = Cookies.get('auth_token')
      const response = await fetch(
        `${BASE_URL}/security-metrics/dashboard?organisation_id=${selectedClient.id}&time_period_hours=${timePeriod}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setData(result.data)
        } else {
          setError(result.message || 'Failed to fetch metrics')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to fetch security metrics')
      }
    } catch (err: any) {
      console.error('Error fetching security metrics:', err)
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Period Selector */}
      <div className="card-gradient p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Shield className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
              Security Metrics Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Real-time security performance indicators
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Time Period Selector */}
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(parseInt(e.target.value))}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Last Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={168}>Last 7 Days</option>
              <option value={720}>Last 30 Days</option>
              <option value={2160}>Last 90 Days</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="p-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg text-white transition-colors disabled:opacity-50"
              title="Refresh metrics"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* No Data State */}
      {!loading && !data && !error && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No security metrics available
        </div>
      )}

      {/* Metrics Content */}
      {data && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Threats Blocked */}
        <div className="card-gradient p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-4">
            <Shield className="w-8 h-8 text-red-500" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{data.threatsBlocked.total}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Threats Blocked</h3>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">Critical: {data.threatsBlocked.bySeverity.critical}</span>
            <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">Major: {data.threatsBlocked.bySeverity.major}</span>
            <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">Minor: {data.threatsBlocked.bySeverity.minor}</span>
          </div>
        </div>

        {/* Incidents Closed */}
        <div className="card-gradient p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{data.incidentsClosed}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Incidents Closed</h3>
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            {data.incidentsOpened} opened • {data.responseRate}% response rate
          </p>
        </div>

        {/* MTTR */}
        <div className="card-gradient p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 text-blue-500" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{data.mttr.formatted}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Mean Time to Response</h3>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">Critical: {data.mttr.bySeverity.critical.formatted}</span>
            <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">Major: {data.mttr.bySeverity.major.formatted}</span>
            <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">Minor: {data.mttr.bySeverity.minor.formatted}</span>
          </div>
        </div>

        {/* Active Threats */}
        <div className="card-gradient p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8 text-orange-500" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{data.activeThreats}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Threat Types</h3>
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            Unique rule groups detected
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Threats by Severity
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Critical</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {data.threatsBlocked.bySeverity.critical}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${data.threatsBlocked.total > 0 ? ((data.threatsBlocked.bySeverity.critical / data.threatsBlocked.total) * 100).toFixed(2) : 0}%`
                  }}
                  key={`critical-${data.threatsBlocked.bySeverity.critical}`}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Major</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {data.threatsBlocked.bySeverity.major}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-orange-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${data.threatsBlocked.total > 0 ? ((data.threatsBlocked.bySeverity.major / data.threatsBlocked.total) * 100).toFixed(2) : 0}%`
                  }}
                  key={`major-${data.threatsBlocked.bySeverity.major}`}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Minor</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {data.threatsBlocked.bySeverity.minor}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${data.threatsBlocked.total > 0 ? ((data.threatsBlocked.bySeverity.minor / data.threatsBlocked.total) * 100).toFixed(2) : 0}%`
                  }}
                  key={`minor-${data.threatsBlocked.bySeverity.minor}`}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Attack Types */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Attack Types
          </h3>
          {data.topAttackTypes && data.topAttackTypes.length > 0 ? (
            <div className="space-y-3">
              {data.topAttackTypes.map((attack, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {attack.type}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white ml-2">
                    {attack.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Response Rate Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Incident Response Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Incidents Opened</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.incidentsOpened}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Incidents Closed</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{data.incidentsClosed}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Response Rate</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{data.responseRate}%</p>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
