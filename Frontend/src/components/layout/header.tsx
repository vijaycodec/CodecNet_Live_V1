'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { BellIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { clsx } from 'clsx'
import { clearAuthSession, getUserFromCookies } from '@/lib/auth'
import { useClient } from '@/contexts/ClientContext'
import toast from 'react-hot-toast'
import Cookies from 'js-cookie'

export function Header() {
  const [notifications] = useState([
    { id: 1, message: 'Critical alert: Unusual login activity detected', time: '2 min ago', read: false },
    { id: 2, message: 'Weekly security report is ready', time: '1 hour ago', read: false },
    { id: 3, message: 'System maintenance scheduled for tonight', time: '3 hours ago', read: true },
  ])

  const router = useRouter()
  const pathname = usePathname()
  const { selectedClient, isClientMode, setSelectedClient } = useClient()
  const unreadCount = notifications.filter(n => !n.read).length

  // Debug logging
  console.log('🔍 Header debug:', {
    selectedClient,
    isClientMode,
    pathname
  })


  // Check if user has overview:read permission and show back button
  const currentUser = getUserFromCookies()
  // Check both nested object format (permissions.overview.read) and flat string format (permissions['overview:read'])
  const hasOverviewPermission = currentUser?.permissions?.overview?.read === true ||
                                 currentUser?.permissions?.['overview:read'] === true
  const showBackButton = hasOverviewPermission && isClientMode && pathname !== '/overview'

  // Debug logging for permissions
  console.log('🔍 Permission check:', {
    hasOverviewPermission,
    nestedFormat: currentUser?.permissions?.overview?.read,
    flatFormat: currentUser?.permissions?.['overview:read'],
    allPermissions: currentUser?.permissions,
    showBackButton
  })

  const handleBackToOverview = () => {
    setSelectedClient(null)
    router.push('/overview')
  }

  const handleSignOut = () => {
    clearAuthSession()
    toast.success('Successfully signed out', {
      duration: 2000,
    })
    router.push('/login')
  }

  type UserType = {
    firstName: string
    lastName: string
    email: string
  }
  const [user, setUser] = useState<UserType | null>(null)

  // Generate random background color based on user name
  const getInitialAndColor = (firstName: string, lastName: string) => {
    const fullName = `${firstName} ${lastName}`.trim()
    const initial = fullName.charAt(0).toUpperCase() || 'U'

    // Generate a consistent color based on the name
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-rose-500'
    ]

    let hash = 0
    for (let i = 0; i < fullName.length; i++) {
      hash = fullName.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colorIndex = Math.abs(hash) % colors.length

    return { initial, bgColor: colors[colorIndex] }
  }

  useEffect(() => {
    const userInfo = Cookies.get('user_info')

    if (userInfo) {
      try {
        const parsedUser = JSON.parse(userInfo)
        // Handle both new format (full_name) and legacy format (firstName/lastName)
        const transformedUser: UserType = {
          firstName: parsedUser.firstName || (parsedUser.full_name ? parsedUser.full_name.split(' ')[0] : ''),
          lastName: parsedUser.lastName || (parsedUser.full_name ? parsedUser.full_name.split(' ').slice(1).join(' ') : ''),
          email: parsedUser.email || ''
        }
        setUser(transformedUser)
      } catch (error) {
        console.error('Failed to parse user info from cookies', error)
        setUser(null)
      }
    }
  }, [])

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200/70 dark:border-gray-800/40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Back to Client Overview Button */}
        {showBackButton && (
          <div className="flex items-center">
            <button
              onClick={handleBackToOverview}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Client Overview</span>
            </button>
          </div>
        )}
        {/* Organization Indicator - Centered */}
        <div className="flex-1 flex justify-center">
          {selectedClient && (
            <div className="flex items-center">
              {/* Desktop version */}
              <div className="hidden sm:flex items-center bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-1.5 shadow-sm">
                <div className="flex items-center gap-x-2">
                  <div className="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900/40 rounded-full">
                    <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      {selectedClient.description || 'Organization'}
                    </span>
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-100 truncate max-w-40">
                      {selectedClient.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile version */}
              <div className="sm:hidden flex items-center bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1 shadow-sm">
                <div className="flex items-center gap-x-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-blue-900 dark:text-blue-100 truncate max-w-24">
                      {selectedClient.name}
                    </span>
                    {selectedClient.description && (
                      <span className="text-xs text-blue-700 dark:text-blue-300 truncate max-w-24">
                        {selectedClient.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          {/* <Menu as="div" className="relative">
            <Menu.Button className="relative rounded-full p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 dark:bg-gray-800/80 shadow-sm border border-gray-100/50 dark:border-gray-700/30 transition-all duration-200 hover:scale-105">
              <span className="sr-only">View notifications</span>
              <BellIcon className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs rounded-full flex items-center justify-center shadow-sm animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-150"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-xl bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none border border-gray-100 dark:border-gray-700/50">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700/50">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <Menu.Item key={notification.id}>
                      {({ active }) => (
                        <div
                          className={clsx(
                            active ? 'bg-gray-50 dark:bg-gray-700/50' : '',
                            'px-4 py-3 cursor-pointer border-b border-gray-50 dark:border-gray-700/30 last:border-0'
                          )}
                        >
                          <p className={clsx(
                            'text-sm',
                            notification.read
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-gray-900 dark:text-white font-medium'
                          )}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {notification.time}
                          </p>
                        </div>
                      )}
                    </Menu.Item>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/50">
                  <a href="#" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                    View all notifications
                  </a>
                </div>
              </Menu.Items>
            </Transition>
          </Menu> */}

          {/* Profile dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-x-4 text-sm leading-6 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full">
              <span className="sr-only">Open user menu</span>
              <div className={`h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-700 shadow-md flex items-center justify-center text-white font-semibold text-sm ${user ? getInitialAndColor(user.firstName, user.lastName).bgColor : 'bg-gray-500'}`}>
                {user ? getInitialAndColor(user.firstName, user.lastName).initial : 'U'}
              </div>
              <span className="hidden lg:flex lg:items-center">
                <span className="text-sm font-medium leading-6" aria-hidden="true">
                  {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User' : 'Loading...'}
                </span>
              </span>
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-150"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none border border-gray-100 dark:border-gray-700/50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user ? user.email : 'Loading...'}</p>
                  {/* <p className="text-sm font-medium text-gray-900 dark:text-white truncate">john.anderson@codecnet.io</p> */}
                </div>
                {/* <Menu.Item>
                  {({ active }) => (
                    <a
                      href="#"
                      className={clsx(
                        active ? 'bg-gray-50 dark:bg-gray-700/50' : '',
                        'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                      )}
                    >
                      Your profile
                    </a>
                  )}
                </Menu.Item> */}
                {/* <Menu.Item>
                  {({ active }) => (
                    <a
                      href="#"
                      className={clsx(
                        active ? 'bg-gray-50 dark:bg-gray-700/50' : '',
                        'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                      )}
                    >
                      Settings
                    </a>
                  )}
                </Menu.Item> */}
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleSignOut}
                      className={clsx(
                        active ? 'bg-gray-50 dark:bg-gray-700/50' : '',
                        'block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700/50'
                      )}
                    >
                      Sign out
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </div>
  )
} 