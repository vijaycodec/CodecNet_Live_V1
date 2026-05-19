'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { useClient } from '@/contexts/ClientContext'
import { usePermissions } from '@/hooks/usePermissions'
import { wazuhApi, organisationsApi } from '@/lib/api'
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import {
  ShieldCheckIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  HeartIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  CogIcon,
  ScaleIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline'

interface ComplianceFramework {
  id: string
  name: string
  title: string
  description: string
  icon: React.ComponentType<any>
  requirements: ComplianceRequirement[]
  hasWazuhLink: boolean
  wazuhPath?: string
}

interface ComplianceRequirement {
  id: string
  title: string
  goals: string
  description: string
  status: string
  severity: string
  alertCount: number
  ruleCount: number
  rules: Array<{
    id: number
    description: string
    level: number
    status: string
    filename: string
  }>
}

const complianceFrameworks: ComplianceFramework[] = [
  {
    id: 'pci-dss',
    name: 'PCI DSS',
    title: 'PCI DSS',
    description: 'Global security standard for entities that process, store, or transmit payment cardholder data.',
    icon: ShieldCheckIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/pci-dss#/overview/?tab=pci&tabView=inventory&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    title: 'GDPR',
    description: 'General Data Protection Regulation (GDPR) sets guidelines for processing of personal data.',
    icon: ChartBarIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/gdpr#/overview/?tab=gdpr&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    title: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act of 1996 (HIPAA) provides data privacy and security provisions for safeguarding medical information.',
    icon: HeartIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/hipaa#/overview/?tab=hipaa&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'nist-800-53',
    name: 'NIST 800-53',
    title: 'NIST 800-53',
    description: 'National Institute of Standards and Technology Special Publication 800-53 (NIST 800-53) sets guidelines for federal information systems.',
    icon: DocumentTextIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/nist-800-53#/overview/?tab=nist&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'tsc',
    name: 'TSC',
    title: 'TSC',
    description: 'Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality, and Privacy.',
    icon: ClipboardDocumentListIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/tsc#/overview/?tab=tsc&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'rbi',
    name: 'RBI',
    title: 'RBI',
    description: 'Reserve Bank of India guidelines for financial institutions and banking sector cybersecurity compliance.',
    icon: BanknotesIcon,
    requirements: [],
    hasWazuhLink: false
  },
  {
    id: 'irdai',
    name: 'IRDAI',
    title: 'IRDAI',
    description: 'Insurance Regulatory and Development Authority of India guidelines for insurance sector data protection and security.',
    icon: BuildingOfficeIcon,
    requirements: [],
    hasWazuhLink: false
  },
  {
    id: 'iso27001',
    name: 'ISO27001',
    title: 'ISO 27001',
    description: 'International standard for information security management systems (ISMS) providing a framework for establishing, implementing, maintaining and continually improving information security.',
    icon: CogIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: ''
  },
  {
    id: 'sebi',
    name: 'SEBI',
    title: 'SEBI',
    description: 'Securities and Exchange Board of India guidelines for capital markets and securities sector cybersecurity compliance.',
    icon: ScaleIcon,
    requirements: [],
    hasWazuhLink: false
  },
  {
    id: 'gpg13',
    name: 'GPG13',
    title: 'GPG13',
    description: 'German government security guidelines for protecting information and communications technology systems.',
    icon: ShieldExclamationIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/gpg13#/overview/?tab=gpg13&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  }
]

// Function to get dynamic Wazuh IP from backend configuration
const getWazuhHost = async (clientId: string | null, isClientMode: boolean) => {
  try {
    if (!isClientMode || !clientId) {
      // Default credentials for non-client mode
      return '122.176.142.223:443'
    }

    // Fetch organization details with credentials
    const response = await organisationsApi.getOrganisationById(clientId, true)

    if (response.success && response.data) {
      const org = response.data
      const port = org.wazuh_dashboard_port || 443
      return `${org.wazuh_dashboard_ip}:${port}`
    }
  } catch (error) {
    console.error('Error fetching Wazuh config for client:', error)
  }

  // Fallback to default
  return '122.176.142.223:443'
}

export default function FrameworkDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { selectedClient, isClientMode } = useClient()
  const { hasPermission } = usePermissions()

  // Persist filters in localStorage
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('compliance_searchTerm') || ''
    }
    return ''
  })
  const [hideNoAlerts, setHideNoAlerts] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('compliance_hideNoAlerts') === 'true'
    }
    return false
  })

  // Time range filters
  const [timeRangeType, setTimeRangeType] = useState<'relative' | 'absolute'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('compliance_timeRangeType') as any) || 'relative'
    }
    return 'relative'
  })
  const [relativeHours, setRelativeHours] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('compliance_relativeHours') || '168') // Default 7 days
    }
    return 168
  })
  const [fromDate, setFromDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('compliance_fromDate')
      return saved || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    }
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  })
  const [toDate, setToDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('compliance_toDate')
      return saved || new Date().toISOString().slice(0, 16)
    }
    return new Date().toISOString().slice(0, 16)
  })

  const [showWarning, setShowWarning] = useState(false)
  const [wazuhHost, setWazuhHost] = useState('localhost:5601')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([])
  const [complianceStats, setComplianceStats] = useState({
    total: 0,
    compliant: 0,
    nonCompliant: 0
  })
  const [selectedRequirement, setSelectedRequirement] = useState<ComplianceRequirement | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('compliance_searchTerm', searchTerm)
    }
  }, [searchTerm])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('compliance_hideNoAlerts', hideNoAlerts.toString())
    }
  }, [hideNoAlerts])

  // Save time range settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('compliance_timeRangeType', timeRangeType)
      localStorage.setItem('compliance_relativeHours', relativeHours.toString())
      localStorage.setItem('compliance_fromDate', fromDate)
      localStorage.setItem('compliance_toDate', toDate)
    }
  }, [timeRangeType, relativeHours, fromDate, toDate])

  const frameworkId = params.framework as string
  const framework = complianceFrameworks.find(f => f.id === frameworkId)

  // Memoize client ID to prevent unnecessary re-renders
  const clientId = useMemo(() => selectedClient?.id || null, [selectedClient?.id])

  useEffect(() => {
    if (!framework) {
      router.push('/compliance')
      return
    }

    // Skip API call for frameworks without Wazuh integration
    if (!framework.hasWazuhLink) {
      setLoading(false)
      setError(null)
      setRequirements([])
      setComplianceStats({ total: 0, compliant: 0, nonCompliant: 0 })
      return
    }

    const fetchComplianceData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Map frontend framework IDs to backend IDs
        const backendFrameworkId = frameworkId === 'pci-dss' ? 'pci_dss' :
                                  frameworkId === 'nist-800-53' ? 'nist_800_53' :
                                  frameworkId === 'iso27001' ? 'iso27001' :
                                  frameworkId

        // Prepare time parameters
        const timeParams = timeRangeType === 'relative'
          ? { type: 'relative' as const, hours: relativeHours }
          : { type: 'absolute' as const, from: new Date(fromDate).toISOString(), to: new Date(toDate).toISOString() }

        console.log('Fetching compliance data for:', backendFrameworkId, 'timeParams:', timeParams)
        const orgId = isClientMode && selectedClient?.id ? selectedClient.id : undefined;
        const response = await wazuhApi.getComplianceFramework(backendFrameworkId, timeParams, orgId)

        if (response.success && response.data) {
          console.log('Received compliance data:', response.data.total, 'requirements')
          setRequirements(response.data.requirements || [])
          setComplianceStats({
            total: response.data.total || 0,
            compliant: response.data.compliant || 0,
            nonCompliant: response.data.nonCompliant || 0
          })
        }

        // Also fetch Wazuh host for current client
        getWazuhHost(clientId, isClientMode).then(setWazuhHost)
      } catch (err) {
        console.error('Failed to fetch compliance data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load compliance data')
      } finally {
        setLoading(false)
      }
    }

    fetchComplianceData()
  }, [framework, router, frameworkId, timeRangeType, relativeHours, clientId, isClientMode])

  // Early return check for framework
  if (!framework) {
    return <div>Framework not found</div>
  }

  // Computed values
  const IconComponent = framework.icon

  const filteredRequirements = requirements.filter(req => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = req.title.toLowerCase().includes(searchLower) ||
                         req.id.toLowerCase().includes(searchLower) ||
                         (req.goals && req.goals.toLowerCase().includes(searchLower)) ||
                         (req.description && req.description.toLowerCase().includes(searchLower))
    const matchesFilter = hideNoAlerts ? req.alertCount > 0 : true
    return matchesSearch && matchesFilter
  })

  // Helper functions
  const handleDownloadReport = () => {
    // CSV Header
    const csvHeaders = ['Requirement ID', 'Name', 'Description', 'Number of Alerts', 'Status'];

    // Helper function to escape CSV fields
    const escapeField = (field: string) => {
      if (!field) return '';
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    // CSV Rows - use filteredRequirements which already respects time range and filters
    const csvRows = filteredRequirements.map(req => {
      // Determine compliance status
      const status = req.status === 'compliant' ? 'Compliant' : 'Non-Compliant';

      return [
        escapeField(req.id),
        escapeField(req.title),
        escapeField(req.description || ''),
        req.alertCount.toString(),
        status
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    // Create Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    // Format time range for filename
    let timeRangeLabel = '';
    if (timeRangeType === 'relative') {
      if (relativeHours === 1) timeRangeLabel = '1Hour';
      else if (relativeHours === 6) timeRangeLabel = '6Hours';
      else if (relativeHours === 24) timeRangeLabel = '24Hours';
      else if (relativeHours === 168) timeRangeLabel = '7Days';
      else if (relativeHours === 720) timeRangeLabel = '30Days';
      else if (relativeHours === 2160) timeRangeLabel = '90Days';
      else timeRangeLabel = `${relativeHours}Hours`;
    } else {
      const from = new Date(fromDate).toISOString().split('T')[0];
      const to = new Date(toDate).toISOString().split('T')[0];
      timeRangeLabel = `${from}_to_${to}`;
    }

    link.setAttribute('href', url);
    link.setAttribute('download', `${framework.name}_Compliance_Report_${timeRangeLabel}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  }

  const handleViewDetailedInfo = () => {
    if (!framework.hasWazuhLink) {
      setShowWarning(true)
      return
    }
    
    const fullWazuhUrl = `https://${wazuhHost}${framework.wazuhPath}`
    window.open(fullWazuhUrl, '_blank')
  }

  const handleRequirementClick = (requirement: ComplianceRequirement) => {
    setSelectedRequirement(requirement)
    setShowDetailModal(true)
  }

  const handleCloseDetailModal = () => {
    setShowDetailModal(false)
    setSelectedRequirement(null)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-4">
          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <IconComponent className="w-8 h-8 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {framework.title} Compliance
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {framework.description}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        {hasPermission('compliance', 'download') && (
          <button
            onClick={handleDownloadReport}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
            Download Report
          </button>
        )}

        {hasPermission('compliance-details', 'access') && (
          <button
            onClick={handleViewDetailedInfo}
            className={`inline-flex items-center px-4 py-2 font-medium rounded-lg transition-colors ${
              framework.hasWazuhLink
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed'
            }`}
            disabled={!framework.hasWazuhLink}
          >
            <EyeIcon className="w-5 h-5 mr-2" />
            View Detailed Info
          </button>
        )}
      </div>

      {/* Time Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Range:</span>
          </div>

          {/* Toggle between Relative and Absolute */}
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1">
            <button
              onClick={() => setTimeRangeType('relative')}
              disabled={loading}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeRangeType === 'relative'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              } disabled:opacity-50`}
            >
              Relative
            </button>
            <button
              onClick={() => setTimeRangeType('absolute')}
              disabled={loading}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeRangeType === 'absolute'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              } disabled:opacity-50`}
            >
              Absolute
            </button>
          </div>

          {/* Relative Time Selector */}
          {timeRangeType === 'relative' && (
            <select
              value={relativeHours}
              onChange={(e) => setRelativeHours(parseInt(e.target.value))}
              disabled={loading}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value={0}>All Time</option>
              <option value={1}>Last Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={168}>Last 7 Days</option>
              <option value={720}>Last 30 Days</option>
              <option value={2160}>Last 90 Days</option>
            </select>
          )}

          {/* Absolute Time Range Selector */}
          {timeRangeType === 'absolute' && (
            <>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">From:</label>
                <input
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={loading}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={loading}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => {
              console.log('Manual refresh triggered')
              setLoading(true)
              const fetchData = async () => {
                const backendFrameworkId = frameworkId === 'pci-dss' ? 'pci_dss' :
                                          frameworkId === 'nist-800-53' ? 'nist_800_53' :
                                          frameworkId === 'iso27001' ? 'iso27001' :
                                          frameworkId

                try {
                  const orgId = isClientMode && selectedClient?.id ? selectedClient.id : undefined;
                  const timeParams = timeRangeType === 'relative'
                    ? { type: 'relative' as const, hours: relativeHours }
                    : { type: 'absolute' as const, from: new Date(fromDate).toISOString(), to: new Date(toDate).toISOString() }
                  const response = await wazuhApi.getComplianceFramework(backendFrameworkId, timeParams, orgId)
                  if (response.success && response.data) {
                    setRequirements(response.data.requirements || [])
                    setComplianceStats({
                      total: response.data.total || 0,
                      compliant: response.data.compliant || 0,
                      nonCompliant: response.data.nonCompliant || 0
                    })
                  }
                } catch (err) {
                  console.error('Manual refresh failed:', err)
                  setError('Failed to refresh data')
                } finally {
                  setLoading(false)
                }
              }
              fetchData()
            }}
            disabled={loading}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-500 disabled:opacity-50 flex items-center justify-center transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading compliance data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-red-700 dark:text-red-300">
              Error loading compliance data: {error}
            </span>
          </div>
        </div>
      )}

      {/* Compliance Score Visualization */}
      {!loading && !error && complianceStats.total > 0 && (
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <ChartBarIcon className="w-5 h-5 mr-2 text-blue-500" />
              Compliance Score Distribution
            </h3>
            
            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{complianceStats.total}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Requirements</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{complianceStats.compliant}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Compliant</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{complianceStats.nonCompliant}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Non-Compliant</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Donut Chart */}
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    {(() => {
                      let offset = 0;
                      const complianceData = [
                        { label: 'Compliant', value: complianceStats.compliant, color: '#16a34a' },
                        { label: 'Non-Compliant', value: complianceStats.nonCompliant, color: '#dc2626' }
                      ];
                      
                      return complianceData.map((d, i) => {
                        if (d.value === 0) return null;
                        const percent = (d.value / complianceStats.total) * 100;
                        const dash = (percent / 100) * 251.2;
                        const circle = (
                          <circle
                            key={d.label}
                            cx="50"
                            cy="50"
                            r="40"
                            stroke={d.color}
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={`${dash} ${251.2 - dash}`}
                            strokeDashoffset={-offset}
                            className="transition-all duration-500"
                          />
                        );
                        offset += dash;
                        return circle;
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{complianceStats.total}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend and Progress Bars */}
              <div className="space-y-6">
                <div className="space-y-4">
                  {/* Compliant */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-green-600"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Compliant
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {complianceStats.compliant} ({complianceStats.total > 0 ? ((complianceStats.compliant / complianceStats.total) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${complianceStats.total > 0 ? (complianceStats.compliant / complianceStats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Non-Compliant */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-red-600"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                          <XCircleIcon className="w-4 h-4 mr-1" />
                          Non-Compliant
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {complianceStats.nonCompliant} ({complianceStats.total > 0 ? ((complianceStats.nonCompliant / complianceStats.total) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${complianceStats.total > 0 ? (complianceStats.nonCompliant / complianceStats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Compliance Summary */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Compliance Overview</h4>
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    {complianceStats.compliant > 0 && (
                      <div>• <strong>{complianceStats.compliant}</strong> requirements fully compliant</div>
                    )}
                    {complianceStats.nonCompliant > 0 && (
                      <div>• <strong>{complianceStats.nonCompliant}</strong> requirements require immediate action</div>
                    )}
                    {complianceStats.total === 0 && (
                      <div>• No compliance data available for selected time range</div>
                    )}
                  </div>
                  {complianceStats.total > 0 && (
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      Overall Compliance Rate: <strong>{((complianceStats.compliant / complianceStats.total) * 100).toFixed(1)}%</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Section for frameworks without Wazuh integration */}
      {!framework.hasWazuhLink ? (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/40 rounded-full">
                <IconComponent className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {framework.title} Compliance Monitoring
            </h2>

            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 mb-6">
              <ClockIcon className="w-4 h-4 mr-2" />
              Coming Soon
            </div>

            <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
              We're working on bringing comprehensive {framework.title} compliance monitoring to your dashboard.
            </p>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-left">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                What's Coming
              </h3>
              <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                <li className="flex items-start">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Real-time compliance monitoring and alerts</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Automated compliance scoring and reporting</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Detailed requirement tracking and remediation guidance</span>
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Integration with your existing security infrastructure</span>
                </li>
              </ul>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
              Our team is actively developing this feature. Stay tuned for updates!
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Requirements Section */}
          {!loading && !error && requirements.length > 0 ? (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Requirements ({filteredRequirements.length})
                </h2>

                <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={hideNoAlerts}
                      onChange={(e) => setHideNoAlerts(e.target.checked)}
                      className="mr-2 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    Hide requirements with no alerts
                  </label>
                </div>
              </div>

            {/* Search Bar */}
            <div className="mt-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by requirement number, goal, or description"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Requirements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredRequirements.map((requirement) => (
              <div
                key={requirement.id}
                onClick={() => handleRequirementClick(requirement)}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {requirement.id}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
                      {frameworkId === 'iso27001'
                        ? `ISO27001_2022 ${requirement.id.startsWith('A.') ? 'Control' : 'Clause'} ${requirement.id}`
                        : requirement.title
                      }
                    </p>
                    {requirement.goals && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                        {requirement.goals}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      requirement.alertCount > 0 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                    }`}>
                      {requirement.alertCount}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {requirement.ruleCount || 0} rules
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !loading && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <ClipboardDocumentListIcon className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Requirements Found</h3>
            <p>No compliance requirements are available for {framework.name} framework at this time.</p>
          </div>
        </div>
      )}
        </>
      )}

      {/* Requirement Detail Modal */}
      {showDetailModal && selectedRequirement && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header with Gradient */}
            <div className={`flex-shrink-0 relative overflow-hidden ${
              selectedRequirement.status === 'non-compliant'
                ? 'bg-gradient-to-r from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10'
                : 'bg-gradient-to-r from-green-500/10 to-green-600/5 dark:from-green-500/20 dark:to-green-600/10'
            }`}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-xl ${
                    selectedRequirement.status === 'non-compliant'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-green-100 dark:bg-green-900/30'
                  }`}>
                    <ShieldCheckIcon className={`w-6 h-6 ${
                      selectedRequirement.status === 'non-compliant'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedRequirement.id} - {selectedRequirement.title}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {framework.title} Requirement
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseDetailModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2.5 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-8 overflow-y-auto bg-gradient-to-b from-gray-50/30 to-white dark:from-gray-800/30 dark:to-gray-900">
              {/* Goals */}
              {selectedRequirement.goals && (
                <div className="mb-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                  <div className="flex items-start">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-white mb-2">Goals</h4>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{selectedRequirement.goals}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Requirement Description */}
              {selectedRequirement.description && (
                <div className="mb-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                  <div className="flex items-start">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-white mb-2">Requirement Description</h4>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {selectedRequirement.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status and Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Status</h5>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
                      selectedRequirement.status === 'compliant'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {selectedRequirement.status.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Alert Count
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                        ({timeRangeType === 'relative'
                          ? (relativeHours === 0 ? 'All Time' :
                             relativeHours === 1 ? 'Last Hour' :
                             relativeHours === 6 ? 'Last 6 Hours' :
                             relativeHours === 24 ? 'Last 24h' :
                             relativeHours === 168 ? 'Last 7 Days' :
                             relativeHours === 720 ? 'Last 30 Days' :
                             relativeHours === 2160 ? 'Last 90 Days' :
                             `Last ${relativeHours}h`)
                          : `${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`})
                      </span>
                    </h5>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedRequirement.alertCount}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Associated Rules</h5>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedRequirement.ruleCount || selectedRequirement.rules?.length || 0}
                    </span>
                  </div>
                </div>

                {/* Associated Security Rules */}
                {selectedRequirement.rules && selectedRequirement.rules.length > 0 && (
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Associated Security Rules
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {selectedRequirement.rules.map((rule) => (
                        <div key={rule.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Rule ID: {rule.id}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {rule.description}
                              </p>
                              <div className="flex items-center space-x-4 mt-2">
                                <span className="text-xs text-gray-500">Level: {rule.level}</span>
                                <span className="text-xs text-gray-500">Status: {rule.status}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex justify-between items-center p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <ShieldCheckIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Requirement ID: {selectedRequirement.id}
                  </span>
                </div>
                <button
                  onClick={handleCloseDetailModal}
                  className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500 mr-3" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Link Not Available
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Detailed information link is not available for {framework.name} framework at this time.
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}