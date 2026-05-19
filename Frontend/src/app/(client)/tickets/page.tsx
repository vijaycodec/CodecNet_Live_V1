'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import TicketsTable from '@/components/tickets/tickets-table'
import { ArrowPathIcon, TicketIcon, ClockIcon, CheckCircleIcon, ExclamationTriangleIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { ticketsApi } from '@/lib/api'
import { useClient } from '@/contexts/ClientContext'

interface Ticket {
  _id: string
  ticket_number: string
  title: string
  description: string
  category?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  severity: 'minor' | 'major' | 'critical'
  ticket_status: 'open' | 'investigating' | 'resolved'
  created_by: {
    _id: string
    username: string
    email: string
  }
  assigned_to?: {
    _id: string
    username: string
    email: string
  }
  user_id: string | { _id: string; id: string }
  organisation_id: string
  alert_timestamp?: string
  host_name?: string
  agent_name?: string
  rule_name?: string
  rule_id?: string
  source_ip?: string
  tags?: string[]
  resolution_type?: 'false_positive' | 'true_positive'
  resolution_notes?: string
  previous_status?: string
  status_changed_by?: string | { _id: string; username?: string; display_name?: string }
  status_changed_at?: string
  first_response_at?: string
  related_asset_id?: string | { _id: string; asset_name?: string; asset_tag?: string }
  updated_by?: string | { _id: string; username?: string; display_name?: string }
  estimated_hours?: number
  actual_hours?: number
  due_date?: string
  resolved_at?: string
  createdAt: string
  updatedAt: string
}

export default function TicketPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [highlightedTicket, setHighlightedTicket] = useState<string | null>(null)
  const [ticketDistributionCollapsed, setTicketDistributionCollapsed] = useState(false)
  const { selectedClient, isClientMode} = useClient()
  const searchParams = useSearchParams()

  // Time range filters
  const [timeRangeType, setTimeRangeType] = useState<'relative' | 'absolute'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tickets_timeRangeType') as any) || 'relative'
    }
    return 'relative'
  })
  const [relativeHours, setRelativeHours] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('tickets_relativeHours') || '168') // Default 7 days for tickets
    }
    return 168
  })
  const [fromDate, setFromDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tickets_fromDate')
      return saved || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    }
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  })
  const [toDate, setToDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tickets_toDate')
      return saved || new Date().toISOString().slice(0, 16)
    }
    return new Date().toISOString().slice(0, 16)
  })

  // Save time range settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tickets_timeRangeType', timeRangeType)
      localStorage.setItem('tickets_relativeHours', relativeHours.toString())
      localStorage.setItem('tickets_fromDate', fromDate)
      localStorage.setItem('tickets_toDate', toDate)
    }
  }, [timeRangeType, relativeHours, fromDate, toDate])

  const fetchTickets = async () => {
    console.log('=== FETCH TICKETS CALLED ===');
    console.log('isClientMode:', isClientMode);
    console.log('selectedClient:', selectedClient);

    setLoading(true)
    setError(null)
    try {
      // Add organization filter if client is selected
      const params: any = {}
      if (isClientMode && selectedClient?.id) {
        params.organisation_id = selectedClient.id
      }

      // Add time filter parameters (skip if All Time is selected)
      if (timeRangeType === 'relative' && relativeHours > 0) {
        const now = new Date();
        const startTime = new Date(now.getTime() - relativeHours * 60 * 60 * 1000);
        params.start_date = startTime.toISOString();
        params.end_date = now.toISOString();
      } else if (timeRangeType === 'absolute') {
        params.start_date = new Date(fromDate).toISOString();
        params.end_date = new Date(toDate).toISOString();
      }

      console.log('API params:', params);
      console.log('About to call ticketsApi.getTickets');

      const data = await ticketsApi.getTickets(params)

      console.log('API response:', data);
      setTickets(data.data || [])
    } catch (err: any) {
      console.error('Error in fetchTickets:', err);
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setIsClient(true)
    fetchTickets()
  }, []) // Initial load

  useEffect(() => {
    fetchTickets()
  }, [selectedClient?.id, isClientMode, timeRangeType, relativeHours, fromDate, toDate]) // Re-fetch when selected client or time range changes

  // Handle highlighting from URL parameters
  useEffect(() => {
    const highlightId = searchParams?.get('highlight')
    if (highlightId) {
      setHighlightedTicket(highlightId)
      // Clear highlight after 5 seconds to give user time to see the ticket
      const timer = setTimeout(() => {
        setHighlightedTicket(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  // Calculate ticket status distribution
  const ticketStats = {
    open: tickets.filter(ticket => ticket.ticket_status === 'open').length,
    investigating: tickets.filter(ticket => ticket.ticket_status === 'investigating').length,
    resolved: tickets.filter(ticket => ticket.ticket_status === 'resolved').length
  }

  const totalTickets = tickets.length;
  const statusTotal = ticketStats.open + ticketStats.investigating + ticketStats.resolved;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Alert Tickets
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            View and manage security alerts converted to Jira tickets
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchTickets}
            className="inline-flex ml-4 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
            disabled={loading}
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Time Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Range:</span>
          </div>

          {/* Toggle between Relative and Absolute */}
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1">
            <button
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

      {/* Ticket Status Visualization */}
      {isClient && totalTickets > 0 && (
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <TicketIcon className="w-5 h-5 mr-2 text-blue-500" />
                Ticket Status Distribution
              </h3>
              <button
                onClick={() => setTicketDistributionCollapsed(!ticketDistributionCollapsed)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title={ticketDistributionCollapsed ? "Expand" : "Collapse"}
              >
                {ticketDistributionCollapsed ? (
                  <ChevronDownIcon className="w-5 h-5" />
                ) : (
                  <ChevronUpIcon className="w-5 h-5" />
                )}
              </button>
            </div>

            {!ticketDistributionCollapsed && (
              <>
                {/* Stats Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalTickets}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Tickets</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{ticketStats.open}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Open</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{ticketStats.investigating}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Investigating</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{ticketStats.resolved}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Resolved</div>
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
                      const statusData = [
                        { label: 'Open', value: ticketStats.open, color: '#dc2626' },
                        { label: 'Investigating', value: ticketStats.investigating, color: '#2563eb' },
                        { label: 'Resolved', value: ticketStats.resolved, color: '#16a34a' }
                      ];
                      
                      return statusData.map((d, i) => {
                        if (d.value === 0) return null;
                        const percent = (d.value / statusTotal) * 100;
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
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalTickets}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend and Progress Bars */}
              <div className="space-y-6">
                <div className="space-y-4">
                  {/* Open Tickets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-red-600"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                          <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                          Open
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {ticketStats.open} ({statusTotal > 0 ? ((ticketStats.open / statusTotal) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${statusTotal > 0 ? (ticketStats.open / statusTotal) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Investigating Tickets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                          <ClockIcon className="w-4 h-4 mr-1" />
                          Investigating
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {ticketStats.investigating} ({statusTotal > 0 ? ((ticketStats.investigating / statusTotal) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${statusTotal > 0 ? (ticketStats.investigating / statusTotal) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Resolved Tickets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-green-600"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Resolved
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {ticketStats.resolved} ({statusTotal > 0 ? ((ticketStats.resolved / statusTotal) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${statusTotal > 0 ? (ticketStats.resolved / statusTotal) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>

                </div>

                {/* Workflow Summary */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Workflow Status</h4>
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    {ticketStats.open > 0 && (
                      <div>• <strong>{ticketStats.open}</strong> tickets need immediate attention</div>
                    )}
                    {ticketStats.investigating > 0 && (
                      <div>• <strong>{ticketStats.investigating}</strong> tickets under investigation</div>
                    )}
                    {ticketStats.resolved > 0 && (
                      <div>• <strong>{ticketStats.resolved}</strong> tickets successfully resolved</div>
                    )}
                    {totalTickets === 0 && (
                      <div>• No tickets available</div>
                    )}
                  </div>
                  {statusTotal > 0 && (
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      Resolution Rate: <strong>{((ticketStats.resolved / statusTotal) * 100).toFixed(1)}%</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Tickets Table */}
      <div className="card-gradient p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ticket Management</h2>
        <TicketsTable
          tickets={tickets}
          loading={loading}
          error={error}
          fetchTickets={fetchTickets} // pass so child can refetch after transition
          highlightedTicket={highlightedTicket}
        />
      </div>
    </div>
  );
}
