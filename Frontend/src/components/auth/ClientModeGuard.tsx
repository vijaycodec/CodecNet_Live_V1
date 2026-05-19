'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useClient } from '@/contexts/ClientContext'
import { getUserFromCookies } from '@/lib/auth'

interface ClientModeGuardProps {
  children: React.ReactNode
}

export function ClientModeGuard({ children }: ClientModeGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { selectedClient, isClientMode } = useClient()

  useEffect(() => {
    const user = getUserFromCookies()

    // Skip redirects if user is not authenticated
    if (!user) return

    // If user needs client selection but hasn't selected one, and not on an allowed superadmin-only route
    const superadminAllowedPaths = [
      '/overview',
      '/login',
      '/settings',
      '/alert-notifications',
    ]
    if (isClientMode && !selectedClient && !superadminAllowedPaths.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
      router.push('/overview')
      return
    }

    // Note: Removed automatic redirect to dashboard when client is selected on overview
    // This allows users to navigate to specific pages from the client overview

    // If non-client-mode user (regular client) tries to access overview, redirect to dashboard
    if (!isClientMode && pathname === '/overview') {
      router.push('/dashboard')
      return
    }
  }, [isClientMode, selectedClient, pathname, router])

  return <>{children}</>
}