'use client'

import { useEffect, useState } from 'react'
import { useClient } from '@/contexts/ClientContext'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { ShieldExclamationIcon, ChartBarIcon, ClockIcon, ExclamationTriangleIcon, UserGroupIcon, ShieldCheckIcon, CpuChipIcon, ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP

interface MitreCoverageData {
  summary: {
    totalAlerts: number
    totalTactics: number
    totalTechniques: number
    timeRange: string
    coverage: {
      tactics: Array<{ tactic: string; count: number; percentage: string }>
      techniques: Array<{
        id: string
        name: string
        count: number
        tactics: string[]
        alerts: Array<{ ruleId: string; description: string; timestamp: string; agent: string }>
      }>
      timeline: Array<{ date: string; count: number; uniqueTechniques: number }>
    }
  }
}

interface MitreStatistics {
  groups: number
  mitigations: number
  software: number
  tactics: number
  techniques: number
}

interface MitreGroup {
  id: string
  name: string
  description?: string
  references: string[]
  techniques?: string[]
}

interface MitreMitigation {
  id: string
  name: string
  description?: string
  techniques?: string[]
}

interface MitreSoftware {
  id: string
  name: string
  description?: string
  type?: string
  platforms?: string[]
  techniques?: string[]
}

export function MitreAttack() {
  const { selectedClient, isClientMode } = useClient()
  const [coverage, setCoverage] = useState<MitreCoverageData | null>(null)
  const [statistics, setStatistics] = useState<MitreStatistics | null>(null)
  const [allTactics, setAllTactics] = useState<Array<{ name: string; description?: string }>>([])
  const [groups, setGroups] = useState<MitreGroup[]>([])
  const [mitigations, setMitigations] = useState<MitreMitigation[]>([])
  const [software, setSoftware] = useState<MitreSoftware[]>([])
  const [allTechniques, setAllTechniques] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>(null)
  const [expandedTechniqueDescription, setExpandedTechniqueDescription] = useState<string | null>(null)
  const [expandedTacticDescription, setExpandedTacticDescription] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [expandedMitigation, setExpandedMitigation] = useState<string | null>(null)
  const [expandedSoftware, setExpandedSoftware] = useState<string | null>(null)
  const [expandedIntelligenceGroup, setExpandedIntelligenceGroup] = useState<string | null>(null)
  const [expandedIntelligenceMitigation, setExpandedIntelligenceMitigation] = useState<string | null>(null)
  const [expandedIntelligenceSoftware, setExpandedIntelligenceSoftware] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'intelligence'>('overview')

  // Pagination states
  const [mitigationsPage, setMitigationsPage] = useState(1)
  const [groupsPage, setGroupsPage] = useState(1)
  const [softwarePage, setSoftwarePage] = useState(1)
  const [techniqueDetailsPage, setTechniqueDetailsPage] = useState(1)
  const [intelligenceGroupsPage, setIntelligenceGroupsPage] = useState(1)
  const [intelligenceMitigationsPage, setIntelligenceMitigationsPage] = useState(1)
  const [intelligenceSoftwarePage, setIntelligenceSoftwarePage] = useState(1)

  const ITEMS_PER_PAGE = 10
  const [timePeriod, setTimePeriod] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('mitre_timePeriod') || '168')
    }
    return 168
  })

  // Save time period to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mitre_timePeriod', timePeriod.toString())
    }
  }, [timePeriod])

  useEffect(() => {
    fetchData()
  }, [selectedClient?.id, isClientMode, timePeriod])

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      const params = new URLSearchParams()
      if (isClientMode && selectedClient?.id) {
        params.append('orgId', selectedClient.id)
      }
      params.append('hours', timePeriod.toString())

      const [coverageRes, statsRes, tacticsRes, techniquesRes, groupsRes, mitigationsRes, softwareRes] = await Promise.all([
        fetch(`${BASE_URL}/wazuh/mitre/coverage?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/wazuh/mitre/statistics?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/wazuh/mitre/tactics?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/wazuh/mitre/techniques?${params.toString()}&limit=10000`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/wazuh/mitre/groups?${params.toString()}&limit=10000`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/wazuh/mitre/mitigations?${params.toString()}&limit=10000`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/wazuh/mitre/software?${params.toString()}&limit=10000`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      if (coverageRes.ok && statsRes.ok && tacticsRes.ok && techniquesRes.ok) {
        const coverageData = await coverageRes.json()
        const statsData = await statsRes.json()
        const tacticsData = await tacticsRes.json()
        const techniquesData = await techniquesRes.json()

        setCoverage(coverageData.data)
        setStatistics(statsData.data)
        setAllTactics(tacticsData.data.affected_items || [])
        setAllTechniques(techniquesData.data.affected_items || [])

        if (groupsRes.ok) {
          const groupsData = await groupsRes.json()
          const groupItems = groupsData.data.affected_items || []
          setGroups(groupItems)
        }

        if (mitigationsRes.ok) {
          const mitigationsData = await mitigationsRes.json()
          const mitigationItems = mitigationsData.data.affected_items || []
          setMitigations(mitigationItems)
        }

        if (softwareRes.ok) {
          const softwareData = await softwareRes.json()
          const softwareItems = softwareData.data.affected_items || []
          setSoftware(softwareItems)
        }
      }
    } catch (error) {
      console.error('Error fetching MITRE data:', error)
    } finally {
      setLoading(false)
    }
  }


  // Prepare radar chart data - show all tactics with their counts (0 if no alerts)
  const tacticCoverageMap = coverage ? new Map(
    coverage.summary.coverage.tactics.map(t => [t.tactic, t.count])
  ) : new Map()

  const radarData = coverage ? allTactics.map(t => {
    const tacticName = t.name
    const count = tacticCoverageMap.get(tacticName) || 0
    return {
      tactic: tacticName.length > 15 ? tacticName.substring(0, 15) + '...' : tacticName,
      fullTactic: tacticName,
      count: count,
      percentage: coverage.summary.totalAlerts > 0
        ? ((count / coverage.summary.totalAlerts) * 100).toFixed(2)
        : '0.00'
    }
  }) : []

  // Prepare top techniques bar chart data
  const topTechniques = coverage ? coverage.summary.coverage.techniques.slice(0, 10).map(t => ({
    name: t.name.length > 25 ? t.name.substring(0, 25) + '...' : t.name,
    fullName: t.name,
    id: t.id,
    count: t.count
  })) : []

  // Timeline data
  const timelineData = coverage?.summary.coverage.timeline || []

  // Colors
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1']

  // Get all unique group/mitigation/software IDs from detected techniques
  const getRelatedItems = () => {
    if (!coverage) {
      return {
        relatedGroups: [],
        relatedMitigations: [],
        relatedSoftware: []
      }
    }

    const groupIds = new Set<string>()
    const mitigationIds = new Set<string>()
    const softwareIds = new Set<string>()

    coverage.summary.coverage.techniques.forEach(technique => {
      const fullTechnique = allTechniques.find(t => t.external_id === technique.id)
      if (fullTechnique) {
        fullTechnique.groups?.forEach((id: string) => groupIds.add(id))
        fullTechnique.mitigations?.forEach((id: string) => mitigationIds.add(id))
        fullTechnique.software?.forEach((id: string) => softwareIds.add(id))
      }
    })

    return {
      relatedGroups: groups.filter(g => groupIds.has(g.id)),
      relatedMitigations: mitigations.filter(m => mitigationIds.has(m.id)),
      relatedSoftware: software.filter(s => softwareIds.has(s.id))
    }
  }

  const { relatedGroups, relatedMitigations, relatedSoftware } = getRelatedItems()

  // Pagination helper component matching tickets/live-alerts style
  const Pagination = ({ currentPage, totalItems, onPageChange }: { currentPage: number, totalItems: number, onPageChange: (page: number) => void }) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-center space-x-2 mt-4">
        {/* First Page Button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
            currentPage === 1
              ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
          title="First page"
        >
          <ChevronDoubleLeftIcon className="w-4 h-4" />
        </button>

        {/* Previous Page Button */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
            currentPage === 1
              ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
          title="Previous page"
        >
          <ChevronLeftIcon className="w-4 h-4 mr-1" />
          Previous
        </button>

        {/* Page Info */}
        <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
          Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
        </span>

        {/* Next Page Button */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
            currentPage === totalPages
              ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
          title="Next page"
        >
          Next
          <ChevronRightIcon className="w-4 h-4 ml-1" />
        </button>

        {/* Last Page Button */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
            currentPage === totalPages
              ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
          title="Last page"
        >
          <ChevronDoubleRightIcon className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-gradient p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <ShieldExclamationIcon className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
              MITRE ATT&CK Coverage
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Real-time threat intelligence mapped to MITRE ATT&CK framework
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
              onClick={fetchData}
              disabled={loading}
              className="p-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg text-white transition-colors disabled:opacity-50"
              title="Refresh MITRE coverage"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && !coverage && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* No Data State */}
      {!loading && !coverage && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No MITRE ATT&CK data available</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      {coverage && statistics && (
        <>
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Coverage Overview
              </button>
              <button
                onClick={() => setActiveTab('intelligence')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'intelligence'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Threat Intelligence
              </button>
            </div>
          </div>
        </>
      )}

      {coverage && statistics && activeTab === 'overview' && (
        <>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card-gradient p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <ExclamationTriangleIcon className="w-8 h-8 text-blue-500" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{coverage.summary.totalAlerts.toLocaleString()}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Alerts</h3>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">High-severity detections</p>
        </div>
        <div className="card-gradient p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <ChartBarIcon className="w-8 h-8 text-purple-500" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{coverage.summary.totalTactics} / {statistics.tactics}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Tactics Detected</h3>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            {((coverage.summary.totalTactics / statistics.tactics) * 100).toFixed(1)}% coverage
          </p>
        </div>
        <div className="card-gradient p-6 border-l-4 border-pink-500">
          <div className="flex items-center justify-between mb-4">
            <ShieldExclamationIcon className="w-8 h-8 text-pink-500" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{coverage.summary.totalTechniques} / {statistics.techniques}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Techniques Detected</h3>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            {((coverage.summary.totalTechniques / statistics.techniques) * 100).toFixed(1)}% coverage
          </p>
        </div>
        <div className="card-gradient p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-4">
            <UserGroupIcon className="w-8 h-8 text-orange-500" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{statistics.groups}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Threat Groups</h3>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Active threat actors</p>
        </div>
        <div className="card-gradient p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-green-500" />
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{statistics.mitigations}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Mitigations</h3>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Available countermeasures</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tactics Radar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tactics Coverage
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#94a3b8" />
              <PolarAngleAxis
                dataKey="tactic"
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 'auto']}
                tick={{ fill: '#64748b', fontSize: 10 }}
              />
              <Radar
                name="Detections"
                dataKey="count"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value, name, props) => [value, props.payload.fullTactic]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Techniques Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top 10 Detected Techniques
          </h3>
          {topTechniques.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topTechniques} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={80}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value, name, props) => [
                    value,
                    `${props.payload.fullName} (${props.payload.id})`
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {topTechniques.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Detection Timeline
        </h3>
        {timelineData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="Total Alerts"
              />
              <Line
                type="monotone"
                dataKey="uniqueTechniques"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 4 }}
                name="Unique Techniques"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No data available</p>
            </div>
          </div>
        )}
      </div>

      {/* Top Techniques Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Technique Details
          </h3>
        </div>
        {coverage.summary.coverage.techniques.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Technique ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Tactics
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Detections
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {coverage.summary.coverage.techniques
                .slice((techniqueDetailsPage - 1) * ITEMS_PER_PAGE, techniqueDetailsPage * ITEMS_PER_PAGE)
                .map((technique) => {
                // Find the full technique data from allTechniques
                const fullTechnique = allTechniques.find(t => t.external_id === technique.id)

                // Get related IDs from the technique
                const relatedGroupIds = fullTechnique?.groups || []
                const relatedMitigationIds = fullTechnique?.mitigations || []
                const relatedSoftwareIds = fullTechnique?.software || []

                // Filter actual objects by matching IDs
                const relatedGroups = groups.filter(g => relatedGroupIds.includes(g.id))
                const relatedMitigations = mitigations.filter(m => relatedMitigationIds.includes(m.id))
                const relatedSoftware = software.filter(s => relatedSoftwareIds.includes(s.id))

                const isExpanded = expandedTechnique === technique.id

                return (
                  <>
                    <tr
                      key={technique.id}
                      onClick={() => setExpandedTechnique(isExpanded ? null : technique.id)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600 dark:text-blue-400">
                        <div className="flex items-center gap-2">
                          {technique.id}
                          {isExpanded ? (
                            <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {technique.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {technique.tactics.map((tactic, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                            >
                              {tactic}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {technique.count}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                          <div className="space-y-4">
                            {/* Technique Information */}
                            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                                Technique: {technique.name} ({technique.id})
                              </h4>

                              {fullTechnique?.description && (
                                <div className="mb-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description:</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedTechniqueDescription(expandedTechniqueDescription === technique.id ? null : technique.id)
                                      }}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                      {expandedTechniqueDescription === technique.id ? (
                                        <>
                                          <ChevronUpIcon className="w-3 h-3" />
                                          Show less
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDownIcon className="w-3 h-3" />
                                          Show full description
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {expandedTechniqueDescription === technique.id
                                      ? fullTechnique.description
                                      : (fullTechnique.description.length > 200
                                          ? fullTechnique.description.substring(0, 200) + '...'
                                          : fullTechnique.description)}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Tactics Information */}
                            {technique.tactics && technique.tactics.length > 0 && (
                              <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                  Tactics ({technique.tactics.length}):
                                </h4>
                                <div className="space-y-3">
                                  {technique.tactics.map((tacticName, idx) => {
                                    const tacticData = allTactics.find(t => t.name === tacticName)
                                    return (
                                      <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                            {tacticName}
                                          </span>
                                          {tacticData?.description && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setExpandedTacticDescription(expandedTacticDescription === `${technique.id}-${tacticName}` ? null : `${technique.id}-${tacticName}`)
                                              }}
                                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                            >
                                              {expandedTacticDescription === `${technique.id}-${tacticName}` ? (
                                                <>
                                                  <ChevronUpIcon className="w-3 h-3" />
                                                  Show less
                                                </>
                                              ) : (
                                                <>
                                                  <ChevronDownIcon className="w-3 h-3" />
                                                  Show description
                                                </>
                                              )}
                                            </button>
                                          )}
                                        </div>
                                        {tacticData?.description && expandedTacticDescription === `${technique.id}-${tacticName}` && (
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                            {tacticData.description}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Alert Samples */}
                            {technique.alerts && technique.alerts.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center mb-2">
                                  <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                                  Recent Alerts ({technique.alerts.length})
                                </h4>
                                <div className="space-y-2">
                                  {technique.alerts.slice(0, 3).map((alert, idx) => (
                                    <div key={idx} className="text-xs border-l-2 border-blue-500 pl-3 py-1">
                                      <div className="font-medium text-gray-900 dark:text-white">{alert.description}</div>
                                      <div className="text-gray-600 dark:text-gray-400 mt-1">
                                        Rule: {alert.ruleId} • Agent: {alert.agent || 'N/A'} • {new Date(alert.timestamp).toLocaleString()}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Related Threat Intelligence */}
                            {(relatedGroups.length > 0 || relatedMitigations.length > 0 || relatedSoftware.length > 0) && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                                {/* Related Threat Groups */}
                                {relatedGroups.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center mb-2">
                                      <UserGroupIcon className="w-4 h-4 mr-2 text-red-500" />
                                      Threat Groups ({relatedGroups.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                      {relatedGroups.slice(0, 5).map((group) => (
                                        <span key={group.id} className="px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                          {group.name}
                                        </span>
                                      ))}
                                      {relatedGroups.length > 5 && (
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                          +{relatedGroups.length - 5} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Related Mitigations */}
                                {relatedMitigations.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center mb-2">
                                      <ShieldCheckIcon className="w-4 h-4 mr-2 text-green-500" />
                                      Mitigations ({relatedMitigations.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                      {relatedMitigations.slice(0, 4).map((mitigation) => (
                                        <span key={mitigation.id} className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                          {mitigation.name.length > 25 ? mitigation.name.substring(0, 25) + '...' : mitigation.name}
                                        </span>
                                      ))}
                                      {relatedMitigations.length > 4 && (
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                          +{relatedMitigations.length - 4} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Related Software */}
                                {relatedSoftware.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center mb-2">
                                      <CpuChipIcon className="w-4 h-4 mr-2 text-orange-500" />
                                      Software ({relatedSoftware.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                      {relatedSoftware.slice(0, 5).map((soft) => (
                                        <span key={soft.id} className="px-2 py-1 text-xs rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                                          {soft.name}
                                        </span>
                                      ))}
                                      {relatedSoftware.length > 5 && (
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                          +{relatedSoftware.length - 5} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* No related intel message */}
                            {relatedGroups.length === 0 && relatedMitigations.length === 0 && relatedSoftware.length === 0 && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 border-t border-gray-200 dark:border-gray-700">
                                No related threat intelligence data available for this technique
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4">
              <Pagination
                currentPage={techniqueDetailsPage}
                totalItems={coverage.summary.coverage.techniques.length}
                onPageChange={setTechniqueDetailsPage}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No data available</p>
            </div>
          </div>
        )}
      </div>

      {/* Recommended Mitigations Section */}
      {relatedMitigations.length > 0 && (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-4">
          <ShieldCheckIcon className="w-6 h-6 text-green-500 mr-2" />
          Recommended Mitigations ({relatedMitigations.length})
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Based on detected techniques, prioritize these mitigations to improve security posture
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {relatedMitigations
            .slice((mitigationsPage - 1) * ITEMS_PER_PAGE, mitigationsPage * ITEMS_PER_PAGE)
            .map((mitigation) => {
            const isExpanded = expandedMitigation === mitigation.id
            // Count how many detected techniques this mitigation addresses
            const detectedTechniqueCount = coverage.summary.coverage.techniques.filter(t => {
              const fullTech = allTechniques.find(ft => ft.external_id === t.id)
              return fullTech?.mitigations?.includes(mitigation.id)
            }).length

            return (
              <div
                key={mitigation.id}
                onClick={() => setExpandedMitigation(isExpanded ? null : mitigation.id)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:border-green-500 dark:hover:border-green-500 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {mitigation.name}
                    {isExpanded ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                    )}
                  </h4>
                  {detectedTechniqueCount > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 whitespace-nowrap ml-2">
                      {detectedTechniqueCount} detected
                    </span>
                  )}
                </div>
                {mitigation.description && (
                  <p className={`text-xs text-gray-600 dark:text-gray-400 ${isExpanded ? '' : 'line-clamp-2'}`}>
                    {mitigation.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <Pagination
          currentPage={mitigationsPage}
          totalItems={relatedMitigations.length}
          onPageChange={setMitigationsPage}
        />
      </div>
      )}

      {/* Threat Groups Section */}
      {relatedGroups.length > 0 && (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-4">
          <UserGroupIcon className="w-6 h-6 text-red-500 mr-2" />
          Relevant Threat Actor Groups ({relatedGroups.length})
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Threat groups using techniques detected in your environment
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {relatedGroups
            .slice((groupsPage - 1) * ITEMS_PER_PAGE, groupsPage * ITEMS_PER_PAGE)
            .map((group) => {
            const isExpanded = expandedGroup === group.id
            // Count matching detected techniques
            const matchingTechniques = coverage.summary.coverage.techniques.filter(t => {
              const fullTech = allTechniques.find(ft => ft.external_id === t.id)
              return fullTech?.groups?.includes(group.id)
            }).length

            return (
              <div
                key={group.id}
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:border-red-500 dark:hover:border-red-500 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {group.name}
                    {isExpanded ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                    )}
                  </h4>
                  {matchingTechniques > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 whitespace-nowrap ml-2">
                      {matchingTechniques} matches
                    </span>
                  )}
                </div>
                {group.description && (
                  <p className={`text-xs text-gray-600 dark:text-gray-400 mt-2 ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {group.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <Pagination
          currentPage={groupsPage}
          totalItems={relatedGroups.length}
          onPageChange={setGroupsPage}
        />
      </div>
      )}

      {/* Malicious Software Section */}
      {relatedSoftware.length > 0 && (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-4">
          <CpuChipIcon className="w-6 h-6 text-orange-500 mr-2" />
          Associated Malicious Software & Tools ({relatedSoftware.length})
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Malware and tools associated with detected techniques
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {relatedSoftware
            .slice((softwarePage - 1) * ITEMS_PER_PAGE, softwarePage * ITEMS_PER_PAGE)
            .map((soft) => {
            const isExpanded = expandedSoftware === soft.id
            // Count matching detected techniques
            const matchingTechniques = coverage.summary.coverage.techniques.filter(t => {
              const fullTech = allTechniques.find(ft => ft.external_id === t.id)
              return fullTech?.software?.includes(soft.id)
            }).length

            return (
              <div
                key={soft.id}
                onClick={() => setExpandedSoftware(isExpanded ? null : soft.id)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:border-orange-500 dark:hover:border-orange-500 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {soft.name}
                    {isExpanded ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                    )}
                  </h4>
                  <div className="flex items-center gap-2 ml-2">
                    {soft.type && (
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 whitespace-nowrap">
                        {soft.type}
                      </span>
                    )}
                    {matchingTechniques > 0 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 whitespace-nowrap">
                        {matchingTechniques} matches
                      </span>
                    )}
                  </div>
                </div>
                {soft.description && (
                  <p className={`text-xs text-gray-600 dark:text-gray-400 mt-2 ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {soft.description}
                  </p>
                )}
                {soft.platforms && soft.platforms.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Platforms: {soft.platforms.join(', ')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <Pagination
          currentPage={softwarePage}
          totalItems={relatedSoftware.length}
          onPageChange={setSoftwarePage}
        />
      </div>
      )}
        </>
      )}

      {/* Threat Intelligence Tab */}
      {coverage && statistics && activeTab === 'intelligence' && (
        <div className="space-y-6">
          {/* Groups Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <UserGroupIcon className="w-5 h-5 text-red-500 mr-2" />
                Threat Actor Groups
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {groups
                    .slice((intelligenceGroupsPage - 1) * ITEMS_PER_PAGE, intelligenceGroupsPage * ITEMS_PER_PAGE)
                    .map((group) => {
                      const isExpanded = expandedIntelligenceGroup === group.id
                      return (
                        <>
                          <tr
                            key={group.id}
                            onClick={() => setExpandedIntelligenceGroup(isExpanded ? null : group.id)}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                          >
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                {group.name}
                                {isExpanded ? (
                                  <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {group.description ? (group.description.length > 250 ? group.description.substring(0, 250) + '...' : group.description) : 'No description available'}
                            </td>
                          </tr>
                          {isExpanded && group.description && (
                            <tr>
                              <td colSpan={2} className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  <p className="font-semibold mb-2">Full Description:</p>
                                  <p>{group.description}</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4">
              <Pagination
                currentPage={intelligenceGroupsPage}
                totalItems={groups.length}
                onPageChange={setIntelligenceGroupsPage}
              />
            </div>
          </div>

          {/* Mitigations Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <ShieldCheckIcon className="w-5 h-5 text-green-500 mr-2" />
                Mitigation Strategies
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {mitigations
                    .slice((intelligenceMitigationsPage - 1) * ITEMS_PER_PAGE, intelligenceMitigationsPage * ITEMS_PER_PAGE)
                    .map((mitigation) => {
                      const isExpanded = expandedIntelligenceMitigation === mitigation.id
                      return (
                        <>
                          <tr
                            key={mitigation.id}
                            onClick={() => setExpandedIntelligenceMitigation(isExpanded ? null : mitigation.id)}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                          >
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {mitigation.name}
                                {isExpanded ? (
                                  <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {mitigation.description ? (mitigation.description.length > 200 ? mitigation.description.substring(0, 200) + '...' : mitigation.description) : 'No description available'}
                            </td>
                          </tr>
                          {isExpanded && mitigation.description && (
                            <tr>
                              <td colSpan={2} className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  <p className="font-semibold mb-2">Full Description:</p>
                                  <p>{mitigation.description}</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4">
              <Pagination
                currentPage={intelligenceMitigationsPage}
                totalItems={mitigations.length}
                onPageChange={setIntelligenceMitigationsPage}
              />
            </div>
          </div>

          {/* Software Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <CpuChipIcon className="w-5 h-5 text-orange-500 mr-2" />
                Malicious Software & Tools
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {software
                    .slice((intelligenceSoftwarePage - 1) * ITEMS_PER_PAGE, intelligenceSoftwarePage * ITEMS_PER_PAGE)
                    .map((soft) => {
                      const isExpanded = expandedIntelligenceSoftware === soft.id
                      return (
                        <>
                          <tr
                            key={soft.id}
                            onClick={() => setExpandedIntelligenceSoftware(isExpanded ? null : soft.id)}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                          >
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {soft.name}
                                {isExpanded ? (
                                  <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {soft.description ? (soft.description.length > 200 ? soft.description.substring(0, 200) + '...' : soft.description) : 'No description available'}
                            </td>
                          </tr>
                          {isExpanded && soft.description && (
                            <tr>
                              <td colSpan={2} className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  <p className="font-semibold mb-2">Full Description:</p>
                                  <p>{soft.description}</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4">
              <Pagination
                currentPage={intelligenceSoftwarePage}
                totalItems={software.length}
                onPageChange={setIntelligenceSoftwarePage}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
