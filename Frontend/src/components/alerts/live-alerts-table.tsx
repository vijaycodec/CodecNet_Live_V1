'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeIcon, ClockIcon, UserIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, XMarkIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, CheckIcon, InformationCircleIcon, LockClosedIcon, MagnifyingGlassIcon, RectangleStackIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { Fragment } from 'react';
import { ticketsApi } from '@/lib/api'
import { PermissionGate } from '@/components/common/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
// import CreateTicketModal from '@/components/tickets/CreateTicketModal';


interface Alert {
  id: string
  severity: 'critical' | 'major' | 'minor'
  description: string
  timestamp: string
  host: string
  agent: string
  agent_id?: string
  rule: string
  status: 'open' | 'investigating' | 'resolved'
  // Include complete alert data for detailed view
  fullData?: IncomingAlert
}

interface IncomingAlert {
  agent_name: string
  agent_id?: string
  alert_description: string
  host_name: string | null
  rule_groups: string
  severity: number
  time: string
  alert_id: string
  srcip?: string
  location?: any
  // Complete alert JSON fields
  [key: string]: any  // Allow any additional fields from full alert JSON
}

interface LiveAlertsTableProps {
  alerts: IncomingAlert[]
  ticketMap?: Record<string, string>
  fetchData?: () => void | Promise<void>;
  selectedClient?: { id: string; name: string } | null;
  onTicketCreated?: (alertId: string, ticketId: string) => void;
}


// const mockAlerts: Alert[] = []

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'severity-critical'
    case 'major': return 'severity-major'
    case 'minor': return 'severity-minor'
    default: return 'severity-minor'
  }
}

// const getStatusColor = (status: string) => {
//   switch (status) {
//     case 'open': return 'severity-critical'
//     case 'investigating': return 'severity-major'
//     case 'resolved': return 'severity-minor'
//     default: return 'severity-minor'
//   }
// }

const mapSeverity = (level: number): Alert['severity'] => {
  if (level >= 15) return 'critical'
  if (level >= 11) return 'major'
  if (level >= 7) return 'minor'
  return 'minor'
}

