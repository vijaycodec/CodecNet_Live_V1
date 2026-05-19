'use client'

import { useState, useEffect } from 'react'
import { DocumentTextIcon, ArrowDownTrayIcon, CalendarIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline'
import { PermissionGate } from '@/components/common/PermissionGate'
import { useClient } from '@/contexts/ClientContext'

const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP

interface Report {
  id: string
  report_name: string
  description: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'on-demand'
  template: string
  file_name: string
  file_size: number
  file_extension: string
  priority: string
  report_period_start: string
  report_period_end: string
  created_at: string
  created_by?: {
    username: string
    full_name: string
  }
  metadata?: {
    alerts_count?: number
    severity_counts?: any
    agents_count?: number
    sca_score?: number
  }
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const { selectedClient, isClientMode } = useClient()

  // Time range filters
  const [timeRangeType, setTimeRangeType] = useState<'relative' | 'absolute'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('reports_timeRangeType') as any) || 'relative'
    }
    return 'relative'
  })
  const [relativeHours, setRelativeHours] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('reports_relativeHours') || '168') // Default 7 days
    }
    return 168
  })
  const [fromDate, setFromDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reports_fromDate')
      return saved || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    }
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  })
  const [toDate, setToDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reports_toDate')
      return saved || new Date().toISOString().slice(0, 16)
    }
    return new Date().toISOString().slice(0, 16)
  })

  // Save time range settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reports_timeRangeType', timeRangeType)
      localStorage.setItem('reports_relativeHours', relativeHours.toString())
      localStorage.setItem('reports_fromDate', fromDate)
      localStorage.setItem('reports_toDate', toDate)
    }
  }, [timeRangeType, relativeHours, fromDate, toDate])

  // Fetch reports on page load and when selected client changes
  useEffect(() => {
    fetchReports()
  }, [selectedClient])

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No authentication token found')
        setIsLoading(false)
        return
      }

      // Build URL with orgId if client is selected
      let url = `${BASE_URL}/reports`
      if (isClientMode && selectedClient?.id) {
        url += `?orgId=${selectedClient.id}`
        console.log('Fetching reports for organization:', selectedClient.id)
      }

      console.log('Fetching reports from:', url)
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error response:', errorData)
        throw new Error(errorData.message || 'Failed to fetch reports')
      }

      const data = await response.json()
      console.log('Fetched reports data:', data)
      console.log('Data structure:', data.data)
      console.log('Reports array:', data.data?.reports)

      if (data.success && data.data && data.data.reports) {
        setReports(data.data.reports)
        console.log('Reports set:', data.data.reports.length, 'reports')
        console.log('Reports content:', data.data.reports)
      } else {
        console.warn('No reports in response or unexpected format')
        console.log('Response data:', JSON.stringify(data, null, 2))
        setReports([])
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
      setReports([])
    } finally {
      setIsLoading(false)
      console.log('Loading complete')
    }
  }

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Get the selected template option text (not value)
    const templateSelect = form.querySelector('select[name="template"]') as HTMLSelectElement
    const selectedTemplateText = templateSelect.options[templateSelect.selectedIndex].text

    // Auto-generate report name based on time range
    const date = new Date()
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    const orgName = selectedClient?.name || selectedClient?.organisation_name || 'Organization'

    // Generate time range description for report name
    let timeRangeDesc = 'All Time'
    if (timeRangeType === 'relative' && relativeHours > 0) {
      if (relativeHours === 1) timeRangeDesc = 'Last Hour'
      else if (relativeHours === 6) timeRangeDesc = 'Last 6 Hours'
      else if (relativeHours === 24) timeRangeDesc = 'Last 24 Hours'
      else if (relativeHours === 168) timeRangeDesc = 'Last 7 Days'
      else if (relativeHours === 720) timeRangeDesc = 'Last 30 Days'
      else if (relativeHours === 2160) timeRangeDesc = 'Last 90 Days'
    } else if (timeRangeType === 'absolute') {
      const from = new Date(fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const to = new Date(toDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      timeRangeDesc = `${from} - ${to}`
    }

    const autoGeneratedName = `${orgName} - ${selectedTemplateText} - ${timeRangeDesc} - ${formattedDate}`

    // Build report data with time parameters
    const reportData: any = {
      reportName: autoGeneratedName,
      description: formData.get('description') as string,
      frequency: 'on-demand', // Set to on-demand since we're using custom time ranges
      template: selectedTemplateText,
    }

    // Add time filter parameters if not "All Time"
    if (timeRangeType === 'relative' && relativeHours > 0) {
      const now = new Date();
      const startTime = new Date(now.getTime() - relativeHours * 60 * 60 * 1000);
      reportData.start_date = startTime.toISOString();
      reportData.end_date = now.toISOString();
    } else if (timeRangeType === 'absolute') {
      reportData.start_date = new Date(fromDate).toISOString();
      reportData.end_date = new Date(toDate).toISOString();
    }

    try {
      setIsGenerating(true)

      // Call API to generate report
      const token = localStorage.getItem('token')

      if (!token) {
        throw new Error('No authentication token found. Please login again.')
      }

      // Build URL with orgId if client is selected
      let generateUrl = `${BASE_URL}/reports/generate`
      if (isClientMode && selectedClient?.id) {
        generateUrl += `?orgId=${selectedClient.id}`
      }

      const response = await fetch(generateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(reportData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || 'Failed to generate report'
        console.error('Server error:', response.status, errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()

      if (data.success) {
        // Refresh the reports list
        await fetchReports()
        form.reset()
        alert('Report generated and saved successfully!')
      } else {
        throw new Error(data.message || 'Failed to generate report')
      }
    } catch (error: any) {
      console.error('Error generating report:', error)
      alert(error.message || 'Failed to generate report. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadReport = async (reportId: string, fileName: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${BASE_URL}/reports/${reportId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to download report')
      }

      // Download the PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading report:', error)
      alert('Failed to download report. Please try again.')
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${BASE_URL}/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete report')
      }

      // Refresh the reports list
      await fetchReports()
      alert('Report deleted successfully!')
    } catch (error) {
      console.error('Error deleting report:', error)
      alert('Failed to delete report. Please try again.')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Security Reports
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage reports for your organization
        </p>
      </div>

      {/* Add New Report */}
      <PermissionGate section="reports" action="create" showLock={false}>
        <div className="card-gradient p-8 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg mr-3">
              <DocumentTextIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Create New Report
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Set up automated security reports for stakeholders
              </p>
            </div>
          </div>

          {/* Time Range Filter */}
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <ClockIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Report Time Range:</span>
              </div>

              {/* Toggle between Relative and Absolute */}
              <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1">
                <button
                  type="button"
                  onClick={() => setTimeRangeType('relative')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    timeRangeType === 'relative'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Relative
                </button>
                <button
                  type="button"
                  onClick={() => setTimeRangeType('absolute')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    timeRangeType === 'absolute'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Absolute
                </button>
              </div>

              {/* Relative Time Selector */}
              {timeRangeType === 'relative' && (
                <select
                  value={relativeHours}
                  onChange={(e) => setRelativeHours(parseInt(e.target.value))}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
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
                      className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
                    <input
                      type="datetime-local"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleCreateReport}>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Report Template *
            </label>
            <select name="template" required className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl
                             focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400
                             text-gray-900 dark:text-white transition-all duration-200">
              <option value="executive">Executive Summary</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Report Description (Optional)
            </label>
            <textarea
              rows={3}
              name="description"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl
                        focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400
                        text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                        transition-all duration-200 resize-none"
              placeholder="Add any additional notes about this report (optional)..."
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Report Name:</strong> Will be auto-generated as: <br />
              <span className="font-mono text-xs">{selectedClient?.name || selectedClient?.organisation_name || 'Organization'} - [Template] - [Time Range] - [Date]</span>
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
            
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isGenerating}
                className="px-8 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600
                          hover:from-blue-700 hover:to-purple-700 rounded-lg shadow-lg shadow-blue-500/25
                          transition-all duration-200 transform hover:scale-105 focus:ring-2 focus:ring-blue-500/50 focus:outline-none
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isGenerating ? 'Generating Report...' : 'Create Report'}
              </button>
            </div>
          </div>
        </form>
      </div>
      </PermissionGate>

      {/* Generated Reports */}
      <PermissionGate section="reports" action="read" showLock={false}>
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading reports...</p>
          </div>
        ) : reports.length > 0 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Generated Reports
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your organization's security reports
              </p>
            </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    <DocumentTextIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="ml-3 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                        {report.report_name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {report.frequency} • {report.template}
                      </p>
                    </div>
                  </div>

                </div>

                {report.description && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {report.description}
                  </p>
                )}

                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">File Size:</span>
                    <span className="ml-2">{formatFileSize(report.file_size)}</span>
                  </div>
                  {report.created_by && (
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium">Created by:</span>
                      <span className="ml-2">{report.created_by.full_name || report.created_by.username}</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Generated:</span>
                    <span className="ml-2">{formatDate(report.created_at)}</span>
                  </div>
                  {report.metadata && (
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium">Alerts:</span>
                      <span className="ml-2">{report.metadata.alerts_count || 0}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex space-x-2">
                  <PermissionGate section="reports" action="download" showLock={false}>
                    <button
                      onClick={() => handleDownloadReport(report.id, report.file_name)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors flex items-center justify-center"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                      Download
                    </button>
                  </PermissionGate>
                  <PermissionGate section="reports" action="delete" showLock={false}>
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors flex items-center justify-center"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </PermissionGate>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No reports generated yet</p>
        </div>
      )}
      </PermissionGate>
    </div>
  )
} 