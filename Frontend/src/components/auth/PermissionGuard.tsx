'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getUserFromCookies } from '@/lib/auth'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface PermissionGuardProps {
  children: React.ReactNode
  requiredPermissions?: string[]      // Permission-based check (PRIMARY)
  allowedRoles?: string[]              // Role-based fallback (DEPRECATED)
  redirectTo?: string                  // Redirect path for unauthorized
  showError?: boolean                  // Show error UI before redirect
  requireAll?: boolean                 // AND vs OR logic for permissions
}

/**
 * PermissionGuard Component
 *
 * Implements comprehensive permission-based access control for frontend routes
 *
 * Security Features:
 * 1. Permission Validation: Checks user permissions from JWT token/cookies
 * 2. Fail-Secure: Denies access by default if no rules specified
 * 3. Audit Logging: Logs all unauthorized access attempts to console
 * 4. User Feedback: Shows clear error message explaining why access was denied
 * 5. Auto-Redirect: Redirects unauthorized users to dashboard after 2.5 seconds
 *
 * @param children - Content to render when user has required permissions
 * @param requiredPermissions - Array of permission strings (e.g., ['siem:access', 'users:read'])
 * @param allowedRoles - Array of role names (DEPRECATED - use requiredPermissions instead)
 * @param redirectTo - Path to redirect unauthorized users (default: '/dashboard')
 * @param showError - Whether to show error UI before redirect (default: true)
 * @param requireAll - If true, user must have ALL permissions (AND logic). If false, user needs ANY permission (OR logic). Default: false
 */
export default function PermissionGuard({
  children,
  requiredPermissions = [],
  allowedRoles = [],
  redirectTo = '/dashboard',
  showError = true,
  requireAll = false
}: PermissionGuardProps) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [userInfo, setUserInfo] = useState<any>(null)

  // Memoize arrays to prevent infinite loop from reference changes
  const stableRequiredPermissions = useMemo(() => requiredPermissions, [JSON.stringify(requiredPermissions)])
  const stableAllowedRoles = useMemo(() => allowedRoles, [JSON.stringify(allowedRoles)])

  useEffect(() => {
    // Get user from cookies
    const user = getUserFromCookies()

    if (!user) {
      console.warn('🚫 PermissionGuard: No user found in cookies')
      setIsAuthorized(false)
      setUserInfo(null)
      return
    }

    // DEBUG: Log the entire user object to see what we have
    console.log('🔍 DEBUG PermissionGuard: Full user object:', user)
    console.log('🔍 DEBUG PermissionGuard: user.permissions:', user.permissions)
    console.log('🔍 DEBUG PermissionGuard: user.role:', user.role)

    setUserInfo(user)

    // Extract permissions from user object
    const userPermissions = user.permissions || {}
    const userRole = user.role || ''

    // If no rules specified, DENY by default (fail-secure)
    if (stableRequiredPermissions.length === 0 && stableAllowedRoles.length === 0) {
      console.warn('🚫 PermissionGuard: No access rules specified - denying by default')
      setIsAuthorized(false)
      return
    }

    // Convert nested permissions to flat array
    // Example: { siem: { access: true, read: true } } => ['siem:access', 'siem:read']
    const userPermissionNames: string[] = []
    Object.keys(userPermissions).forEach(resource => {
      const actions = userPermissions[resource]
      if (typeof actions === 'object' && actions !== null) {
        // Nested format: { siem: { access: true, read: true } }
        Object.keys(actions).forEach(action => {
          if (actions[action] === true || actions[action] === 1) {
            userPermissionNames.push(`${resource}:${action}`)
          }
        })
      } else if (actions === true || actions === 1) {
        // Flat format (legacy): { "siem:access": true }
        userPermissionNames.push(resource)
      }
    })

    // DEBUG: Log extracted permissions
    console.log('🔍 DEBUG PermissionGuard: Extracted permissions:', userPermissionNames)
    console.log('🔍 DEBUG PermissionGuard: Required permissions:', stableRequiredPermissions)

    // Permission-based check (PRIMARY)
    if (stableRequiredPermissions.length > 0) {
      let hasPermission = false

      if (requireAll) {
        // AND logic - user must have ALL required permissions
        hasPermission = stableRequiredPermissions.every(permission =>
          userPermissionNames.includes(permission)
        )
      } else {
        // OR logic - user needs ANY of the required permissions
        hasPermission = stableRequiredPermissions.some(permission =>
          userPermissionNames.includes(permission)
        )
      }

      if (hasPermission) {
        console.log('✅ PermissionGuard: Access granted - user has required permissions')
        console.log('User Permissions:', userPermissionNames)
        setIsAuthorized(true)
        return
      } else {
        // Log unauthorized access attempt
        console.error('🚫 PermissionGuard: Access denied. Required:', stableRequiredPermissions, 'User has:', userPermissionNames)
        console.error('🚨 SECURITY ALERT:', {
          event: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          severity: 'HIGH',
          user: (user as any).email || user.id || 'unknown',
          role: userRole,
          requiredPermissions: stableRequiredPermissions,
          userPermissions: userPermissionNames,
          requireAll,
          timestamp: new Date().toISOString()
        })
        setIsAuthorized(false)
        return
      }
    }

    // Role-based check (FALLBACK - DEPRECATED)
    if (stableAllowedRoles.length > 0) {
      console.warn('⚠️ PermissionGuard: Using deprecated role-based check. Please migrate to permission-based check.')

      if (stableAllowedRoles.includes(userRole)) {
        console.log('✅ PermissionGuard: Access granted - user role is allowed')
        setIsAuthorized(true)
        return
      } else {
        console.error('🚫 PermissionGuard: Access denied - role not allowed')
        console.error('🚨 SECURITY ALERT:', {
          event: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          severity: 'MEDIUM',
          user: (user as any).email || user.id || 'unknown',
          role: userRole,
          allowedRoles: stableAllowedRoles,
          timestamp: new Date().toISOString()
        })
        setIsAuthorized(false)
        return
      }
    }

    // Should not reach here if rules are properly specified
    setIsAuthorized(false)
  }, [stableRequiredPermissions, stableAllowedRoles, requireAll])

  // Auto-redirect after showing error
  useEffect(() => {
    if (isAuthorized === false) {
      const timer = setTimeout(() => {
        console.log('🔄 PermissionGuard: Redirecting unauthorized user to', redirectTo)
        router.push(redirectTo)
      }, 2500)

      return () => clearTimeout(timer)
    }
  }, [isAuthorized, redirectTo, router])

  // Loading state
  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  // Authorized - render children
  if (isAuthorized) {
    return <>{children}</>
  }

  // Unauthorized - show error or redirect immediately
  if (!showError) {
    return null
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full p-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>

          <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access this page.
          </p>

          {userInfo && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold">User:</span> {userInfo.email || userInfo.username || 'Unknown'}
              </p>
              {stableRequiredPermissions.length > 0 && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  <span className="font-semibold">Required Permission{stableRequiredPermissions.length > 1 ? 's' : ''}:</span>
                  <br />
                  <span className="text-xs font-mono">
                    {stableRequiredPermissions.join(requireAll ? ' AND ' : ' OR ')}
                  </span>
                </p>
              )}
            </div>
          )}

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Redirecting to dashboard in a few seconds...
          </p>

          <div className="mt-6">
            <button
              onClick={() => router.push(redirectTo)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Go to Dashboard Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