export function LiveAlertsTable({ alerts, ticketMap, fetchData, selectedClient, onTicketCreated }: LiveAlertsTableProps) {
  const router = useRouter()
  const { canCreateTickets, canViewTickets } = usePermissions()
  const [mappedAlerts, setMappedAlerts] = useState<Alert[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Persist filters in localStorage
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'investigating' | 'resolved' | 'critical' | 'major' | 'minor' | 'new_alerts' | 'ticket_created'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('alerts_statusFilter') as any) || 'all'
    }
    return 'all'
  })
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('alerts_searchQuery') || ''
    }
    return ''
  })
  const [alertsPerPage, setAlertsPerPage] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('alerts_perPage') || '10')
    }
    return 10
  })

  // const [isClient, setIsClient] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [creatingTickets, setCreatingTickets] = useState<Set<string>>(new Set())
  const [localTicketMap, setLocalTicketMap] = useState<Record<string, string>>({})
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set())
  const [isBulkCreating, setIsBulkCreating] = useState(false)

  // Manual duplicate grouping: alertId -> groupId. Only the alerts the user explicitly
  // selected at Add-Group time are members; other alerts with the same description remain ungrouped.
  const [groupMembership, setGroupMembership] = useState<Map<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('alerts_groupMembership')
        if (stored) return new Map(JSON.parse(stored))
      } catch {}
    } 
    return new Map()
  })
  // Expanded groups are tracked by groupId.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alerts_statusFilter', statusFilter)
    }
  }, [statusFilter])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alerts_searchQuery', searchQuery)
    }
  }, [searchQuery])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alerts_perPage', alertsPerPage.toString())
    }
  }, [alertsPerPage])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alerts_groupMembership', JSON.stringify(Array.from(groupMembership.entries())))
    }
  }, [groupMembership])

  // Reset pagination and selections when filter or search changes
  useEffect(() => {
    setCurrentPage(1)
    setSelectedAlerts(new Set())
  }, [statusFilter, searchQuery])

  // Clear selections for alerts that now have tickets
  useEffect(() => {
    setSelectedAlerts(prev => {
      const newSelected = new Set(prev);
      let hasChanges = false;

      prev.forEach(alertId => {
        if (ticketMap?.[alertId] || localTicketMap[alertId]) {
          newSelected.delete(alertId);
          hasChanges = true;
        }
      });

      return hasChanges ? newSelected : prev;
    });
  }, [ticketMap, localTicketMap])

  // Calculate status counts
  // const openCount = mappedAlerts.filter(alert => alert.status === 'open').length
  // const investigatingCount = mappedAlerts.filter(alert => alert.status === 'investigating').length
  // const resolvedCount = mappedAlerts.filter(alert => alert.status === 'resolved').length
  const criticalCount = mappedAlerts.filter(alert => alert.severity === 'critical').length
  const majorCount = mappedAlerts.filter(alert => alert.severity === 'major').length
  const minorCount = mappedAlerts.filter(alert => alert.severity === 'minor').length

  // Calculate ticket status counts
  const newAlertsCount = mappedAlerts.filter(alert => !ticketMap?.[alert.id] && !localTicketMap[alert.id]).length
  const ticketCreatedCount = mappedAlerts.filter(alert => ticketMap?.[alert.id] || localTicketMap[alert.id]).length

  // Filter alerts based on selected status and search query
  const filteredAlerts = mappedAlerts.filter(alert => {
    // Status filter
    let statusMatch = true
    if (statusFilter !== 'all') {
      if (statusFilter === 'critical') {
        statusMatch = alert.severity === 'critical'
      } else if (statusFilter === 'major') {
        statusMatch = alert.severity === 'major'
      } else if (statusFilter === 'minor') {
        statusMatch = alert.severity === 'minor'
      } else if (statusFilter === 'new_alerts') {
        statusMatch = !ticketMap?.[alert.id] && !localTicketMap[alert.id]
      } else if (statusFilter === 'ticket_created') {
        statusMatch = !!(ticketMap?.[alert.id] || localTicketMap[alert.id])
      } else {
        statusMatch = alert.status === statusFilter
      }
    }

    // Search filter
    let searchMatch = true
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      searchMatch =
        alert.id.toLowerCase().includes(query) ||
        alert.description.toLowerCase().includes(query) ||
        alert.host.toLowerCase().includes(query) ||
        alert.agent.toLowerCase().includes(query) ||
        alert.rule.toLowerCase().includes(query) ||
        alert.severity.toLowerCase().includes(query) ||
        alert.timestamp.toLowerCase().includes(query)
    }

    return statusMatch && searchMatch
  })

  // Collapse each group (by groupId) into a single leader row; the rest become children.
  // `groupChildren` and `groupCount` are keyed by groupId.
  const { displayAlerts, groupChildren, groupCount } = useMemo(() => {
    const seen = new Set<string>()
    const children = new Map<string, Alert[]>()
    const count = new Map<string, number>()
    const display: Alert[] = []

    for (const a of filteredAlerts) {
      const gid = groupMembership.get(a.id)
      if (gid) {
        count.set(gid, (count.get(gid) || 0) + 1)
        if (!seen.has(gid)) {
          seen.add(gid)
          display.push(a)
        } else {
          const list = children.get(gid) || []
          list.push(a)
          children.set(gid, list)
        }
      } else {
        display.push(a)
      }
    }
    return { displayAlerts: display, groupChildren: children, groupCount: count }
  }, [filteredAlerts, groupMembership])

  // A row in displayAlerts is a group leader iff its alertId is in a group with ≥2 visible members.
  const isGroupLeader = (alert: Alert) => {
    const gid = groupMembership.get(alert.id)
    return !!gid && (groupCount.get(gid) || 0) >= 2
  }

  // Pagination calculations (operate on the post-grouping display list)
  const totalPages = Math.ceil(displayAlerts.length / alertsPerPage)
  const startIndex = (currentPage - 1) * alertsPerPage
  const endIndex = startIndex + alertsPerPage
  const currentAlerts = displayAlerts.slice(startIndex, endIndex)

  // Clamp current page when grouping shrinks the table below the current page
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages)
  }, [totalPages, currentPage])

  // --- Group action gating ---
  // Flat (ungrouped) selected alerts whose descriptions all match → eligible to form a new group
  const selectedFlatAlerts = useMemo(
    () => mappedAlerts.filter(a => selectedAlerts.has(a.id) && !groupMembership.has(a.id)),
    [mappedAlerts, selectedAlerts, groupMembership]
  )
  const canAddGroup = useMemo(() => {
    if (selectedFlatAlerts.length < 2) return false
    const first = selectedFlatAlerts[0].description
    return selectedFlatAlerts.every(a => a.description === first)
  }, [selectedFlatAlerts])

  // Selected alerts that already belong to a group → eligible to ungroup (by groupId)
  const selectedGroupIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of mappedAlerts) {
      if (selectedAlerts.has(a.id)) {
        const gid = groupMembership.get(a.id)
        if (gid) ids.add(gid)
      }
    }
    return ids
  }, [mappedAlerts, selectedAlerts, groupMembership])
  const canUngroup = selectedGroupIds.size >= 1

  const toggleExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const handleAddGroup = () => {
    if (!canAddGroup) return
    const newGroupId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setGroupMembership(prev => {
      const next = new Map(prev)
      selectedFlatAlerts.forEach(a => next.set(a.id, newGroupId))
      return next
    })
    setSelectedAlerts(new Set())
  }

  const handleUngroup = () => {
    if (!canUngroup) return
    setGroupMembership(prev => {
      const next = new Map(prev)
      for (const [aid, gid] of Array.from(prev.entries())) {
        if (selectedGroupIds.has(gid)) next.delete(aid)
      }
      return next
    })
    setExpandedGroups(prev => {
      const next = new Set(prev)
      selectedGroupIds.forEach(gid => next.delete(gid))
      return next
    })
    setSelectedAlerts(new Set())
  }

  // Smart pagination logic - generates page numbers in format: 1,2,3...n-3,n-2,n-1
  const generateSmartPageNumbers = () => {
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    
    const pages: (number | 'ellipsis')[] = []
    
    if (currentPage <= 3) {
      // Near beginning: 1,2,3,4,...,n-1,n
      pages.push(1, 2, 3, 4)
      if (totalPages > 5) pages.push('ellipsis')
      if (totalPages > 1) pages.push(totalPages)
    } else if (currentPage >= totalPages - 2) {
      // Near end: 1,2,...,n-3,n-2,n-1,n
      pages.push(1)
      if (totalPages > 5) pages.push('ellipsis')
      pages.push(totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      // Middle: show current page with neighbors and endpoints
      pages.push(1)
      if (currentPage > 4) pages.push('ellipsis')
      
      // Show 3 pages around current page
      pages.push(currentPage - 1, currentPage, currentPage + 1)
      
      if (currentPage < totalPages - 3) pages.push('ellipsis')
      pages.push(totalPages)
    }
    
    return pages.filter((page, index, arr) => {
      // Remove duplicate ellipsis or numbers
      if (page === 'ellipsis') {
        return arr[index - 1] !== 'ellipsis'
      }
      return true
    })
  }

  const smartPageNumbers = generateSmartPageNumbers()

  // const [showModal, setShowModal] = useState(false);
  // const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Reset to first page when filter or alerts per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, alertsPerPage])

  useEffect(() => {
    // Map backend alerts to frontend Alert type
    const formatted = alerts.map((a, idx) => ({
      id: a.alert_id,
      severity: mapSeverity(a.severity),
      description: a.alert_description,
      timestamp: new Date(a.time).toLocaleString(),
      host: a.host_name ?? a.agent_name ?? 'N/A',
      agent: a.agent_name,
      agent_id: a.agent_id,
      rule: a.rule_groups,
      status: 'open' as 'open',
      fullData: a  // Include complete alert data
    }))
    setMappedAlerts(formatted)
    setLastRefresh(new Date())
  }, [alerts])

  const createTicket = async (alert: Alert) => {
    try {
      if (!selectedClient?.id) {
        console.error("No client selected. Please select a client/organization first.");
        return;
      }

      // Prevent duplicate ticket creation
      if (creatingTickets.has(alert.id) || ticketMap?.[alert.id] || localTicketMap[alert.id]) {
        console.log("Ticket already exists or is being created for this alert");
        return;
      }

      // Mark as creating
      setCreatingTickets(prev => new Set(prev).add(alert.id));

      const ticketPayload = {
        title: alert.description.length >= 5 ? alert.description : `Security Alert: ${alert.description}`,
        description: `Security Alert from ${alert.agent}

Alert Details:
- Host: ${alert.host}
- Agent: ${alert.agent}
- Rule: ${alert.rule}
- Severity: ${alert.severity}
- Alert ID: ${alert.id}
- Timestamp: ${alert.timestamp}

This alert requires investigation and appropriate action.`,
        category: 'security_incident',
        priority: (alert.severity === 'critical' ? 'critical' : alert.severity === 'major' ? 'high' : 'medium') as 'low' | 'medium' | 'high' | 'critical',
        severity: alert.severity as 'minor' | 'major' | 'critical', // Use the actual severity value (critical/major/minor)
        alertId: alert.id,
        source_system: 'wazuh',
        organisation_id: selectedClient.id, // Use the selected client's ID
        related_asset_id: alert.agent_id, // Map agent ID to related asset
        tags: ['security', 'alert', alert.severity, alert.agent],
        custom_fields: {
          ruleId: alert.id,
          ruleName: alert.rule,
          hostName: alert.host,
          agentName: alert.agent,
          agentId: alert.agent_id,
          alertTimestamp: alert.timestamp,
          clientName: selectedClient.name,
          // Store full alert JSON data
          fullAlertData: alert.fullData ? JSON.stringify(alert.fullData) : null
        }
      };

      console.log("🚀 Sending ticket payload:", { related_asset_id: ticketPayload.related_asset_id, agentId: ticketPayload.custom_fields.agentId });

      const data = await ticketsApi.createTicket(ticketPayload);

      const ticketId = data.data?._id;
      console.log("Ticket created! ID: " + ticketId);

      if (ticketId) {
        // Update local ticket map
        setLocalTicketMap(prev => ({ ...prev, [alert.id]: ticketId }));

        // Notify parent component
        if (onTicketCreated) {
          onTicketCreated(alert.id, ticketId);
        }

        // Refresh data
        if (fetchData) {
          await fetchData();
        }
      }

    } catch (err: any) {
      console.log("Error creating ticket: " + err.message);
    } finally {
      // Remove from creating set
      setCreatingTickets(prev => {
        const newSet = new Set(prev);
        newSet.delete(alert.id);
        return newSet;
      });
    }
  };

  const navigateToTicket = (alert: Alert) => {
    const ticketId = ticketMap?.[alert.id] || localTicketMap[alert.id];
    if (ticketId) {
      // Navigate to tickets page with highlighting
      router.push(`/tickets?highlight=${ticketId}`);
    }
  };

  // Checkbox handlers
  // Group-leader rows are always selectable (they target ungrouping, not ticket creation).
  // Flat rows are only selectable when they don't already have a ticket.
  const isRowSelectable = (alert: Alert) =>
    isGroupLeader(alert) || (!ticketMap?.[alert.id] && !localTicketMap[alert.id])

  const handleSelectAll = () => {
    const selectableAlerts = currentAlerts.filter(isRowSelectable);

    if (selectedAlerts.size === selectableAlerts.length) {
      setSelectedAlerts(new Set());
    } else {
      const allAlertIds = selectableAlerts.map(alert => alert.id);
      setSelectedAlerts(new Set(allAlertIds));
    }
  };

  const handleSelectAlert = (alertId: string) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  };

  // Bulk ticket creation
  const createBulkTickets = async () => {
    if (selectedAlerts.size === 0) return;

    setIsBulkCreating(true);
    // Operate on all selected alerts (including grouped children that aren't on the current page)
    const alertsToProcess = mappedAlerts.filter(alert => selectedAlerts.has(alert.id));

    for (const alert of alertsToProcess) {
      // Skip if ticket already exists
      if (ticketMap?.[alert.id] || localTicketMap[alert.id]) {
        continue;
      }
      await createTicket(alert);
    }

    setIsBulkCreating(false);
    setSelectedAlerts(new Set());
  };

  const openAlertModal = (alert: Alert) => {
    setSelectedAlert(alert);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAlert(null);
  };


  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="status-dot active"></div>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">Live monitoring</span>
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {lastRefresh.toLocaleTimeString() || '...'}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search alerts by ID, description, host, agent, rule, or severity..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </button>
        )}
      </div>

      {/* Status Counters with Filtering and Bulk Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3 overflow-x-auto">
        <button
          onClick={() => setStatusFilter(statusFilter === 'all' ? 'all' : 'all')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${statusFilter === 'all'
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400 shadow-sm'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
            }`}
        >
          <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
          <span>All</span>
          <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-semibold">
            {alerts.length}
          </span>
        </button>

        {/* <button
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${statusFilter === 'open'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 shadow-sm'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-200 dark:hover:border-red-800/30 hover:shadow-sm'
            }`}
        >
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
          <span>Open</span>
          <span className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-xs font-semibold">
            {openCount}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'investigating' ? 'all' : 'investigating')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${statusFilter === 'investigating'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50 text-yellow-700 dark:text-yellow-400 shadow-sm'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 hover:border-yellow-200 dark:hover:border-yellow-800/30 hover:shadow-sm'
            }`}
        >
          <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
          <span>Investigating</span>
          <span className="bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded text-xs font-semibold">
            {investigatingCount}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'resolved' ? 'all' : 'resolved')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${statusFilter === 'resolved'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 shadow-sm'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/10 hover:border-green-200 dark:hover:border-green-800/30 hover:shadow-sm'
            }`}
        >
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
          <span>Resolved</span>
          <span className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-xs font-semibold">
            {resolvedCount}
          </span>
        </button> */}

        <button
          onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${statusFilter === 'critical'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 shadow-sm'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-200 dark:hover:border-red-800/30 hover:shadow-sm'
            }`}
        >
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
          <span>Critical</span>
          <span className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-xs font-semibold">
            {criticalCount}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'major' ? 'all' : 'major')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${statusFilter === 'major'
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-400 shadow-sm'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 hover:border-orange-200 dark:hover:border-orange-800/30 hover:shadow-sm'
            }`}
        >
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>
          <span>Major</span>
          <span className="bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded text-xs font-semibold">
            {majorCount}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'minor' ? 'all' : 'minor')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${statusFilter === 'minor'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50 text-yellow-700 dark:text-yellow-400 shadow-sm'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 hover:border-yellow-200 dark:hover:border-yellow-800/30 hover:shadow-sm'
            }`}
        >
          <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
          <span>Minor</span>
          <span className="bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded text-xs font-semibold">
            {minorCount}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'new_alerts' ? 'all' : 'new_alerts')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${statusFilter === 'new_alerts'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 shadow-sm'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-200 dark:hover:border-red-800/30 hover:shadow-sm'
            }`}
        >
          <div className="w-2.5 h-2.5 bg-red-600 rounded-full"></div>
          <span>New Alerts</span>
          <span className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-xs font-semibold">
            {newAlertsCount}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'ticket_created' ? 'all' : 'ticket_created')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${statusFilter === 'ticket_created'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 shadow-sm'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/10 hover:border-green-200 dark:hover:border-green-800/30 hover:shadow-sm'
            }`}
        >
          <div className="w-2.5 h-2.5 bg-green-600 rounded-full"></div>
          <span>Ticket Created</span>
          <span className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-xs font-semibold">
            {ticketCreatedCount}
          </span>
        </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Add Group Button — appears only when 2+ selected flat alerts share a description */}
          {canAddGroup && (
            <button
              onClick={handleAddGroup}
              className="inline-flex items-center px-4 py-2 border border-indigo-200 dark:border-indigo-800/50 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 transition-colors duration-150 shadow-sm"
            >
              <RectangleStackIcon className="w-4 h-4 mr-2" />
              Add Group
            </button>
          )}

          {/* Ungroup Button — appears when any selected row belongs to an existing group */}
          {canUngroup && (
            <button
              onClick={handleUngroup}
              className="inline-flex items-center px-4 py-2 border border-amber-200 dark:border-amber-800/50 text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800 transition-colors duration-150 shadow-sm"
            >
              <Squares2X2Icon className="w-4 h-4 mr-2" />
              Ungroup{selectedGroupIds.size > 1 ? ` (${selectedGroupIds.size})` : ''}
            </button>
          )}

          {/* Bulk Create Ticket Button */}
          {selectedAlerts.size > 0 && (
            <PermissionGate
              section="tickets"
              action="create"
              fallback={null}
            >
              <button
                onClick={createBulkTickets}
                disabled={isBulkCreating}
                className="inline-flex items-center px-4 py-2 border border-blue-200 dark:border-blue-800/50 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors duration-150 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkCreating ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Creating {selectedAlerts.size} Tickets...
                  </>
                ) : (
                  <>
                    <UserIcon className="w-4 h-4 mr-2" />
                    Create {selectedAlerts.size} Ticket{selectedAlerts.size > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      <div className="overflow-x-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-md">
        <table className="min-w-full divide-y divide-gray-200/70 dark:divide-gray-700/30">
          <thead className="bg-gray-50/80 dark:bg-gray-900/50">
            <tr>
              <th className="px-4 py-3.5 text-left">
                {canCreateTickets ? (
                  <input
                    type="checkbox"
                    checked={(() => {
                      const selectableAlerts = currentAlerts.filter(isRowSelectable);
                      return selectableAlerts.length > 0 && selectedAlerts.size === selectableAlerts.length;
                    })()}
                    onChange={handleSelectAll}
                    disabled={currentAlerts.every(alert => !isRowSelectable(alert))}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                ) : (
                  <LockClosedIcon className="w-4 h-4 text-gray-400" />
                )}
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Alert
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Host/Agent
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Rule
              </th>
              {/* <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th> */}
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/30">
            {currentAlerts.map((alert) => {
              const gid = groupMembership.get(alert.id)
              const leader = isGroupLeader(alert)
              const expanded = !!gid && expandedGroups.has(gid)
              const children = leader && gid ? (groupChildren.get(gid) || []) : []
              const dupCount = leader && gid ? (groupCount.get(gid) || 1) - 1 : 0
              return (
              <Fragment key={alert.id}>
                <tr
                  className={clsx(
                    'hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors duration-150 cursor-pointer',
                    leader && 'bg-indigo-50/40 dark:bg-indigo-900/10'
                  )}
                  onClick={(e) => {
                    // Don't open modal if clicking on buttons or interactive elements
                    const target = e.target as HTMLElement;
                    if (target.closest('button') || target.closest('a') || target.closest('input')) {
                      return;
                    }
                    openAlertModal(alert);
                  }}
                >
                  <td className="px-4 py-4">
                    {canCreateTickets ? (
                      <input
                        type="checkbox"
                        checked={selectedAlerts.has(alert.id)}
                        onChange={() => handleSelectAlert(alert.id)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!isRowSelectable(alert)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    ) : (
                      <LockClosedIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                      getSeverityColor(alert.severity)
                    )}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm whitespace-wrap text-gray-900 dark:text-white font-medium flex items-center gap-2 flex-wrap">
                      {leader && gid && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(gid); }}
                          className="inline-flex items-center justify-center w-5 h-5 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                          title={expanded ? 'Collapse duplicates' : 'Expand duplicates'}
                        >
                          {expanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                        </button>
                      )}
                      <span>{alert.description}</span>
                      {leader && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                          +{dupCount} duplicate{dupCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <ClockIcon className="w-4 h-4 mr-1.5 text-gray-400 " />
                      {alert.timestamp}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-wrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="font-medium">{alert.host}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{alert.agent}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-wrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="font-medium">{alert.rule}</div>
                    <div className="text-xs text-gray-400 mt-0.5">ID: {alert.id}</div>
                  </td>
                  {/* <td className="px-6 py-4 whitespace-wrap">
                  <span className={clsx(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                    getStatusColor(alert.status)
                  )}>
                    {alert.status}
                  </span>
                </td> */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">

                    {(() => {
                      const hasTicket = ticketMap?.[alert.id] || localTicketMap[alert.id];
                      const isCreating = creatingTickets.has(alert.id);

                      if (hasTicket) {
                        return (
                          <PermissionGate
                            section="tickets"
                            action="read"
                            fallback={
                              <div className="relative inline-flex items-center px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-xs font-medium rounded-lg text-gray-400 bg-gray-50 dark:bg-gray-800 transition-colors duration-150 shadow-sm">
                                <LockClosedIcon className="w-3.5 h-3.5 mr-1.5" />
                                View Ticket
                              </div>
                            }
                          >
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigateToTicket(alert);
                              }}
                              className="inline-flex items-center px-3 py-1.5 border border-green-200 dark:border-green-800/50 text-xs font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 transition-colors duration-150 shadow-sm"
                            >
                              <EyeIcon className="w-3.5 h-3.5 mr-1.5" />
                              View Ticket
                            </button>
                          </PermissionGate>
                        );
                      }

                      if (isCreating) {
                        return (
                          <button
                            disabled
                            className="inline-flex items-center px-3 py-1.5 border border-yellow-200 dark:border-yellow-800/50 text-xs font-medium rounded-lg text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 transition-colors duration-150 shadow-sm opacity-75 cursor-not-allowed"
                          >
                            <div className="w-3.5 h-3.5 mr-1.5 animate-spin rounded-full border-2 border-yellow-300 border-t-transparent"></div>
                            Creating...
                          </button>
                        );
                      }

                      return (
                        <PermissionGate
                          section="tickets"
                          action="create"
                          fallback={
                            <div className="relative inline-flex items-center px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-xs font-medium rounded-lg text-gray-400 bg-gray-50 dark:bg-gray-800 transition-colors duration-150 shadow-sm">
                              <LockClosedIcon className="w-3.5 h-3.5 mr-1.5" />
                              Create Ticket
                            </div>
                          }
                        >
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              createTicket(alert);
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-blue-200 dark:border-blue-800/50 text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors duration-150 shadow-sm"
                          >
                            <UserIcon className="w-3.5 h-3.5 mr-1.5" />
                            Create Ticket
                          </button>
                        </PermissionGate>
                      );
                    })()}
                  </td>
                </tr>
                {leader && expanded && children.map((child) => {
                  const childHasTicket = !!(ticketMap?.[child.id] || localTicketMap[child.id])
                  const childIsCreating = creatingTickets.has(child.id)
                  return (
                    <tr
                      key={child.id}
                      className="bg-gray-50/60 dark:bg-gray-900/30 hover:bg-gray-100/80 dark:hover:bg-gray-800/60 transition-colors duration-150 cursor-pointer"
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('a') || target.closest('input')) return;
                        openAlertModal(child);
                      }}
                    >
                      <td className="px-4 py-3 pl-10">
                        {canCreateTickets ? (
                          <input
                            type="checkbox"
                            checked={selectedAlerts.has(child.id)}
                            onChange={() => handleSelectAlert(child.id)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={childHasTicket}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        ) : (
                          <LockClosedIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                          getSeverityColor(child.severity)
                        )}>
                          {child.severity}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="text-sm text-gray-700 dark:text-gray-300">{child.description}</div>
                        <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <ClockIcon className="w-4 h-4 mr-1.5 text-gray-400" />
                          {child.timestamp}
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-wrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="font-medium">{child.host}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{child.agent}</div>
                      </td>
                      <td className="px-6 py-3 whitespace-wrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="font-medium">{child.rule}</div>
                        <div className="text-xs text-gray-400 mt-0.5">ID: {child.id}</div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {childHasTicket ? (
                          <PermissionGate
                            section="tickets"
                            action="read"
                            fallback={
                              <div className="relative inline-flex items-center px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-xs font-medium rounded-lg text-gray-400 bg-gray-50 dark:bg-gray-800 shadow-sm">
                                <LockClosedIcon className="w-3.5 h-3.5 mr-1.5" />
                                View Ticket
                              </div>
                            }
                          >
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigateToTicket(child); }}
                              className="inline-flex items-center px-3 py-1.5 border border-green-200 dark:border-green-800/50 text-xs font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 transition-colors duration-150 shadow-sm"
                            >
                              <EyeIcon className="w-3.5 h-3.5 mr-1.5" />
                              View Ticket
                            </button>
                          </PermissionGate>
                        ) : childIsCreating ? (
                          <button
                            disabled
                            className="inline-flex items-center px-3 py-1.5 border border-yellow-200 dark:border-yellow-800/50 text-xs font-medium rounded-lg text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 shadow-sm opacity-75 cursor-not-allowed"
                          >
                            <div className="w-3.5 h-3.5 mr-1.5 animate-spin rounded-full border-2 border-yellow-300 border-t-transparent"></div>
                            Creating...
                          </button>
                        ) : (
                          <PermissionGate
                            section="tickets"
                            action="create"
                            fallback={
                              <div className="relative inline-flex items-center px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-xs font-medium rounded-lg text-gray-400 bg-gray-50 dark:bg-gray-800 shadow-sm">
                                <LockClosedIcon className="w-3.5 h-3.5 mr-1.5" />
                                Create Ticket
                              </div>
                            }
                          >
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); createTicket(child); }}
                              className="inline-flex items-center px-3 py-1.5 border border-blue-200 dark:border-blue-800/50 text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors duration-150 shadow-sm"
                            >
                              <UserIcon className="w-3.5 h-3.5 mr-1.5" />
                              Create Ticket
                            </button>
                          </PermissionGate>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {filteredAlerts.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/50">
          {/* Centered Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mb-4">
              {/* First Page Button */}
              <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className={clsx(
              "inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150",
              currentPage === 1
                ? "text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed"
                : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            )}
            title="First page"
          >
            <ChevronDoubleLeftIcon className="w-4 h-4" />
          </button>
          
          {/* Previous Page Button */}
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={clsx(
              "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150",
              currentPage === 1
                ? "text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed"
                : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            )}
          >
            <ChevronLeftIcon className="w-4 h-4 mr-1" />
            Previous
          </button>
          
          {/* Smart Page Numbers */}
          <div className="flex items-center space-x-1">
            {smartPageNumbers.map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <span key={`ellipsis-${index}`} className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">
                    ...
                  </span>
                )
              }
              
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page as number)}
                  className={clsx(
                    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-150",
                    page === currentPage
                      ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50"
                      : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  )}
                >
                  {page}
                </button>
              )
            })}
          </div>
          
          {/* Next Page Button */}
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={clsx(
              "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150",
              currentPage === totalPages
                ? "text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed"
                : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            )}
          >
            Next
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </button>
          
          {/* Last Page Button */}
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className={clsx(
              "inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150",
              currentPage === totalPages
                ? "text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed"
                : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            )}
            title="Last page"
          >
            <ChevronDoubleRightIcon className="w-4 h-4" />
          </button>
            </div>
          )}

        {/* Bottom Info Row */}
        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
          {/* Items per page selector */}
          <div className="flex items-center space-x-2">
            <span>Show</span>
            <select
              value={alertsPerPage}
              onChange={(e) => setAlertsPerPage(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
            <span>alerts per page</span>
          </div>

          {/* Showing x to y of n alerts */}
          <div>
            <span>
              Showing {startIndex + 1} to {Math.min(endIndex, filteredAlerts.length)} of {filteredAlerts.length} alerts
            </span>
          </div>
        </div>
        </div>
      )}
      {/* Alert Details Modal */}
      {isModalOpen && selectedAlert && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with Gradient */}
            <div className={`flex-shrink-0 relative overflow-hidden ${
              selectedAlert.severity === 'critical' ? 'bg-gradient-to-r from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10' :
              selectedAlert.severity === 'major' ? 'bg-gradient-to-r from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-600/10' :
              'bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 dark:from-yellow-500/20 dark:to-yellow-600/10'
            }`}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center space-x-4">
                  <div className={`relative p-2 rounded-xl ${
                    selectedAlert.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                    selectedAlert.severity === 'major' ? 'bg-orange-100 dark:bg-orange-900/30' :
                    'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    <div className={`w-4 h-4 rounded-full ${
                      selectedAlert.severity === 'critical' ? 'bg-red-500 shadow-lg shadow-red-500/50' :
                      selectedAlert.severity === 'major' ? 'bg-orange-500 shadow-lg shadow-orange-500/50' :
                      'bg-yellow-500 shadow-lg shadow-yellow-500/50'
                    }`}></div>
                    <div className={`absolute inset-0 w-4 h-4 rounded-full animate-ping ${
                      selectedAlert.severity === 'critical' ? 'bg-red-500' :
                      selectedAlert.severity === 'major' ? 'bg-orange-500' :
                      'bg-yellow-500'
                    } opacity-75 m-2`}></div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Security Alert
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Alert ID: {selectedAlert.id}
                    </p>
                  </div>
                  <span className={clsx(
                    'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold capitalize shadow-sm',
                    getSeverityColor(selectedAlert.severity)
                  )}>
                    {selectedAlert.severity}
                  </span>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2.5 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-8 overflow-y-auto bg-gradient-to-b from-gray-50/30 to-white dark:from-gray-800/30 dark:to-gray-900">
              {/* Dynamic Alert Data Table */}
              {selectedAlert.fullData && (() => {
                // Flatten nested objects with dot notation
                const flattenObject = (obj: any, prefix: string = ''): Array<{key: string; value: any}> => {
                  const rows: Array<{key: string; value: any}> = [];

                  Object.keys(obj).forEach(key => {
                    const value = obj[key];
                    const fullKey = prefix ? `${prefix}.${key}` : key;

                    if (value === null || value === undefined) {
                      rows.push({ key: fullKey, value: 'N/A' });
                    } else if (typeof value === 'object' && !Array.isArray(value)) {
                      // Nested object - flatten it with dot notation
                      const nestedRows = flattenObject(value, fullKey);
                      rows.push(...nestedRows);
                    } else if (Array.isArray(value)) {
                      // Array - show as comma-separated values
                      const arrayValue = value.every(v => typeof v === 'string' || typeof v === 'number')
                        ? value.join(', ')
                        : JSON.stringify(value);
                      rows.push({ key: fullKey, value: arrayValue });
                    } else {
                      // Primitive value
                      rows.push({ key: fullKey, value: value });
                    }
                  });

                  return rows;
                };

                const alertData = selectedAlert.fullData;
                // Flatten all alert fields
                const alertRows = flattenObject(alertData);

                return (
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl mr-3">
                        <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      Alert Information
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Field Name
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {alertRows.map((row, index) => (
                            <tr
                              key={index}
                              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white font-mono">
                                {row.key}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                                {String(row.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Full Width Additional Information */}
              <div className="mt-8">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl mr-3">
                      <InformationCircleIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    Platform Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/50">
                      <div className="flex items-center mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        <span className="font-bold text-blue-800 dark:text-blue-300 text-xs uppercase tracking-wider">Alert Source</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">Codec Net Security Platform</span>
                    </div>
                    <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200/50 dark:border-green-700/50">
                      <div className="flex items-center mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="font-bold text-green-800 dark:text-green-300 text-xs uppercase tracking-wider">Detection Method</span>
                      </div>
                      <span className="text-sm font-semibold text-green-900 dark:text-green-200">Real-time Monitoring</span>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200/50 dark:border-purple-700/50">
                      <div className="flex items-center mb-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                        <span className="font-bold text-purple-800 dark:text-purple-300 text-xs uppercase tracking-wider">Event Type</span>
                      </div>
                      <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">Security Event</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex justify-between items-center p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <ClockIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Generated</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedAlert.timestamp}</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={closeModal}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
                  >
                    Close
                  </button>

                  {/* Show View Ticket button if ticket exists */}
                  {(ticketMap?.[selectedAlert.id] || localTicketMap[selectedAlert.id]) && (
                    <PermissionGate
                      section="tickets"
                      action="read"
                      fallback={
                        <div className="px-6 py-3 text-sm font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl transition-all duration-200 shadow-sm cursor-not-allowed flex items-center space-x-2">
                          <LockClosedIcon className="w-4 h-4" />
                          <span>View Ticket</span>
                        </div>
                      }
                    >
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          closeModal();
                          setTimeout(() => {
                            navigateToTicket(selectedAlert);
                          }, 200);
                        }}
                        className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg border-2 border-green-500"
                      >
                        View Ticket
                      </button>
                    </PermissionGate>
                  )}

                  {/* Show Create Ticket button if no ticket exists */}
                  {!ticketMap?.[selectedAlert.id] && !localTicketMap[selectedAlert.id] && (
                    <PermissionGate
                      section="tickets"
                      action="create"
                      fallback={
                        <div className="px-6 py-3 text-sm font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl transition-all duration-200 shadow-sm cursor-not-allowed flex items-center space-x-2">
                          <LockClosedIcon className="w-4 h-4" />
                          <span>Create Ticket</span>
                        </div>
                      }
                    >
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          closeModal();
                          setTimeout(() => {
                            createTicket(selectedAlert);
                          }, 200);
                        }}
                        className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg border-2 border-blue-500"
                      >
                        Create Ticket
                      </button>
                    </PermissionGate>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>

  )
}
