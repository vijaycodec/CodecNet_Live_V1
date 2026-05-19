'use client'

import React from 'react'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { usePermissions } from '@/hooks/usePermissions'

interface PermissionGateProps {
  section: string
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
  showLock?: boolean
  className?: string
}

/**
 * PermissionGate component that conditionally renders content based on user permissions
 *
 * @param section - The permission section (e.g., 'tickets', 'alerts')
 * @param action - The permission action (e.g., 'create', 'read', 'update', 'delete')
 * @param children - Content to render when user has permission
 * @param fallback - Content to render when user doesn't have permission (optional)
 * @param showLock - Whether to show a lock icon when permission is denied (default: true)
 * @param className - Additional CSS classes for the wrapper
 */
export function PermissionGate({
  section,
  action,
  children,
  fallback,
  showLock = true,
  className = ''
}: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissions()

  // Show loading state
  if (isLoading) {
    return (
      <div className={`opacity-50 ${className}`}>
        {children}
      </div>
    )
  }

  // Check if user has permission
  const hasAccess = hasPermission(section, action)

  if (hasAccess) {
    return <>{children}</>
  }

  // User doesn't have permission
  if (fallback) {
    return <>{fallback}</>
  }

  // Default fallback with lock icon
  if (showLock) {
    return (
      <div className={`relative ${className}`}>
        <div className="opacity-30 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <LockClosedIcon className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    )
  }

  // No fallback, don't render anything
  return null
}

/**
 * Higher-order component version of PermissionGate
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  section: string,
  action: string,
  fallback?: React.ReactNode
) {
  return function PermissionWrappedComponent(props: P) {
    return (
      <PermissionGate
        section={section}
        action={action}
        fallback={fallback}
      >
        <Component {...props} />
      </PermissionGate>
    )
  }
}

/**
 * Hook for conditional rendering based on permissions
 */
export function usePermissionGuard(section: string, action: string) {
  const { hasPermission, isLoading } = usePermissions()

  return {
    hasAccess: hasPermission(section, action),
    isLoading,
    canRender: hasPermission(section, action)
  }
}