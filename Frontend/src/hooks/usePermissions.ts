'use client'

import { useState, useEffect } from 'react'
import { getUserFromCookies } from '@/lib/auth'

interface Permissions {
  tickets?: {
    create?: boolean
    read?: boolean
    update?: boolean
    delete?: boolean
  }
  alerts?: {
    create?: boolean
    read?: boolean
    update?: boolean
    delete?: boolean
  }
  overview?: {
    read?: boolean
  }
  [key: string]: any
}

interface UsePermissionsReturn {
  permissions: Permissions | null
  hasPermission: (section: string, action: string) => boolean
  canCreateTickets: boolean
  canViewTickets: boolean
  canManageAlerts: boolean
  isLoading: boolean
}

export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPermissions = () => {
      try {
        const user = getUserFromCookies()
        if (user && user.permissions) {
          setPermissions(user.permissions as Permissions)
        } else {
          setPermissions(null)
        }
      } catch (error) {
        console.error('Failed to load permissions:', error)
        setPermissions(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadPermissions()

    // Listen for auth changes (in case user logs out/in)
    const interval = setInterval(loadPermissions, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const hasPermission = (section: string, action: string): boolean => {
    if (!permissions) return false

    // Navigate nested permissions object
    const sectionPerms = permissions[section]
    if (!sectionPerms || typeof sectionPerms !== 'object') return false

    return !!sectionPerms[action]
  }

  // Convenience methods for common permissions
  const canCreateTickets = hasPermission('tickets', 'create')
  const canViewTickets = hasPermission('tickets', 'read')
  const canManageAlerts = hasPermission('alerts', 'read')

  return {
    permissions,
    hasPermission,
    canCreateTickets,
    canViewTickets,
    canManageAlerts,
    isLoading
  }
}