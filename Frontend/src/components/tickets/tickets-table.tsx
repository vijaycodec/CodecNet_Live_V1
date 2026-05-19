'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import {
  ClockIcon,
  UserIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  TrashIcon,
  ArrowPathRoundedSquareIcon,
  InformationCircleIcon,
  TicketIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline'
import { ticketsApi } from '@/lib/api'
import { PermissionGate } from '@/components/common/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'

interface Ticket {
  _id: string
  ticket_number: string
  title: string
  description: string
  category?: string
  severity: 'minor' | 'major' | 'critical'
  ticket_status: 'open' | 'investigating' | 'resolved'
  created_by?: {
    _id: string
    username?: string
    display_name?: string
    full_name?: string
    email?: string
    id?: string
  } | string
  user_id: string | { _id: string; id: string }
  organisation_id: string | {
    _id: string
    organisation_name?: string
    client_name?: string
    name?: string
    emails?: string[]
    [key: string]: any
  }
  alertTimestamp?: string
  hostName?: string
  agentName?: string
  ruleName?: string
  ruleId?: string
  sourceIp?: string
  tags?: string[]
  due_date?: string
  resolved_at?: string
  resolution_notes?: string
  resolution_type?: 'false_positive' | 'true_positive'
  estimated_hours?: number
  actual_hours?: number
  previous_status?: string
  status_changed_by?: string | { _id: string; username?: string; display_name?: string }
  status_changed_at?: string
  first_response_at?: string
  related_asset_id?: string | { _id: string; asset_name?: string; asset_tag?: string }
  updated_by?: string | { _id: string; username?: string; display_name?: string }
  custom_fields?: {
    ruleId?: string
    ruleName?: string
    hostName?: string
    agentName?: string
    agentId?: string
    alertTimestamp?: string
    clientName?: string
    fullAlertData?: string
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
}

interface TicketsTableProps {
  tickets: Ticket[]
  loading: boolean
  error: string | null
  fetchTickets: () => Promise<void>
  highlightedTicket?: string | null
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
    case 'major': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
    case 'minor': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
    default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-800'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
    case 'investigating': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
    case 'resolved': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
    default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-800'
  }
}

