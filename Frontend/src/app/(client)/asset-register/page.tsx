'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useClient } from '@/contexts/ClientContext'
import { usePermissions } from '@/hooks/usePermissions'
import Cookies from 'js-cookie'
const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP
import {
  ArrowPathIcon,
  PlusIcon,
  ServerIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

interface Asset {
  _id: string
  organisation_id: string
  asset_tag: string
  asset_name: string
  asset_type: string
  asset_category?: string
  ip_address?: string
  mac_address?: string
  network_zone: string
  operating_system?: string
  os_version?: string
  os_architecture?: string
  kernel_version?: string
  wazuh_agent_id?: string
  wazuh_agent_name?: string
  wazuh_agent_status: string
  last_keepalive?: string
  status: string
  asset_criticality: string
  data_classification: string
  environment: string
  manufacturer?: string
  model?: string
  serial_number?: string
  location?: string
  notes?: string
  tags?: string[]
  created_by?: { username: string; email: string }
  updated_by?: { username: string; email: string }
  createdAt: string
  updatedAt: string
}

interface AssetFormData {
  asset_tag: string
  asset_name: string
  asset_type: string
  asset_category: string
  ip_address: string
  mac_address: string
  network_zone: string
  operating_system: string
  os_version: string
  os_architecture: string
  kernel_version: string
  status: string
  asset_criticality: string
  data_classification: string
  environment: string
  manufacturer: string
  model: string
  serial_number: string
  location: string
  notes: string
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'disconnected': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    case 'maintenance': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'quarantined': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
    case 'retired': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const getCriticalityColor = (criticality: string) => {
  switch (criticality) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return <CheckCircleIcon className="w-5 h-5 text-green-500" />
    case 'inactive': return <XCircleIcon className="w-5 h-5 text-gray-500" />
    case 'maintenance': return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
    case 'quarantined': return <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
    case 'retired': return <XCircleIcon className="w-5 h-5 text-purple-500" />
    default: return <XCircleIcon className="w-5 h-5 text-gray-500" />
  }
}

export default function AssetRegisterPage() {
  const { selectedClient, isLoading: isClientLoading } = useClient()
  const { hasPermission } = usePermissions()
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Check if user has any action permissions
  const canUpdate = hasPermission('assets', 'update')
  const canDelete = hasPermission('assets', 'delete')
  const showActionsColumn = canUpdate || canDelete

  // Persist filters in localStorage
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('assetRegister_searchTerm') || ''
    }
    return ''
  })
  const [filterType, setFilterType] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('assetRegister_filterType') || 'all'
    }
    return 'all'
  })
  const [filterStatus, setFilterStatus] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('assetRegister_filterStatus') || 'all'
    }
    return 'all'
  })
  const [filterCriticality, setFilterCriticality] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('assetRegister_filterCriticality') || 'all'
    }
    return 'all'
  })

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('assetRegister_searchTerm', searchTerm)
    }
  }, [searchTerm])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('assetRegister_filterType', filterType)
    }
  }, [filterType])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('assetRegister_filterStatus', filterStatus)
    }
  }, [filterStatus])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('assetRegister_filterCriticality', filterCriticality)
    }
  }, [filterCriticality])
  const [formData, setFormData] = useState<AssetFormData>({
    asset_tag: '',
    asset_name: '',
    asset_type: 'endpoint',
    asset_category: '',
    ip_address: '',
    mac_address: '',
    network_zone: 'internal',
    operating_system: '',
    os_version: '',
    os_architecture: '',
    kernel_version: '',
    status: 'active',
    asset_criticality: 'low',
    data_classification: 'internal',
    environment: 'production',
    manufacturer: '',
    model: '',
    serial_number: '',
    location: '',
    notes: ''
  })

  useEffect(() => {
    if (selectedClient) {
      fetchAssets()
      // Auto-sync assets from Wazuh on initial load
      syncAgents()
    }
  }, [selectedClient])

  useEffect(() => {
    applyFilters()
  }, [assets, searchTerm, filterType, filterStatus, filterCriticality])

  const fetchAssets = async () => {
    if (!selectedClient) return

    setLoading(true)
    try {
      const token = Cookies.get('auth_token')
      console.log('🔍 Asset Register - Token:', token ? 'Present' : 'Missing')
      console.log('🔍 Asset Register - BASE_URL:', BASE_URL)
      console.log('🔍 Asset Register - Full URL:', `${BASE_URL}/asset-register?organisation_id=${selectedClient.id}`)

      const response = await fetch(
        `${BASE_URL}/asset-register?organisation_id=${selectedClient.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setAssets(data.data || [])
      } else {
        const errorText = await response.text()
        console.error('Failed to fetch assets:', response.status, errorText)
      }
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const syncAgents = async (showAlert = false) => {
    if (!selectedClient) return

    setSyncing(true)
    try {
      const token = Cookies.get('auth_token')
      const response = await fetch(`${BASE_URL}/asset-register/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organisation_id: selectedClient.id
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (showAlert) {
          // alert(`Sync completed: ${data.data.created} created, ${data.data.updated} updated, ${data.data.skipped} skipped`)
        }
        fetchAssets()
      } else {
        const error = await response.json()
        if (showAlert) {
          alert(`Sync failed: ${error.message}`)
        }
      }
    } catch (error) {
      console.error('Error syncing agents:', error)
      if (showAlert) {
        alert('Error syncing agents')
      }
    } finally {
      setSyncing(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...assets]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(asset =>
        asset.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.asset_tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.ip_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.operating_system?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(asset => asset.asset_type === filterType)
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(asset => asset.status === filterStatus)
    }

    // Criticality filter
    if (filterCriticality !== 'all') {
      filtered = filtered.filter(asset => asset.asset_criticality === filterCriticality)
    }

    setFilteredAssets(filtered)
  }

  const handleAddAsset = async () => {
    if (!selectedClient) return

    try {
      const token = Cookies.get('auth_token')

      // Clean up empty strings for optional fields (especially enums)
      const cleanedData = {
        ...formData,
        organisation_id: selectedClient.id,
        os_architecture: formData.os_architecture || undefined,
        asset_category: formData.asset_category || undefined,
        ip_address: formData.ip_address || undefined,
        mac_address: formData.mac_address || undefined,
        operating_system: formData.operating_system || undefined,
        os_version: formData.os_version || undefined,
        kernel_version: formData.kernel_version || undefined,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        serial_number: formData.serial_number || undefined,
        location: formData.location || undefined,
        notes: formData.notes || undefined,
        // Explicitly exclude Wazuh fields for manually created assets
        wazuh_agent_status: undefined,
        wazuh_agent_id: undefined,
        wazuh_agent_name: undefined
      }

      const response = await fetch(`${BASE_URL}/asset-register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanedData)
      })

      if (response.ok) {
        alert('Asset created successfully')
        setShowAddModal(false)
        resetForm()
        fetchAssets()
      } else {
        const error = await response.json()
        console.error('API Error Response:', error)
        alert(`Failed to create asset: ${error.message || JSON.stringify(error)}`)
      }
    } catch (error: any) {
      console.error('Error creating asset:', error)
      alert(`Error creating asset: ${error.message || 'Unknown error'}`)
    }
  }

  const handleEditAsset = async () => {
    if (!selectedAsset) return

    try {
      const token = Cookies.get('auth_token')

      // Clean up empty strings for optional fields (especially enums)
      const cleanedData = {
        ...formData,
        os_architecture: formData.os_architecture || undefined,
        asset_category: formData.asset_category || undefined,
        ip_address: formData.ip_address || undefined,
        mac_address: formData.mac_address || undefined,
        operating_system: formData.operating_system || undefined,
        os_version: formData.os_version || undefined,
        kernel_version: formData.kernel_version || undefined,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        serial_number: formData.serial_number || undefined,
        location: formData.location || undefined,
        notes: formData.notes || undefined
      }

      const response = await fetch(`${BASE_URL}/asset-register/${selectedAsset._id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanedData)
      })

      if (response.ok) {
        alert('Asset updated successfully')
        setShowEditModal(false)
        setSelectedAsset(null)
        resetForm()
        fetchAssets()
      } else {
        const error = await response.json()
        alert(`Failed to update asset: ${error.message}`)
      }
    } catch (error) {
      console.error('Error updating asset:', error)
      alert('Error updating asset')
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return

    try {
      const token = Cookies.get('auth_token')
      const response = await fetch(`${BASE_URL}/asset-register/${assetId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Deleted from Asset Register Management page'
        })
      })

      if (response.ok) {
        alert('Asset deleted successfully')
        fetchAssets()
      } else {
        const error = await response.json()
        alert(`Failed to delete asset: ${error.message}`)
      }
    } catch (error) {
      console.error('Error deleting asset:', error)
      alert('Error deleting asset')
    }
  }

  const openDetailModal = (asset: Asset) => {
    setSelectedAsset(asset)
    setShowDetailModal(true)
  }

  const openEditModal = (asset: Asset) => {
    setSelectedAsset(asset)
    setFormData({
      asset_tag: asset.asset_tag,
      asset_name: asset.asset_name,
      asset_type: asset.asset_type,
      asset_category: asset.asset_category || '',
      ip_address: asset.ip_address || '',
      mac_address: asset.mac_address || '',
      network_zone: asset.network_zone,
      operating_system: asset.operating_system || '',
      os_version: asset.os_version || '',
      os_architecture: asset.os_architecture || '',
      kernel_version: asset.kernel_version || '',
      status: asset.status,
      asset_criticality: asset.asset_criticality,
      data_classification: asset.data_classification,
      environment: asset.environment,
      manufacturer: asset.manufacturer || '',
      model: asset.model || '',
      serial_number: asset.serial_number || '',
      location: asset.location || '',
      notes: asset.notes || ''
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      asset_tag: '',
      asset_name: '',
      asset_type: 'endpoint',
      asset_category: '',
      ip_address: '',
      mac_address: '',
      network_zone: 'internal',
      operating_system: '',
      os_version: '',
      os_architecture: '',
      kernel_version: '',
      status: 'active',
      asset_criticality: 'low',
      data_classification: 'internal',
      environment: 'production',
      manufacturer: '',
      model: '',
      serial_number: '',
      location: '',
      notes: ''
    })
  }

  // Show loading state while client is being loaded
  if (isClientLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading client information...</p>
        </div>
      </div>
    )
  }

  // Show message if no client is selected after loading
  if (!selectedClient) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                No Client Selected
              </h3>
              <p className="text-yellow-800 dark:text-yellow-200 mb-4">
                Please select a client from the <a href="/overview" className="underline font-medium">Overview page</a> to view and manage assets.
              </p>
              <a
                href="/overview"
                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Overview
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Asset Register Management</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage and track all organizational assets
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => syncAgents(true)}
            disabled={syncing}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
              'bg-blue-600 hover:bg-blue-700 text-white shadow-lg',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <ArrowPathIcon className={clsx('w-5 h-5', syncing && 'animate-spin')} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          {hasPermission('assets', 'create') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-green-600 hover:bg-green-700 text-white shadow-lg"
            >
              <PlusIcon className="w-5 h-5" />
              Add Asset Manually
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="endpoint">Endpoint</option>
            <option value="server">Server</option>
            <option value="network_device">Network Device</option>
            <option value="mobile_device">Mobile Device</option>
            <option value="iot_device">IoT Device</option>
            <option value="virtual_machine">Virtual Machine</option>
            <option value="cloud_instance">Cloud Instance</option>
            <option value="container">Container</option>
            <option value="application">Application</option>
            <option value="database">Database</option>
            <option value="security_device">Security Device</option>
            <option value="storage_device">Storage Device</option>
            <option value="printer">Printer</option>
            <option value="other">Other</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
            <option value="quarantined">Quarantined</option>
            <option value="retired">Retired</option>
          </select>

          {/* Criticality Filter */}
          <select
            value={filterCriticality}
            onChange={(e) => setFilterCriticality(e.target.value)}
            className="px-4 py-2 bbg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
          >
            <option value="all">All Criticality</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Assets</p>
              <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{assets.length}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <ServerIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Active</p>
              <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
                {assets.filter(a => a.status === 'active').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Critical</p>
              <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
                {assets.filter(a => a.asset_criticality === 'critical').length}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Inactive</p>
              <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
                {assets.filter(a => a.status === 'inactive').length}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-900/30 rounded-xl">
              <XCircleIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Operating System
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Criticality
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Environment
                </th>
                {showActionsColumn && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center">
                      <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No assets found
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr
                    key={asset._id}
                    onClick={() => openDetailModal(asset)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {asset.asset_name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {asset.asset_tag}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {asset.asset_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {asset.ip_address || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {asset.operating_system || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                        getStatusColor(asset.status)
                      )}>
                        {getStatusIcon(asset.status)}
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'inline-flex px-3 py-1 rounded-full text-xs font-medium',
                        getCriticalityColor(asset.asset_criticality)
                      )}>
                        {asset.asset_criticality}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {asset.environment.replace(/_/g, ' ')}
                      </span>
                    </td>
                    {showActionsColumn && (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {canUpdate && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditModal(asset)
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Edit Asset"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteAsset(asset._id)
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete Asset"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset Modal */}
      {showAddModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Asset Manually</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Tag *
                    </label>
                    <input
                      type="text"
                      value={formData.asset_tag}
                      onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Name *
                    </label>
                    <input
                      type="text"
                      value={formData.asset_name}
                      onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Classification */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Classification</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Type
                    </label>
                    <select
                      value={formData.asset_type}
                      onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="endpoint">Endpoint</option>
                      <option value="server">Server</option>
                      <option value="network_device">Network Device</option>
                      <option value="mobile_device">Mobile Device</option>
                      <option value="iot_device">IoT Device</option>
                      <option value="virtual_machine">Virtual Machine</option>
                      <option value="cloud_instance">Cloud Instance</option>
                      <option value="container">Container</option>
                      <option value="application">Application</option>
                      <option value="database">Database</option>
                      <option value="security_device">Security Device</option>
                      <option value="storage_device">Storage Device</option>
                      <option value="printer">Printer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Category
                    </label>
                    <input
                      type="text"
                      value={formData.asset_category}
                      onChange={(e) => setFormData({ ...formData, asset_category: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Network Zone
                    </label>
                    <select
                      value={formData.network_zone}
                      onChange={(e) => setFormData({ ...formData, network_zone: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="internal">Internal</option>
                      <option value="dmz">DMZ</option>
                      <option value="external">External</option>
                      <option value="management">Management</option>
                      <option value="guest">Guest</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="quarantined">Quarantined</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Risk & Security */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk & Security</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Criticality
                    </label>
                    <select
                      value={formData.asset_criticality}
                      onChange={(e) => setFormData({ ...formData, asset_criticality: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Data Classification
                    </label>
                    <select
                      value={formData.data_classification}
                      onChange={(e) => setFormData({ ...formData, data_classification: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="public">Public</option>
                      <option value="internal">Internal</option>
                      <option value="confidential">Confidential</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Environment
                    </label>
                    <select
                      value={formData.environment}
                      onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="development">Development</option>
                      <option value="testing">Testing</option>
                      <option value="staging">Staging</option>
                      <option value="production">Production</option>
                      <option value="disaster_recovery">Disaster Recovery</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Network Configuration */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Network Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      IP Address
                    </label>
                    <input
                      type="text"
                      value={formData.ip_address}
                      onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      MAC Address
                    </label>
                    <input
                      type="text"
                      value={formData.mac_address}
                      onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* System Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Operating System
                    </label>
                    <input
                      type="text"
                      value={formData.operating_system}
                      onChange={(e) => setFormData({ ...formData, operating_system: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      OS Version
                    </label>
                    <input
                      type="text"
                      value={formData.os_version}
                      onChange={(e) => setFormData({ ...formData, os_version: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      OS Architecture
                    </label>
                    <select
                      value={formData.os_architecture}
                      onChange={(e) => setFormData({ ...formData, os_architecture: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="">Select Architecture</option>
                      <option value="x86">x86</option>
                      <option value="x64">x64</option>
                      <option value="arm">ARM</option>
                      <option value="arm64">ARM64</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kernel Version
                    </label>
                    <input
                      type="text"
                      value={formData.kernel_version}
                      onChange={(e) => setFormData({ ...formData, kernel_version: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Hardware Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hardware Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Manufacturer
                    </label>
                    <input
                      type="text"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Model
                    </label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Serial Number
                    </label>
                    <input
                      type="text"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>

            </div>

            {/* Action Buttons */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAsset}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Create Asset
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Asset Modal */}
      {showEditModal && selectedAsset && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Asset</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedAsset(null)
                  resetForm()
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Same form fields as Add Modal */}
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Tag *
                    </label>
                    <input
                      type="text"
                      value={formData.asset_tag}
                      onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Name *
                    </label>
                    <input
                      type="text"
                      value={formData.asset_name}
                      onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Classification */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Classification</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Type
                    </label>
                    <select
                      value={formData.asset_type}
                      onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="endpoint">Endpoint</option>
                      <option value="server">Server</option>
                      <option value="network_device">Network Device</option>
                      <option value="mobile_device">Mobile Device</option>
                      <option value="iot_device">IoT Device</option>
                      <option value="virtual_machine">Virtual Machine</option>
                      <option value="cloud_instance">Cloud Instance</option>
                      <option value="container">Container</option>
                      <option value="application">Application</option>
                      <option value="database">Database</option>
                      <option value="security_device">Security Device</option>
                      <option value="storage_device">Storage Device</option>
                      <option value="printer">Printer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Category
                    </label>
                    <input
                      type="text"
                      value={formData.asset_category}
                      onChange={(e) => setFormData({ ...formData, asset_category: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Network Zone
                    </label>
                    <select
                      value={formData.network_zone}
                      onChange={(e) => setFormData({ ...formData, network_zone: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="internal">Internal</option>
                      <option value="dmz">DMZ</option>
                      <option value="external">External</option>
                      <option value="management">Management</option>
                      <option value="guest">Guest</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="quarantined">Quarantined</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Risk & Security */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk & Security</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Criticality
                    </label>
                    <select
                      value={formData.asset_criticality}
                      onChange={(e) => setFormData({ ...formData, asset_criticality: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Data Classification
                    </label>
                    <select
                      value={formData.data_classification}
                      onChange={(e) => setFormData({ ...formData, data_classification: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="public">Public</option>
                      <option value="internal">Internal</option>
                      <option value="confidential">Confidential</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Environment
                    </label>
                    <select
                      value={formData.environment}
                      onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="development">Development</option>
                      <option value="testing">Testing</option>
                      <option value="staging">Staging</option>
                      <option value="production">Production</option>
                      <option value="disaster_recovery">Disaster Recovery</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* Action Buttons */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedAsset(null)
                  resetForm()
                }}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditAsset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Asset
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Asset Detail Modal */}
      {showDetailModal && selectedAsset && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Asset Details</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedAsset(null)
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                // Flatten the entire asset object
                const flattenObject = (obj: any, prefix: string = ''): Array<{key: string; value: any}> => {
                  const rows: Array<{key: string; value: any}> = [];

                  Object.keys(obj).forEach(key => {
                    const value = obj[key];
                    const fullKey = prefix ? `${prefix}.${key}` : key;

                    if (value === null || value === undefined) {
                      rows.push({ key: fullKey, value: 'N/A' });
                    } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                      // Nested object - flatten it with dot notation
                      const nestedRows = flattenObject(value, fullKey);
                      rows.push(...nestedRows);
                    } else if (Array.isArray(value)) {
                      // Array - show as comma-separated values
                      const arrayValue = value.every(v => typeof v === 'string' || typeof v === 'number')
                        ? value.join(', ')
                        : JSON.stringify(value);
                      rows.push({ key: fullKey, value: arrayValue || 'Empty Array' });
                    } else if (value instanceof Date) {
                      // Date - format it
                      rows.push({ key: fullKey, value: new Date(value).toLocaleString() });
                    } else {
                      // Primitive value
                      rows.push({ key: fullKey, value: String(value) });
                    }
                  });

                  return rows;
                };

                const assetRows = flattenObject(selectedAsset);

                return (
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl mr-3">
                        <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      {selectedAsset.asset_name} - Complete Asset Information
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-1/3">
                              Field Name
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-2/3">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {assetRows.map((row, index) => (
                            <tr
                              key={index}
                              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white font-mono">
                                {row.key}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                                {row.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
