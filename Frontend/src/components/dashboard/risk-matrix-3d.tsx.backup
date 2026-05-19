'use client'

import { useEffect, useState } from 'react'
import { useClient } from '@/contexts/ClientContext'
import Cookies from 'js-cookie'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts'
import {
  ShieldExclamationIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  FireIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP

interface RiskMatrixItem {
  ruleGroup: string
  severity: number // 1-8 (normalized from Wazuh 8-15)
  rawSeverity: number // Original Wazuh level 8-15
  likelihood: number // 1-10
  impact: number // 1-4
  impactLabel: string // 'low' | 'medium' | 'high' | 'critical'
  riskScore: number
  riskPercentage: number
  category: 'Low' | 'Medium' | 'High' | 'Critical'
  alertCount: number
  frequency: number
  affectedAssets: number
}

interface RiskMatrixData {
  matrix: RiskMatrixItem[]
  summary: {
    totalAlerts: number
    totalAlertsInPeriod?: number
    totalRuleGroups: number
    criticalRisk: number
    highRisk: number
    mediumRisk: number
    lowRisk: number
    totalAssets: number
    timePeriodHours: number
    usingFallbackData?: boolean
  }
}

export function RiskMatrix3D() {
  const { selectedClient } = useClient()
  const [data, setData] = useState<RiskMatrixData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Persist time period in localStorage
  const [timePeriod, setTimePeriod] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('riskMatrix_timePeriod') || '24')
    }
    return 24
  })

  // Save time period to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('riskMatrix_timePeriod', timePeriod.toString())
    }
  }, [timePeriod])

  const fetchRiskMatrix = async () => {
    if (!selectedClient) return

    setLoading(true)
    setError(null)

    try {
      const token = Cookies.get('auth_token')
      const response = await fetch(
        `${BASE_URL}/risk-matrix/data?organisation_id=${selectedClient.id}&time_period_hours=${timePeriod}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const result = await response.json()
        setData(result.data)
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to fetch risk matrix data')
      }
    } catch (err: any) {
      console.error('Error fetching risk matrix:', err)
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedClient) {
      fetchRiskMatrix()
    }
  }, [selectedClient, timePeriod])

  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500 dark:text-gray-400">Please select a client to view risk matrix</p>
      </div>
    )
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Critical':
        return '#dc2626' // red-600
      case 'High':
        return '#ea580c' // orange-600
      case 'Medium':
        return '#ca8a04' // yellow-600
      case 'Low':
        return '#16a34a' // green-600
      default:
        return '#6b7280' // gray-500
    }
  }

  // Prepare data for 3D scatter plot (using size for 3rd dimension)
  const scatterData = data?.matrix.map(item => ({
    x: item.severity,
    y: item.likelihood,
    z: item.impact * 50, // Scale impact for bubble size
    name: item.ruleGroup,
    category: item.category,
    alertCount: item.alertCount,
    affectedAssets: item.affectedAssets,
    riskScore: item.riskScore,
    impactLabel: item.impactLabel
  })) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-gradient p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <ShieldExclamationIcon className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
              3D Risk Matrix
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Severity × Likelihood × Impact Analysis
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
              onClick={fetchRiskMatrix}
              disabled={loading}
              className="p-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg text-white transition-colors disabled:opacity-50"
              title="Refresh risk matrix"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Alerts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalAlerts}</p>
              </div>
              <ExclamationTriangleIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Rule Groups</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalRuleGroups}</p>
              </div>
              <FireIcon className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Critical Risk</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.summary.criticalRisk}</p>
              </div>
              <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">High Risk</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{data.summary.highRisk}</p>
              </div>
              <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Medium Risk</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{data.summary.mediumRisk}</p>
              </div>
              <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Low Risk</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.summary.lowRisk}</p>
              </div>
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Assets</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalAssets}</p>
              </div>
              <ClockIcon className="w-8 h-8 text-gray-500" />
            </div>
          </div>
        </div>
      )}

      {/* Fallback Data Warning */}
      {data?.summary.usingFallbackData && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-yellow-800 dark:text-yellow-400 font-semibold">Using Recent Alert Data</p>
              <p className="text-yellow-700 dark:text-yellow-500 text-sm mt-1">
                No alerts found in the selected {timePeriod}-hour time period. Showing risk analysis from the most recent {data.summary.totalAlerts} alerts instead.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <ArrowPathIcon className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading risk matrix data...</p>
          </div>
        </div>
      )}

      {/* 3D Risk Assessment Matrix */}
      {!loading && data && data.matrix.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            3D Risk Assessment Matrix (Severity × Likelihood × Impact)
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Each cell represents risk level. Hover to see details. Color intensity indicates risk severity.
          </p>

          {/* Risk Matrix Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* X-axis Label */}
              <div className="flex items-center mb-2">
                <div className="w-32"></div>
                <div className="flex-1 text-center">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Likelihood (Alert Frequency) →
                  </span>
                </div>
              </div>

              {/* Matrix Grid */}
              <div className="flex">
                {/* Y-axis (Severity) */}
                <div className="flex flex-col justify-center pr-4" style={{ width: '120px' }}>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 transform -rotate-90 origin-center whitespace-nowrap">
                    Severity (Level 1-8) ↑
                  </div>
                </div>

                {/* Grid Cells */}
                <div className="flex-1">
                  {/* Column Headers (Likelihood) */}
                  <div className="flex mb-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(likelihood => (
                      <div key={likelihood} className="flex-1 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                        {likelihood}
                      </div>
                    ))}
                  </div>

                  {/* Rows (Severity levels 8 to 1 - displayed as 8 to 1) */}
                  {[8, 7, 6, 5, 4, 3, 2, 1].map(severity => (
                    <div key={severity} className="flex gap-1 mb-1">
                      {/* Row Label */}
                      <div className="w-8 text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center justify-end pr-2">
                        {severity}
                      </div>

                      {/* Cells for each likelihood level */}
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(likelihood => {
                        // Find items matching this severity and likelihood (all impacts combined)
                        const matchingItems = data.matrix.filter(item =>
                          item.severity === severity &&
                          item.likelihood === likelihood
                        );

                        const totalAlerts = matchingItems.reduce((sum, item) => sum + item.alertCount, 0);
                        const highestRisk = matchingItems.length > 0
                          ? matchingItems.reduce((max, item) => item.riskScore > max.riskScore ? item : max)
                          : null;

                        // Calculate average impact from matching items or use default
                        const avgImpact = matchingItems.length > 0
                          ? matchingItems.reduce((sum, item) => sum + item.impact, 0) / matchingItems.length
                          : 2.5; // Default mid-range impact

                        // Calculate base risk score for this cell even without data
                        const baseRiskScore = severity * likelihood * avgImpact;
                        const maxRiskScore = 8 * 10 * 4; // 320
                        const baseRiskPercentage = (baseRiskScore / maxRiskScore) * 100;

                        // Determine color based on risk percentage (adjusted thresholds for better visibility)
                        let baseCategory = 'Low';
                        if (baseRiskPercentage >= 50) baseCategory = 'Critical'; // Severity 8 × Likelihood 8+ × Impact 3
                        else if (baseRiskPercentage >= 30) baseCategory = 'High';
                        else if (baseRiskPercentage >= 10) baseCategory = 'Medium';

                        const cellColor = highestRisk
                          ? getCategoryColor(highestRisk.category)
                          : getCategoryColor(baseCategory);

                        const opacity = highestRisk
                          ? Math.min(0.5 + (highestRisk.riskPercentage / 100) * 0.5, 1)
                          : Math.min(0.4 + (baseRiskPercentage / 100) * 0.6, 1);

                        return (
                          <div
                            key={`${severity}-${likelihood}`}
                            className="flex-1 h-12 border border-gray-300 dark:border-gray-600 rounded relative group cursor-pointer transition-all hover:scale-105 hover:z-10"
                            style={{
                              backgroundColor: cellColor,
                              opacity: opacity
                            }}
                            title={matchingItems.length > 0 ? `${totalAlerts} alerts` : 'No data'}
                          >
                            {/* Cell Content */}
                            {matchingItems.length > 0 && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-gray-900 dark:text-white">
                                  {totalAlerts}
                                </span>
                              </div>
                            )}

                            {/* Hover Tooltip */}
                            {matchingItems.length > 0 && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 min-w-max">
                                  <p className="text-xs font-bold text-gray-900 dark:text-white mb-1">
                                    Severity {severity} × Likelihood {likelihood}
                                  </p>
                                  <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                                  {matchingItems.map((item, idx) => (
                                    <div key={idx} className="text-xs mb-1">
                                      <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                        {item.ruleGroup}
                                      </p>
                                      <p className="text-gray-600 dark:text-gray-400">
                                        Impact: {item.impactLabel} • {item.alertCount} alerts • Risk: {item.riskScore}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium mr-2">Risk Levels:</span>
                {/* <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gray-500"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Info</span>
                </div> */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: getCategoryColor('Low') }}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Low</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: getCategoryColor('Medium') }}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: getCategoryColor('High') }}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">High</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: getCategoryColor('Critical') }}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Critical</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Table */}
      {!loading && data && data.matrix.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Detailed Risk Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Rule Group</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Severity</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Likelihood</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Impact</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Risk Score</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Alerts</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Affected Assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.matrix.slice(0, 20).map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{item.ruleGroup}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {item.severity}/8 <span className="text-gray-500">({item.rawSeverity})</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.likelihood}/10</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.impactLabel === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        item.impactLabel === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                        item.impactLabel === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {item.impactLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{item.riskScore}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        item.category === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        item.category === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                        item.category === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.alertCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.affectedAssets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.matrix.length > 20 && (
            <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              Showing top 20 of {data.matrix.length} rule groups
            </div>
          )}
        </div>
      )}

      {/* No Data State */}
      {!loading && data && data.matrix.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-lg border border-gray-200 dark:border-gray-700 text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">No risk data available for the selected time period</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Try selecting a different time range</p>
        </div>
      )}
    </div>
  )
}