// Generate email template for ticket
const generateTicketEmail = (ticket: Ticket) => {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const getCreatedByName = () => {
    if (ticket.created_by && typeof ticket.created_by === 'object') {
      return ticket.created_by.username || ticket.created_by.display_name || ticket.created_by.full_name || 'SOC Analyst'
    }
    return 'SOC Analyst'
  }

  const getHostInfo = () => {
    if (ticket.hostName) return ticket.hostName
    if (ticket.agentName) return ticket.agentName
    return 'N/A'
  }

  const getAffectedAssets = () => {
    const assets = []
    if (ticket.sourceIp) assets.push(ticket.sourceIp)
    if (ticket.hostName && ticket.sourceIp !== ticket.hostName) assets.push(`${ticket.hostName} (${ticket.sourceIp})`)
    return assets.length > 0 ? assets.join(' ') : 'N/A'
  }

  const getOrganisationName = () => {
    // Extract organisation name from ticket.organisation_id if it's an object
    if (ticket.organisation_id && typeof ticket.organisation_id === 'object') {
      if ('organisation_name' in ticket.organisation_id) {
        return ticket.organisation_id.organisation_name
      }
      if ('client_name' in ticket.organisation_id) {
        return ticket.organisation_id.client_name
      }
      if ('name' in ticket.organisation_id) {
        return ticket.organisation_id.name
      }
    }
    return 'Organisation Name' // Placeholder for dynamic content
  }

  const subject = `${getOrganisationName()} | ${ticket.title} | ${ticket.ticket_number}`

  const body = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #3498db; color: white; padding: 12px; text-align: left; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #ddd; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) { background: #f8f9fa; }
    .field-name { font-weight: 600; color: #2c3e50; width: 35%; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; color: #666; }
    .highlight { color: #e74c3c; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Security Alert Notification</h2>
    <p>Hi Team,</p>
    <p>We have received an alert on our SOC Dashboard of <strong>${ticket.title}</strong>. Please find the relevant incident details summarized in the table below and also find the screenshot attached.</p>

    <table>
      <tr>
        <td class="field-name">Ticket ID</td>
        <td>${ticket.ticket_number}</td>
      </tr>
      <tr>
        <td class="field-name">Date & Time (IST UTC+05:30)</td>
        <td>${formatDateTime(ticket.alertTimestamp || ticket.createdAt)}</td>
      </tr>
      <tr>
        <td class="field-name">Severity</td>
        <td class="highlight">${ticket.severity.charAt(0).toUpperCase() + ticket.severity.slice(1)}</td>
      </tr>
      <tr>
        <td class="field-name">IOCs</td>
        <td>${getHostInfo()}</td>
      </tr>
      <tr>
        <td class="field-name">Category / Use-Case</td>
        <td>[User will input it in mail app]</td>
      </tr>
      <tr>
        <td class="field-name">Detection Source</td>
        <td>Codec Net</td>
      </tr>
      <tr>
        <td class="field-name">Affected Asset(s)</td>
        <td>${getAffectedAssets()}</td>
      </tr>
      <tr>
        <td class="field-name">SOC Analyst</td>
        <td>${getCreatedByName()}</td>
      </tr>
      <tr>
        <td class="field-name">Current Status</td>
        <td>${ticket.ticket_status.charAt(0).toUpperCase() + ticket.ticket_status.slice(1)}</td>
      </tr>
      <tr>
        <td class="field-name">Incident Summary</td>
        <td>${ticket.description || 'Security incident detected and requires immediate attention.'}</td>
      </tr>
      <tr>
        <td class="field-name">Required Actions</td>
        <td>[User will input it in mail app]</td>
      </tr>
    </table>

    <p>We request you to review the above details and take the necessary remedial actions to secure the affected system(s). Once done, kindly share the steps taken with us so we can mark the ticket as resolved.</p>
    <p class="highlight">Please treat this with priority and respond at the earliest.</p>

    <div class="footer">
      <p>Regards,<br>
      <strong>${getCreatedByName()}</strong><br>
      SOC Team (Codec Net)</p>
    </div>
  </div>
</body>
</html>`

  return { subject, body }
}

export default function TicketsTable({ tickets, loading, error, fetchTickets, highlightedTicket }: TicketsTableProps) {
  const { hasPermission } = usePermissions()

  // Persist filters in localStorage
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'investigating' | 'resolved' | 'critical' | 'major' | 'minor'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tickets_statusFilter') as any) || 'all'
    }
    return 'all'
  })
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tickets_searchQuery') || ''
    }
    return ''
  })
  const [ticketsPerPage, setTicketsPerPage] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('tickets_perPage') || '10')
    }
    return 10
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [statusChangeTicket, setStatusChangeTicket] = useState<Ticket | null>(null)
  const [showResolutionForm, setShowResolutionForm] = useState(false)
  const [resolutionType, setResolutionType] = useState<'false_positive' | 'true_positive' | ''>('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set())
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<'open' | 'investigating' | 'resolved' | ''>('')
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [bulkResolutionType, setBulkResolutionType] = useState<'false_positive' | 'true_positive' | ''>('')
  const [bulkResolutionNotes, setBulkResolutionNotes] = useState('')

  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tickets_statusFilter', statusFilter)
    }
  }, [statusFilter])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tickets_searchQuery', searchQuery)
    }
  }, [searchQuery])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tickets_perPage', ticketsPerPage.toString())
    }
  }, [ticketsPerPage])

  // Check if user can update tickets (this will determine if Actions column is shown)
  const canUpdateTickets = hasPermission('tickets', 'update')

  // Filter tickets based on status and search query
  const filteredTickets = tickets.filter(ticket => {
    // Status filter
    let statusMatch = true
    if (statusFilter !== 'all') {
      if (['open', 'investigating', 'resolved'].includes(statusFilter)) {
        statusMatch = ticket.ticket_status === statusFilter
      } else if (['critical', 'major', 'minor'].includes(statusFilter)) {
        statusMatch = ticket.severity === statusFilter
      }
    }

    // Search filter
    let searchMatch = true
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      searchMatch =
        ticket.ticket_number.toLowerCase().includes(query) ||
        ticket.title.toLowerCase().includes(query) ||
        (ticket.description?.toLowerCase().includes(query) ?? false) ||
        (ticket.category?.toLowerCase().includes(query) ?? false) ||
        ticket.severity.toLowerCase().includes(query) ||
        ticket.ticket_status.toLowerCase().includes(query) ||
        (ticket.hostName?.toLowerCase().includes(query) ?? false) ||
        (ticket.agentName?.toLowerCase().includes(query) ?? false) ||
        (ticket.ruleName?.toLowerCase().includes(query) ?? false) ||
        (ticket.tags?.some(tag => tag.toLowerCase().includes(query)) ?? false) ||
        (typeof ticket.created_by === 'object' && (ticket.created_by?.username?.toLowerCase().includes(query) ?? false))
    }

    return statusMatch && searchMatch
  })

  // Calculate pagination
  const totalTickets = filteredTickets.length
  const allTicketsCount = tickets.length // Total count without filters
  const totalPages = Math.ceil(totalTickets / ticketsPerPage)
  const startIndex = (currentPage - 1) * ticketsPerPage
  const endIndex = startIndex + ticketsPerPage
  const currentTickets = filteredTickets.slice(startIndex, endIndex)

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1)
    setSelectedTickets(new Set())
  }, [searchQuery, statusFilter])

  // Reset resolution fields when status changes away from resolved
  useEffect(() => {
    if (bulkStatus !== 'resolved') {
      setBulkResolutionType('')
      setBulkResolutionNotes('')
    }
  }, [bulkStatus])

  // Clear selections for resolved tickets
  useEffect(() => {
    setSelectedTickets(prev => {
      const newSelected = new Set(prev)
      let hasChanges = false

      prev.forEach(ticketId => {
        const ticket = tickets.find(t => t._id === ticketId)
        if (ticket && ticket.ticket_status === 'resolved') {
          newSelected.delete(ticketId)
          hasChanges = true
        }
      })

      return hasChanges ? newSelected : prev
    })
  }, [tickets])

  // Clear selections when bulk status changes if tickets are no longer selectable
  useEffect(() => {
    if (bulkStatus) {
      setSelectedTickets(prev => {
        const newSelected = new Set(prev)
        let hasChanges = false

        prev.forEach(ticketId => {
          const ticket = currentTickets.find(t => t._id === ticketId)
          if (ticket && !isTicketSelectable(ticket)) {
            newSelected.delete(ticketId)
            hasChanges = true
          }
        })

        return hasChanges ? newSelected : prev
      })
    }
  }, [bulkStatus])

  // Check if a ticket is selectable based on current bulk status
  const isTicketSelectable = (ticket: Ticket) => {
    // Resolved tickets cannot be selected
    if (ticket.ticket_status === 'resolved') return false

    // If no bulk status selected yet, all non-resolved tickets are selectable
    if (!bulkStatus) return true

    // If bulk status is 'open', tickets in 'investigating' cannot be selected (can't go back)
    if (bulkStatus === 'open' && ticket.ticket_status === 'investigating') return false

    // Tickets with the same status as bulk status cannot be selected (no-op)
    if (ticket.ticket_status === bulkStatus) return false

    return true
  }

  // Checkbox handlers
  const handleSelectAll = () => {
    // Only select tickets that are selectable based on current rules
    const selectableTickets = currentTickets.filter(ticket => isTicketSelectable(ticket))

    if (selectedTickets.size === selectableTickets.length) {
      setSelectedTickets(new Set())
    } else {
      const allTicketIds = selectableTickets.map(ticket => ticket._id)
      setSelectedTickets(new Set(allTicketIds))
    }
  }

  const handleSelectTicket = (ticketId: string) => {
    const newSelected = new Set(selectedTickets)
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId)
    } else {
      newSelected.add(ticketId)
    }
    setSelectedTickets(newSelected)
  }

  // Bulk status update
  const handleBulkStatusUpdate = async () => {
    if (selectedTickets.size === 0 || !bulkStatus) return

    // Validate resolution fields if status is resolved
    if (bulkStatus === 'resolved' && (!bulkResolutionType || !bulkResolutionNotes.trim())) {
      alert('Please select a resolution type and provide resolution notes')
      return
    }

    setIsBulkUpdating(true)
    const ticketsToUpdate = currentTickets.filter(ticket => selectedTickets.has(ticket._id))

    for (const ticket of ticketsToUpdate) {
      try {
        if (bulkStatus === 'resolved') {
          await ticketsApi.updateTicketStatus(ticket._id, 'resolved', bulkResolutionType, bulkResolutionNotes)
        } else {
          await ticketsApi.updateTicketStatus(ticket._id, bulkStatus)
        }
      } catch (error) {
        console.error(`Error updating ticket ${ticket._id}:`, error)
      }
    }

    await fetchTickets()
    setIsBulkUpdating(false)
    setSelectedTickets(new Set())
    setShowBulkStatusModal(false)
    setBulkStatus('')
    setBulkResolutionType('')
    setBulkResolutionNotes('')
  }

  // Auto-scroll to highlighted ticket
  useEffect(() => {
    if (highlightedTicket && tickets.length > 0) {
      // Find the ticket in the current filtered list
      const ticketIndex = filteredTickets.findIndex(ticket => ticket._id === highlightedTicket)

      if (ticketIndex !== -1) {
        // Calculate which page the ticket is on
        const ticketPage = Math.floor(ticketIndex / ticketsPerPage) + 1

        // Set the correct page if different
        if (ticketPage !== currentPage) {
          setCurrentPage(ticketPage)
        }

        // Scroll to the ticket row after a short delay to ensure DOM is updated
        setTimeout(() => {
          const ticketElement = document.querySelector(`[data-ticket-id="${highlightedTicket}"]`)
          if (ticketElement) {
            // First scroll to the table container
            const tableContainer = document.querySelector('[data-testid="tickets-table"]')
            if (tableContainer) {
              tableContainer.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
              })
            }

            // Then scroll to the specific ticket
            setTimeout(() => {
              ticketElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
              })
            }, 200)
          }
        }, 500)
      }
    }
  }, [highlightedTicket, tickets, filteredTickets, ticketsPerPage, currentPage])

  const handleStatusChange = async (ticketId: string, newStatus: 'open' | 'investigating' | 'resolved', resolutionData?: { resolution_type: string, resolution_notes: string }) => {
    try {
      if (newStatus === 'resolved' && resolutionData) {
        await ticketsApi.updateTicketStatus(ticketId, newStatus, resolutionData.resolution_type, resolutionData.resolution_notes)
      } else {
        await ticketsApi.updateTicketStatus(ticketId, newStatus)
      }
      fetchTickets() // Refresh the tickets list
    } catch (error) {
      console.error('Error updating ticket status:', error)
      alert('Failed to update ticket status')
    }
  }

  const handleResolveTicket = async () => {
    if (!statusChangeTicket || !resolutionType || !resolutionNotes.trim()) {
      alert('Please select a resolution type and provide resolution notes')
      return
    }

    await handleStatusChange(statusChangeTicket._id, 'resolved', {
      resolution_type: resolutionType,
      resolution_notes: resolutionNotes
    })

    // Reset form and close modal
    resetResolutionForm()
  }

  const resetResolutionForm = () => {
    setShowResolutionForm(false)
    setResolutionType('')
    setResolutionNotes('')
    setStatusChangeTicket(null)
  }

  const handleSendEmail = async (ticket: Ticket) => {
    const { subject, body } = generateTicketEmail(ticket)

    // Debug logging
    console.log('Ticket organisation_id:', ticket.organisation_id)
    console.log('Is organisation_id an object?', typeof ticket.organisation_id === 'object')

    // Get recipient emails from organization (emails is an array)
    let recipientEmails: string[] = []
    if (ticket.organisation_id && typeof ticket.organisation_id === 'object') {
      console.log('Organisation object:', ticket.organisation_id)
      console.log('Emails in organisation:', ticket.organisation_id.emails)

      if ('emails' in ticket.organisation_id && Array.isArray(ticket.organisation_id.emails)) {
        recipientEmails = ticket.organisation_id.emails.filter((email: any) => email && typeof email === 'string')
      }
    } else {
      console.warn('Organisation ID is a string, not populated. Value:', ticket.organisation_id)
    }

    const recipientList = recipientEmails.join(',')
    console.log('Final recipient list:', recipientList)

    try {
      // Copy HTML body to clipboard
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([body], { type: 'text/html' }),
        'text/plain': new Blob([body], { type: 'text/plain' })
      })
      await navigator.clipboard.write([clipboardItem])

      // Open mailto with recipients and subject
      const mailtoLink = `mailto:${recipientList}?subject=${encodeURIComponent(subject)}`
      window.location.href = mailtoLink

      // Show success message
      alert(`Email body copied to clipboard!\n\nRecipient(s): ${recipientList || 'Not set'}\nSubject: ${subject}\n\nPlease paste (Ctrl+V) the email body in your email client.`)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
      alert(`Could not copy to clipboard. Please try again.\n\nRecipient(s): ${recipientList || 'Not set'}\nSubject: ${subject}`)
    }
  }

  // Generate bulk email template for multiple tickets
  const generateBulkTicketEmail = (tickets: Ticket[]) => {
    const formatDateTime = (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    }

    const getCreatedByName = (ticket: Ticket) => {
      if (ticket.created_by && typeof ticket.created_by === 'object') {
        return ticket.created_by.username || ticket.created_by.display_name || ticket.created_by.full_name || 'SOC Analyst'
      }
      return 'SOC Analyst'
    }

    const getHostInfo = (ticket: Ticket) => {
      if (ticket.hostName) return ticket.hostName
      if (ticket.agentName) return ticket.agentName
      return 'N/A'
    }

    const getAffectedAssets = (ticket: Ticket) => {
      const assets = []
      if (ticket.sourceIp) assets.push(ticket.sourceIp)
      if (ticket.hostName && ticket.sourceIp !== ticket.hostName) assets.push(`${ticket.hostName} (${ticket.sourceIp})`)
      return assets.length > 0 ? assets.join(' ') : 'N/A'
    }

    const getOrganisationName = (ticket: Ticket) => {
      if (ticket.organisation_id && typeof ticket.organisation_id === 'object') {
        if ('organisation_name' in ticket.organisation_id) {
          return ticket.organisation_id.organisation_name
        }
        if ('client_name' in ticket.organisation_id) {
          return ticket.organisation_id.client_name
        }
        if ('name' in ticket.organisation_id) {
          return ticket.organisation_id.name
        }
      }
      return 'Organisation Name'
    }

    const subject = `Bulk Status Update - ${tickets.length} Ticket${tickets.length > 1 ? 's' : ''} | ${bulkStatus ? bulkStatus.charAt(0).toUpperCase() + bulkStatus.slice(1) : 'Updated'}`

    const ticketTables = tickets.map((ticket, index) => {
      return `
    <h3 style="color: #2c3e50; margin-top: 30px; margin-bottom: 15px;">Ticket ${index + 1}: #${ticket.ticket_number}</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">Organisation</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; background: #f8f9fa;">${getOrganisationName(ticket)}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">Title</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${ticket.title}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">Date & Time (IST UTC+05:30)</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; background: #f8f9fa;">${formatDateTime(ticket.alertTimestamp || ticket.createdAt)}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">Severity</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; color: #e74c3c; font-weight: 600;">${ticket.severity.charAt(0).toUpperCase() + ticket.severity.slice(1)}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">IOCs</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; background: #f8f9fa;">${getHostInfo(ticket)}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">Category / Use-Case</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${ticket.category || '[User will input it in mail app]'}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">Detection Source</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; background: #f8f9fa;">Codec Net</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">Affected Asset(s)</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${getAffectedAssets(ticket)}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">SOC Analyst</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; background: #f8f9fa;">${getCreatedByName(ticket)}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">Current Status</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${ticket.ticket_status.charAt(0).toUpperCase() + ticket.ticket_status.slice(1)}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">New Status</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; background: #f8f9fa; color: #27ae60; font-weight: 600;">${bulkStatus ? bulkStatus.charAt(0).toUpperCase() + bulkStatus.slice(1) : 'Updated'}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px; border-bottom: 1px solid #ddd;">Incident Summary</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${ticket.description || 'Security incident detected and requires immediate attention.'}</td>
      </tr>
      <tr>
        <td class="field-name" style="font-weight: 600; color: #2c3e50; width: 35%; padding: 12px;">Required Actions</td>
        <td style="padding: 12px; background: #f8f9fa;">[User will input it in mail app]</td>
      </tr>
    </table>`
    }).join('')

    const resolutionSection = bulkStatus === 'resolved' && bulkResolutionType && bulkResolutionNotes ? `
    <div style="margin-top: 30px; padding: 20px; background: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 4px;">
      <h3 style="color: #2e7d32; margin-top: 0;">Resolution Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="font-weight: 600; color: #2c3e50; width: 35%; padding: 8px;">Type</td>
          <td style="padding: 8px;">${bulkResolutionType === 'false_positive' ? 'False Positive' : 'True Positive'}</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #2c3e50; width: 35%; padding: 8px;">Notes</td>
          <td style="padding: 8px;">${bulkResolutionNotes}</td>
        </tr>
      </table>
    </div>` : ''

    const body = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; color: #666; }
    .highlight { color: #e74c3c; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Bulk Ticket Status Update</h2>
    <p>Hi Team,</p>
    <p>We are updating the status of <strong>${tickets.length} ticket${tickets.length > 1 ? 's' : ''}</strong> on our SOC Dashboard. Please find the relevant incident details summarized below.</p>

    ${ticketTables}

    ${resolutionSection}

    <p style="margin-top: 30px;">Please review the above details and take necessary action as required.</p>
    <p class="highlight">Please treat this with priority and respond at the earliest.</p>

    <div class="footer">
      <p>Regards,<br>
      <strong>SOC Team (Codec Net)</strong></p>
    </div>
  </div>
</body>
</html>`

    return { subject, body }
  }

  const handleSendBulkEmail = async () => {
    const ticketsToEmail = currentTickets.filter(ticket => selectedTickets.has(ticket._id))
    const { subject, body } = generateBulkTicketEmail(ticketsToEmail)

    // Get unique recipient emails from all selected tickets' organizations (emails is an array)
    const recipientEmailsSet = new Set<string>()
    ticketsToEmail.forEach(ticket => {
      if (ticket.organisation_id && typeof ticket.organisation_id === 'object') {
        if ('emails' in ticket.organisation_id && Array.isArray(ticket.organisation_id.emails)) {
          ticket.organisation_id.emails.forEach((email: any) => {
            if (email && typeof email === 'string') {
              recipientEmailsSet.add(email)
            }
          })
        }
      }
    })

    const recipientList = Array.from(recipientEmailsSet).join(',')

    try {
      // Copy HTML body to clipboard
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([body], { type: 'text/html' }),
        'text/plain': new Blob([body], { type: 'text/plain' })
      })
      await navigator.clipboard.write([clipboardItem])

      // Open mailto with recipients and subject
      const mailtoLink = `mailto:${recipientList}?subject=${encodeURIComponent(subject)}`
      window.location.href = mailtoLink

      // Show success message
      alert(`Email body copied to clipboard!\n\nRecipients: ${recipientList || 'Not set'}\nSubject: ${subject}\n\nPlease paste (Ctrl+V) the email body in your email client.`)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
      alert(`Could not copy to clipboard. Please try again.\n\nRecipients: ${recipientList || 'Not set'}\nSubject: ${subject}`)
    }
  }

  const handleAssignTicket = async (ticketId: string, assigneeId: string) => {
    try {
      await ticketsApi.assignTicket(ticketId, assigneeId)
      fetchTickets() // Refresh the tickets list
    } catch (error) {
      console.error('Error assigning ticket:', error)
      alert('Failed to assign ticket')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <XMarkIcon className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Tickets</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchTickets}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search tickets by number, title, description, host, agent, or category..."
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

      {/* Header with filters and actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            All ({allTicketsCount})
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === 'open' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            Open ({tickets.filter(t => t.ticket_status === 'open').length})
          </button>
          <button
            onClick={() => setStatusFilter('investigating')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === 'investigating'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            Investigating ({tickets.filter(t => t.ticket_status === 'investigating').length})
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === 'resolved'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            Resolved ({tickets.filter(t => t.ticket_status === 'resolved').length})
          </button>
        </div>

        {/* Bulk Update Button */}
        {selectedTickets.size > 0 && canUpdateTickets && (
          <button
            onClick={() => setShowBulkStatusModal(true)}
            className="inline-flex items-center px-4 py-2 border border-blue-200 dark:border-blue-800/50 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors duration-150 shadow-sm"
          >
            <ArrowPathRoundedSquareIcon className="w-4 h-4 mr-2" />
            Update {selectedTickets.size} Ticket{selectedTickets.size > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <ArrowPathIcon className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">Loading tickets...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && currentTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ClockIcon className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {filteredTickets.length === 0 ? 'No tickets found' : 'No tickets on this page'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {filteredTickets.length === 0 
              ? 'Create your first ticket to get started.' 
              : 'Try adjusting your filters or pagination.'}
          </p>
        </div>
      )}

      {/* Tickets table */}
      {!loading && currentTickets.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-testid="tickets-table">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  {canUpdateTickets && (
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={(() => {
                          const selectableTickets = currentTickets.filter(ticket => isTicketSelectable(ticket))
                          return selectableTickets.length > 0 && selectedTickets.size === selectableTickets.length
                        })()}
                        onChange={handleSelectAll}
                        disabled={currentTickets.every(ticket => !isTicketSelectable(ticket))}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Host/Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  {canUpdateTickets && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {currentTickets.map((ticket) => (
                  <tr
                    key={ticket._id}
                    data-ticket-id={ticket._id}
                    className={clsx(
                      "hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-300 cursor-pointer",
                      highlightedTicket === ticket._id && "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 animate-pulse border-l-4 border-blue-500 shadow-lg"
                    )}
                    onClick={(e) => {
                      // Don't open modal if clicking on checkbox or buttons
                      const target = e.target as HTMLElement;
                      if (target.closest('input[type="checkbox"]') || target.closest('button')) {
                        return;
                      }
                      setSelectedTicket(ticket);
                    }}
                  >
                    {canUpdateTickets && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedTickets.has(ticket._id)}
                          onChange={() => handleSelectTicket(ticket._id)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={!isTicketSelectable(ticket)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          #{ticket.ticket_number}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {ticket.title}
                        </div>
                        {ticket.category && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {ticket.category}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx('px-2 py-1 text-xs font-medium rounded-full', getSeverityColor(ticket.severity))}>
                        {ticket.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="font-medium">
                        {ticket.hostName || ticket.custom_fields?.hostName || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {ticket.agentName || ticket.custom_fields?.agentName || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <span>
                            {(() => {
                              // Try created_by first (if populated)
                              if (ticket.created_by && typeof ticket.created_by === 'object') {
                                return ticket.created_by.username || ticket.created_by.display_name || ticket.created_by.full_name || 'Unknown';
                              }
                              // Fallback to user_id (if populated)
                              if (ticket.user_id && typeof ticket.user_id === 'object') {
                                return (ticket.user_id as any).username || (ticket.user_id as any).full_name || 'Unknown';
                              }
                              // Last resort - show the string ID or Unknown
                              return ticket.created_by || ticket.user_id || 'Unknown';
                            })()}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(ticket.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx('px-2 py-1 text-xs font-medium rounded-full', getStatusColor(ticket.ticket_status))}>
                        {ticket.ticket_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    {canUpdateTickets && (
                      <td className="px-6 py-4 text-center text-sm font-medium">
                        <div className="flex items-center justify-center">
                          <PermissionGate
                            section="tickets"
                            action="update"
                            fallback={
                              <div className="p-2 text-gray-400 rounded-lg opacity-50 cursor-not-allowed" title="No permission to change status">
                                <LockClosedIcon className="w-5 h-5" />
                              </div>
                            }
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatusChangeTicket(ticket);
                              }}
                              className="p-2 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200"
                              title="Change Status"
                            >
                              <ArrowPathRoundedSquareIcon className="w-5 h-5" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalTickets > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Show</span>
            <select
              value={ticketsPerPage}
              onChange={(e) => {
                setTicketsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              of {totalTickets} tickets
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronDoubleLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>

              <span className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronDoubleRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header with Gradient */}
            <div className={`flex-shrink-0 relative overflow-hidden ${
              selectedTicket.severity === 'critical' ? 'bg-gradient-to-r from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10' :
              selectedTicket.severity === 'major' ? 'bg-gradient-to-r from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-600/10' :
              'bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 dark:from-yellow-500/20 dark:to-yellow-600/10'
            }`}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center space-x-4">
                  <div className={`relative p-2 rounded-xl ${
                    selectedTicket.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                    selectedTicket.severity === 'major' ? 'bg-orange-100 dark:bg-orange-900/30' :
                    'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    <div className={`w-4 h-4 rounded-full ${
                      selectedTicket.severity === 'critical' ? 'bg-red-500 shadow-lg shadow-red-500/50' :
                      selectedTicket.severity === 'major' ? 'bg-orange-500 shadow-lg shadow-orange-500/50' :
                      'bg-yellow-500 shadow-lg shadow-yellow-500/50'
                    }`}></div>
                    <div className={`absolute inset-0 w-4 h-4 rounded-full animate-ping ${
                      selectedTicket.severity === 'critical' ? 'bg-red-500' :
                      selectedTicket.severity === 'major' ? 'bg-orange-500' :
                      'bg-yellow-500'
                    } opacity-75 m-2`}></div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Support Ticket
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Ticket #{selectedTicket.ticket_number}
                    </p>
                  </div>
                  <span className={clsx(
                    'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold capitalize shadow-sm',
                    getSeverityColor(selectedTicket.severity)
                  )}>
                    {selectedTicket.severity}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2.5 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-8 overflow-y-auto bg-gradient-to-b from-gray-50/30 to-white dark:from-gray-800/30 dark:to-gray-900">
              {/* Dynamic Ticket Data Table */}
              {(() => {
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
                      let displayValue = value;
                      // Format dates
                      if (key === 'createdAt' || key === 'updatedAt' || key.includes('date') || key.includes('Date') || key.includes('_at')) {
                        displayValue = formatDate(String(value));
                      }
                      rows.push({ key: fullKey, value: displayValue });
                    }
                  });

                  return rows;
                };

                const ticketData = selectedTicket;
                const skipKeys = ['custom_fields'];

                // Flatten all ticket fields
                const allRows: Array<{key: string; value: any}> = [];
                Object.keys(ticketData).forEach(key => {
                  if (skipKeys.includes(key)) return;

                  const value = ticketData[key as keyof Ticket];
                  if (value === null || value === undefined) return;

                  const rows = flattenObject({ [key]: value });
                  allRows.push(...rows);
                });

                return (
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl mr-3">
                        <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      Ticket Information
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
                          {allRows.map((row, index) => (
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

              {/* Full Alert Data Section */}
              {selectedTicket.custom_fields?.fullAlertData && (() => {
                try {
                  const alertData = JSON.parse(selectedTicket.custom_fields.fullAlertData);

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

                  // Flatten all alert fields
                  const alertRows = flattenObject(alertData);

                  return (
                    <div className="mt-8">
                      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl mr-3">
                            <InformationCircleIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          Complete Alert Data
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/30 border-b-2 border-indigo-300 dark:border-indigo-600">
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
                                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
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
                    </div>
                  );
                } catch (error) {
                  console.error('Error parsing full alert data:', error);
                  return null;
                }
              })()}

              {/* Tags Section */}
              {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                <div className="mt-8">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl mr-3">
                        <InformationCircleIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {selectedTicket.tags.map((tag, index) => (
                        <span key={index} className="px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-800 dark:text-blue-200 text-sm font-semibold rounded-xl border border-blue-200/50 dark:border-blue-700/50 shadow-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex justify-between items-center p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <TicketIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Ticket #{selectedTicket.ticket_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Created {formatDate(selectedTicket.createdAt)}</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Status Change Modal */}
      {statusChangeTicket && canUpdateTickets && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header with Gradient */}
            <div className={`flex-shrink-0 relative overflow-hidden ${
              statusChangeTicket.severity === 'critical' ? 'bg-gradient-to-r from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10' :
              statusChangeTicket.severity === 'major' ? 'bg-gradient-to-r from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-600/10' :
              'bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 dark:from-yellow-500/20 dark:to-yellow-600/10'
            }`}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center space-x-4">
                  <div className={`relative p-2 rounded-xl ${
                    statusChangeTicket.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                    statusChangeTicket.severity === 'major' ? 'bg-orange-100 dark:bg-orange-900/30' :
                    'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    <div className={`w-4 h-4 rounded-full ${
                      statusChangeTicket.severity === 'critical' ? 'bg-red-500 shadow-lg shadow-red-500/50' :
                      statusChangeTicket.severity === 'major' ? 'bg-orange-500 shadow-lg shadow-orange-500/50' :
                      'bg-yellow-500 shadow-lg shadow-yellow-500/50'
                    }`}></div>
                    <div className={`absolute inset-0 w-4 h-4 rounded-full animate-ping ${
                      statusChangeTicket.severity === 'critical' ? 'bg-red-500' :
                      statusChangeTicket.severity === 'major' ? 'bg-orange-500' :
                      'bg-yellow-500'
                    } opacity-75 m-2`}></div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Change Status
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Ticket #{statusChangeTicket.ticket_number}
                    </p>
                  </div>
                  <span className={clsx(
                    'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold capitalize shadow-sm',
                    getSeverityColor(statusChangeTicket.severity)
                  )}>
                    {statusChangeTicket.severity}
                  </span>
                </div>
                <button
                  onClick={resetResolutionForm}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2.5 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-gray-50/30 to-white dark:from-gray-800/30 dark:to-gray-900">
              <div className="space-y-4">
                {/* Current Ticket Info */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl mr-3">
                      <TicketIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    Ticket Information
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider block mb-2">Title</label>
                      <p className="text-sm text-gray-900 dark:text-white bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-3 rounded-xl border border-gray-200/50 dark:border-gray-600/50 font-semibold">
                        {statusChangeTicket.title}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider block mb-2">Current Status</label>
                      <div className="mt-1">
                        <span className={clsx(
                          'inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold capitalize border',
                          statusChangeTicket.ticket_status === 'open' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700' :
                          statusChangeTicket.ticket_status === 'investigating' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700' :
                          'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700'
                        )}>
                          {statusChangeTicket.ticket_status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Selection */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl mr-3">
                      <ArrowPathRoundedSquareIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    Select New Status
                  </h4>
                  <div className="space-y-3">
                    {['open', 'investigating', 'resolved'].map((status) => {
                      // Status progression rules
                      const currentStatus = statusChangeTicket.ticket_status;
                      let isDisabled = false;
                      let disabledReason = '';

                      // Rule 1: If current status is 'resolved', disable all other statuses
                      if (currentStatus === 'resolved' && status !== 'resolved') {
                        isDisabled = true;
                        disabledReason = 'Resolved tickets cannot be changed';
                      }

                      // Rule 2: If current status is 'investigating', disable 'open'
                      if (currentStatus === 'investigating' && status === 'open') {
                        isDisabled = true;
                        disabledReason = 'Cannot go back to open from investigating';
                      }

                      // Current status should be disabled (no-op)
                      if (status === currentStatus) {
                        isDisabled = true;
                        disabledReason = 'Current status';
                      }

                      return (
                        <button
                          key={status}
                          onClick={() => {
                            if (!isDisabled) {
                              if (status === 'resolved') {
                                setShowResolutionForm(true)
                              } else {
                                handleStatusChange(statusChangeTicket._id, status as any)
                                setStatusChangeTicket(null)
                              }
                            }
                          }}
                          disabled={isDisabled}
                          title={isDisabled ? disabledReason : ''}
                          className={clsx(
                            'w-full text-left p-3 rounded-xl border-2 transition-all duration-200 group',
                            isDisabled
                              ? 'bg-gray-100 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 cursor-not-allowed opacity-50'
                              : 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-gray-200 dark:border-gray-600 hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg cursor-pointer transform hover:scale-[1.02]'
                          )}
                        >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className={clsx(
                              'inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold capitalize border',
                              status === 'open' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700' :
                              status === 'investigating' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700' :
                              'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700'
                            )}>
                              {status.replace('_', ' ')}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {status === 'open' && 'Set as Open'}
                                {status === 'investigating' && 'Start Investigation'}
                                {status === 'resolved' && 'Mark as Resolved'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {status === 'open' && 'Mark ticket as new or reopened'}
                                {status === 'investigating' && 'Begin working on this ticket'}
                                {status === 'resolved' && 'Close ticket as completed'}
                              </p>
                            </div>
                          </div>
                          {!isDisabled && status !== statusChangeTicket.ticket_status && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowPathIcon className="w-5 h-5 text-blue-500" />
                            </div>
                          )}
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>

                {/* Resolution Form */}
                {showResolutionForm && (
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl mr-3">
                        <InformationCircleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      Resolution Details
                    </h4>

                    <div className="space-y-4">
                      {/* Resolution Type */}
                      <div>
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider block mb-3">
                          Resolution Type <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-3">
                          <button
                            onClick={() => setResolutionType('false_positive')}
                            className={clsx(
                              'w-full text-left p-3 rounded-xl border-2 transition-all duration-200',
                              resolutionType === 'false_positive'
                                ? 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-300 dark:border-green-600'
                                : 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={clsx(
                                  'w-4 h-4 rounded-full border-2',
                                  resolutionType === 'false_positive'
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300 dark:border-gray-600'
                                )}></div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">False Positive</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">This alert was incorrectly triggered</p>
                                </div>
                              </div>
                            </div>
                          </button>

                          <button
                            onClick={() => setResolutionType('true_positive')}
                            className={clsx(
                              'w-full text-left p-3 rounded-xl border-2 transition-all duration-200',
                              resolutionType === 'true_positive'
                                ? 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-300 dark:border-green-600'
                                : 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={clsx(
                                  'w-4 h-4 rounded-full border-2',
                                  resolutionType === 'true_positive'
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300 dark:border-gray-600'
                                )}></div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">True Positive</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">This alert was legitimate and resolved</p>
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Resolution Notes */}
                      <div>
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider block mb-3">
                          Resolution Notes <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Describe how this ticket was resolved..."
                          className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                          rows={4}
                          required
                        />
                      </div>

                      {/* Resolution Actions */}
                      <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => {
                            setShowResolutionForm(false)
                            setResolutionType('')
                            setResolutionNotes('')
                          }}
                          className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleResolveTicket}
                          disabled={!resolutionType || !resolutionNotes.trim()}
                          className={clsx(
                            'flex-1 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200',
                            resolutionType && resolutionNotes.trim()
                              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                          )}
                        >
                          Resolve Ticket
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex justify-between items-center p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <ArrowPathRoundedSquareIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Status Change</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Select a new status to update the ticket</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleSendEmail(statusChangeTicket!)}
                    className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 border-2 border-blue-600 hover:border-blue-700 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg flex items-center space-x-2"
                  >
                    <EnvelopeIcon className="w-4 h-4" />
                    <span>Send Mail</span>
                  </button>
                  <button
                    onClick={resetResolutionForm}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Status Update Modal */}
      {showBulkStatusModal && canUpdateTickets && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10">
              <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <ArrowPathRoundedSquareIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Bulk Status Update
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Update {selectedTickets.size} ticket{selectedTickets.size > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowBulkStatusModal(false)
                    setBulkStatus('')
                    setBulkResolutionType('')
                    setBulkResolutionNotes('')
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2.5 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-gray-50/30 to-white dark:from-gray-800/30 dark:to-gray-900">
              <div className="space-y-4">
                {/* Status Selection */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl mr-3">
                      <ArrowPathRoundedSquareIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    Select New Status
                  </h4>
                  <div className="space-y-3">
                    {['open', 'investigating', 'resolved'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setBulkStatus(status as any)}
                        className={clsx(
                          'w-full text-left p-3 rounded-xl border-2 transition-all duration-200',
                          bulkStatus === status
                            ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-300 dark:border-blue-600'
                            : 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={clsx(
                              'w-4 h-4 rounded-full border-2',
                              bulkStatus === status
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300 dark:border-gray-600'
                            )}></div>
                            <span className={clsx(
                              'inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold capitalize border',
                              status === 'open' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700' :
                              status === 'investigating' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700' :
                              'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700'
                            )}>
                              {status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution Form for Resolved Status */}
                {bulkStatus === 'resolved' && (
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl mr-3">
                        <InformationCircleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      Resolution Details
                    </h4>

                    <div className="space-y-4">
                      {/* Resolution Type */}
                      <div>
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider block mb-3">
                          Resolution Type <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-3">
                          <button
                            onClick={() => setBulkResolutionType('false_positive')}
                            className={clsx(
                              'w-full text-left p-3 rounded-xl border-2 transition-all duration-200',
                              bulkResolutionType === 'false_positive'
                                ? 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-300 dark:border-green-600'
                                : 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={clsx(
                                  'w-4 h-4 rounded-full border-2',
                                  bulkResolutionType === 'false_positive'
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300 dark:border-gray-600'
                                )}></div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">False Positive</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">These alerts were incorrectly triggered</p>
                                </div>
                              </div>
                            </div>
                          </button>

                          <button
                            onClick={() => setBulkResolutionType('true_positive')}
                            className={clsx(
                              'w-full text-left p-3 rounded-xl border-2 transition-all duration-200',
                              bulkResolutionType === 'true_positive'
                                ? 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-300 dark:border-green-600'
                                : 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={clsx(
                                  'w-4 h-4 rounded-full border-2',
                                  bulkResolutionType === 'true_positive'
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300 dark:border-gray-600'
                                )}></div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">True Positive</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">These alerts were legitimate and resolved</p>
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Resolution Notes */}
                      <div>
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider block mb-3">
                          Resolution Notes <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={bulkResolutionNotes}
                          onChange={(e) => setBulkResolutionNotes(e.target.value)}
                          placeholder="Describe how these tickets were resolved..."
                          className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                          rows={4}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex justify-between items-center p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <TicketIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedTickets.size} Ticket{selectedTickets.size > 1 ? 's' : ''} Selected
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status will be updated for all selected tickets</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleSendBulkEmail}
                    className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 border-2 border-purple-600 hover:border-purple-700 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg flex items-center space-x-2"
                  >
                    <EnvelopeIcon className="w-4 h-4" />
                    <span>Send Mail</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBulkStatusModal(false)
                      setBulkStatus('')
                      setBulkResolutionType('')
                      setBulkResolutionNotes('')
                    }}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkStatusUpdate}
                    disabled={!bulkStatus || isBulkUpdating || (bulkStatus === 'resolved' && (!bulkResolutionType || !bulkResolutionNotes.trim()))}
                    className={clsx(
                      'px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 hover:scale-105 shadow-lg flex items-center space-x-2',
                      bulkStatus && !isBulkUpdating && !(bulkStatus === 'resolved' && (!bulkResolutionType || !bulkResolutionNotes.trim()))
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-2 border-blue-500'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed border-2 border-gray-300 dark:border-gray-600'
                    )}
                  >
                    {isBulkUpdating ? (
                      <>
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <ArrowPathRoundedSquareIcon className="w-4 h-4" />
                        <span>Update Status</span>
                      </>
                    )}
                  </button>
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