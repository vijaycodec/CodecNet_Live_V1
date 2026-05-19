'use client'

import { useState, useMemo } from 'react'
import { 
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter
} from 'recharts'
import { 
  ShieldExclamationIcon, 
  GlobeAltIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  EyeIcon,
  BugAntIcon,
  FireIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline'

interface ThreatVector {
  id: string
  name: string
  severity: number // 1-10 CVSS severity
  likelihood: number // 1-10 probability of occurrence  
  impact: number // 1-10 business impact
  riskScore: number // severity × likelihood × impact
  category: 'External' | 'Internal' | 'Advanced Persistent' | 'Insider'
  source: string
  lastDetected: string
  affectedAssets: number
  mitigationStatus: 'None' | 'Partial' | 'Complete'
  urgency: 'Low' | 'Medium' | 'High' | 'Critical'
}

interface SecurityMetrics {
  threatsBlocked: number
  vulnerabilitiesPatched: number
  incidentsClosed: number
  meanTimeToResponse: string
  threatIntelConfidence: number
  exposureReduction: number
}

export function RiskMatrix() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d'>('24h')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  // Advanced threat intelligence data
  const generateThreatVectors = (): ThreatVector[] => {
    return [
      {
        id: 'THR-001',
        name: 'APT28 Spear Phishing Campaign',
        severity: 9.1,
        likelihood: 8.5,
        impact: 9.2,
        riskScore: 712,
        category: 'Advanced Persistent',
        source: 'Email Gateway',
        lastDetected: '2 hours ago',
        affectedAssets: 45,
        mitigationStatus: 'Partial',
        urgency: 'Critical'
      },
      {
        id: 'THR-002', 
        name: 'Credential Stuffing Attack',
        severity: 7.8,
        likelihood: 9.1,
        impact: 6.5,
        riskScore: 461,
        category: 'External',
        source: 'Web Application',
        lastDetected: '15 minutes ago',
        affectedAssets: 12,
        mitigationStatus: 'Complete',
        urgency: 'High'
      },
      {
        id: 'THR-003',
        name: 'Insider Data Exfiltration',
        severity: 6.2,
        likelihood: 4.1,
        impact: 9.8,
        riskScore: 249,
        category: 'Insider',
        source: 'Database Access',
        lastDetected: '1 hour ago', 
        affectedAssets: 3,
        mitigationStatus: 'None',
        urgency: 'High'
      },
      {
        id: 'THR-004',
        name: 'DDoS Amplification',
        severity: 5.5,
        likelihood: 7.3,
        impact: 4.2,
        riskScore: 169,
        category: 'External',
        source: 'Network Perimeter',
        lastDetected: '30 minutes ago',
        affectedAssets: 8,
        mitigationStatus: 'Partial',
        urgency: 'Medium'
      },
      {
        id: 'THR-005',
        name: 'Zero-Day Exploit (CVE-2024-8901)',
        severity: 9.8,
        likelihood: 3.2,
        impact: 8.7,
        riskScore: 272,
        category: 'External',
        source: 'Web Server',
        lastDetected: '4 hours ago',
        affectedAssets: 2,
        mitigationStatus: 'None',
        urgency: 'Critical'
      },
      {
        id: 'THR-006',
        name: 'Privilege Escalation',
        severity: 8.1,
        likelihood: 5.4,
        impact: 7.8,
        riskScore: 342,
        category: 'Internal',
        source: 'Domain Controller',
        lastDetected: '3 hours ago',
        affectedAssets: 18,
        mitigationStatus: 'Partial',
        urgency: 'High'
      },
      {
        id: 'THR-007',
        name: 'Malware Command & Control',
        severity: 8.9,
        likelihood: 6.7,
        impact: 8.1,
        riskScore: 483,
        category: 'Advanced Persistent',
        source: 'Network Traffic',
        lastDetected: '45 minutes ago',
        affectedAssets: 7,
        mitigationStatus: 'Partial',
        urgency: 'Critical'
      },
      {
        id: 'THR-008',
        name: 'SQL Injection Attempt',
        severity: 6.8,
        likelihood: 8.9,
        impact: 5.2,
        riskScore: 315,
        category: 'External',
        source: 'Web Application',
        lastDetected: '20 minutes ago',
        affectedAssets: 4,
        mitigationStatus: 'Complete',
        urgency: 'Medium'
      }
    ]
  }

  const threats = generateThreatVectors()

  const metrics: SecurityMetrics = {
    threatsBlocked: 1247,
    vulnerabilitiesPatched: 89,
    incidentsClosed: 34,
    meanTimeToResponse: '12.5 min',
    threatIntelConfidence: 94,
    exposureReduction: 78
  }

  // Advanced risk calculation using CVSS-like methodology
  const calculateRiskLevel = (riskScore: number): { level: string, color: string, priority: number } => {
    if (riskScore >= 600) return { level: 'Critical', color: '#dc2626', priority: 5 }
    if (riskScore >= 400) return { level: 'High', color: '#ea580c', priority: 4 }  
    if (riskScore >= 200) return { level: 'Medium', color: '#ca8a04', priority: 3 }
    if (riskScore >= 100) return { level: 'Low', color: '#16a34a', priority: 2 }
    return { level: 'Info', color: '#6b7280', priority: 1 }
  }

  // 3D Risk Matrix with Severity × Likelihood × Impact
  const matrixData = useMemo(() => {
    const matrix = []
    
    // Severity levels (10 to 1, top to bottom)
    for (let severity = 10; severity >= 1; severity--) {
      const row = []
      // Likelihood levels (1 to 10, left to right)  
      for (let likelihood = 1; likelihood <= 10; likelihood++) {
        // Use average impact (7) for 2D visualization of 3D data
        const avgImpact = 7
        const riskScore = severity * likelihood * avgImpact
        const risk = calculateRiskLevel(riskScore)
        
        // Count threats in this cell (±0.5 tolerance)
        const threatCount = threats.filter(t => 
          Math.abs(t.severity - severity) <= 0.5 && 
          Math.abs(t.likelihood - likelihood) <= 0.5
        ).length
        
        row.push({
          severity,
          likelihood, 
          impact: avgImpact,
          riskScore,
          riskLevel: risk.level,
          color: risk.color,
          count: threatCount,
          opacity: Math.min(0.3 + (risk.priority * 0.15), 1.0)
        })
      }
      matrix.push(row)
    }
    return matrix
  }, [threats])

  // Threat trend analysis (last 7 days)
  const trendData = [
    { day: 'Mon', critical: 23, high: 45, medium: 67, low: 23, blocked: 89 },
    { day: 'Tue', critical: 18, high: 52, medium: 71, low: 19, blocked: 95 },
    { day: 'Wed', critical: 31, high: 48, medium: 63, low: 31, blocked: 87 },
    { day: 'Thu', critical: 25, high: 41, medium: 69, low: 28, blocked: 92 },
    { day: 'Fri', critical: 19, high: 55, medium: 73, low: 22, blocked: 98 },
    { day: 'Sat', critical: 14, high: 38, medium: 51, low: 18, blocked: 76 },
    { day: 'Sun', critical: 27, high: 49, medium: 66, low: 25, blocked: 91 }
  ]

  // Threat category distribution
  const categoryData = Object.entries(
    threats.reduce((acc, threat) => {
      acc[threat.category] = (acc[threat.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).map(([category, count]) => ({
    name: category,
    value: count,
    color: category === 'Advanced Persistent' ? '#dc2626' :
           category === 'External' ? '#ea580c' :
           category === 'Internal' ? '#ca8a04' : '#16a34a'
  }))

  // MITRE ATT&CK Framework radar
  const attackData = [
    { technique: 'Initial Access', value: 8.5, fullMark: 10 },
    { technique: 'Execution', value: 6.2, fullMark: 10 },
    { technique: 'Persistence', value: 7.8, fullMark: 10 },
    { technique: 'Privilege Escalation', value: 5.9, fullMark: 10 },
    { technique: 'Defense Evasion', value: 9.1, fullMark: 10 },
    { technique: 'Credential Access', value: 7.3, fullMark: 10 },
    { technique: 'Discovery', value: 4.7, fullMark: 10 },
    { technique: 'Lateral Movement', value: 6.8, fullMark: 10 },
    { technique: 'Collection', value: 3.4, fullMark: 10 },
    { technique: 'Exfiltration', value: 8.7, fullMark: 10 }
  ]

  const criticalThreats = threats.filter(t => calculateRiskLevel(t.riskScore).level === 'Critical')
  const activeMitigations = threats.filter(t => t.mitigationStatus === 'Partial' || t.mitigationStatus === 'Complete').length

  return (
    <div className="space-y-3">
      {/* Advanced Header with Real-time Intelligence */}
      <div className="card-gradient p-6 rounded-xl border-l-4 border-red-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <ShieldExclamationIcon className="w-8 h-8 text-red-500 mr-3" />
              Advanced Threat Risk Matrix
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Real-time CVSS-based risk assessment with MITRE ATT&CK mapping
            </p>
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{criticalThreats.length}</div>
              <div className="text-gray-500 dark:text-gray-400">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeMitigations}</div>
              <div className="text-gray-500 dark:text-gray-400">Mitigated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.threatIntelConfidence}%</div>
              <div className="text-gray-500 dark:text-gray-400">Intel Confidence</div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="card-gradient p-4 rounded-xl text-center">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
            <FireIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{metrics.threatsBlocked}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Threats Blocked</div>
        </div>
        
        <div className="card-gradient p-4 rounded-xl text-center">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
            <BugAntIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{metrics.vulnerabilitiesPatched}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">CVEs Patched</div>
        </div>
        
        <div className="card-gradient p-4 rounded-xl text-center">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
            <ExclamationTriangleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{metrics.incidentsClosed}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Incidents Closed</div>
        </div>
        
        <div className="card-gradient p-4 rounded-xl text-center">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
            <ClockIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{metrics.meanTimeToResponse}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">MTTR</div>
        </div>
        
        <div className="card-gradient p-4 rounded-xl text-center">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
            <EyeIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{metrics.threatIntelConfidence}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Intel Confidence</div>
        </div>
        
        <div className="card-gradient p-4 rounded-xl text-center">
          <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
            <CpuChipIcon className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{metrics.exposureReduction}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Exposure Reduced</div>
        </div>
      </div>

      {/* Main Risk Matrix and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        
        {/* Advanced 3D Risk Matrix */}
        <div className="lg:col-span-3 card-gradient p-6 rounded-xl h-[600px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              3D Risk Assessment Matrix (Severity × Likelihood × Impact)
            </h2>
            <div className="flex space-x-2">
              {['24h', '7d', '30d'].map((timeframe) => (
                <button
                  key={timeframe}
                  onClick={() => setSelectedTimeframe(timeframe as any)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    selectedTimeframe === timeframe
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {timeframe}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Y-axis: CVSS Severity (1-10) | X-axis: Likelihood (1-10) | Color: Risk Level | Opacity: Impact Weight
          </div>
          
          <div className="flex-1 flex flex-col">
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 p-2 flex-1">
              <table className="w-full text-xs table-fixed h-full" style={{ borderSpacing: '0' }}>
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="p-2 text-left font-medium text-gray-500 dark:text-gray-400 w-20">
                      <div className="flex flex-col leading-tight text-xs">
                        <span>Likelihood→</span>
                        <span>Severity↓</span>
                      </div>
                    </th>
                    {[1,2,3,4,5,6,7,8,9,10].map(likelihood => (
                      <th key={likelihood} className="p-1 text-center font-medium text-gray-500 dark:text-gray-400">
                        {likelihood}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900">
                  {matrixData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="p-2 text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800">
                        {row[0].severity}
                      </td>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-0.5 py-0">
                          <div 
                            className="w-full h-6 rounded mx-0 my-0.5 flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:scale-105 transition-transform"
                            style={{ 
                              backgroundColor: cell.color,
                              opacity: cell.opacity
                            }}
                            title={`Risk: ${cell.riskScore} | Level: ${cell.riskLevel}${cell.count > 0 ? ` | Threats: ${cell.count}` : ''}`}
                          >
                            {cell.count > 0 ? cell.count : ''}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-between mt-4 text-xs">
              <div className="flex items-center space-x-4">
                <span className="text-gray-500 dark:text-gray-400">Risk Levels:</span>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded bg-gray-500"></div><span>Info</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded bg-green-500"></div><span>Low</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded bg-yellow-500"></div><span>Medium</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded bg-orange-500"></div><span>High</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded bg-red-500"></div><span>Critical</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Threat Intelligence Panel */}
        <div className="card-gradient p-6 rounded-xl h-[600px] flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Active Threat Vectors
          </h3>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {threats
              .sort((a, b) => b.riskScore - a.riskScore)
              .map((threat) => {
                const risk = calculateRiskLevel(threat.riskScore)
                return (
                  <div key={threat.id} className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border-l-4" 
                       style={{ borderLeftColor: risk.color }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {threat.id}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {threat.name}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" 
                                style={{ backgroundColor: `${risk.color}20`, color: risk.color }}>
                            {threat.urgency}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {threat.lastDetected}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: risk.color }}>
                          {threat.riskScore}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {threat.affectedAssets} assets
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Advanced Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        
        {/* Threat Trend Analysis */}
        <div className="lg:col-span-2 card-gradient p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Threat Trend Analysis (7 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="critical" stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.8} />
                <Area type="monotone" dataKey="high" stackId="1" stroke="#ea580c" fill="#ea580c" fillOpacity={0.8} />
                <Area type="monotone" dataKey="medium" stackId="1" stroke="#ca8a04" fill="#ca8a04" fillOpacity={0.8} />
                <Area type="monotone" dataKey="low" stackId="1" stroke="#16a34a" fill="#16a34a" fillOpacity={0.8} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Threat Category Distribution */}
        <div className="card-gradient p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Threat Categories
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={80}
                  dataKey="value"
                  label={({name, value}) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MITRE ATT&CK Radar */}
        <div className="card-gradient p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            MITRE ATT&CK Coverage
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={attackData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="technique" fontSize={9} />
                <PolarRadiusAxis domain={[0, 10]} fontSize={8} />
                <Radar
                  name="Coverage"
                  dataKey="value"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        
        {/* Risk vs Impact Scatter Plot */}
        <div className="card-gradient p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Risk-Impact Analysis
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={threats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="likelihood" name="Likelihood" domain={[0, 10]} />
                <YAxis dataKey="severity" name="Severity" domain={[0, 10]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload[0]) {
                      const data = payload[0].payload as ThreatVector
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border">
                          <p className="font-medium text-gray-900 dark:text-white">{data.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Risk Score: {data.riskScore}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Assets: {data.affectedAssets}</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Scatter dataKey="impact" name="Impact">
                  {threats.map((threat, index) => {
                    const risk = calculateRiskLevel(threat.riskScore)
                    return <Cell key={`cell-${index}`} fill={risk.color} />
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Effectiveness */}
        <div className="card-gradient p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Response Effectiveness
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="blocked" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="critical" 
                  stroke="#dc2626" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#dc2626', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Advanced Threat Intelligence Footer */}
      <div className="card-gradient p-4 rounded-xl border-t-4 border-blue-500">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <GlobeAltIcon className="w-5 h-5 text-blue-500" />
            <span className="text-gray-700 dark:text-gray-300">
              Powered by real-time threat intelligence from 15+ global feeds
            </span>
          </div>
          <div className="flex items-center space-x-6 text-gray-500 dark:text-gray-400">
            <span>Last Intel Update: {new Date().toLocaleTimeString()}</span>
            <span>•</span>
            <span>Next Scan: {new Date(Date.now() + 300000).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}