'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HomeIcon,
  ExclamationTriangleIcon,
  DocumentChartBarIcon,
  ShieldCheckIcon,
  UsersIcon,
  CpuChipIcon,
  Cog6ToothIcon,
  BuildingOfficeIcon,
  TicketIcon,
  ShieldExclamationIcon,
  ServerIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'
import { SystemStatus } from './system-status'
import { useClient } from '@/contexts/ClientContext'
import { getUserFromCookies } from '@/lib/auth'
import Cookies from 'js-cookie'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { selectedClient, isClientMode, setSelectedClient } = useClient()

  // Define navigation items based on context
  const getNavigationItems = () => {
    // If in client selection mode (SuperAdmin/Analyst without selected client)
    if (isClientMode && !selectedClient) {
      return [
        { name: 'Client Overview', href: '/overview', icon: BuildingOfficeIcon, badge: null, requiredPermission: 'overview:read' },
        { name: 'Email', href: '/alert-notifications', icon: EnvelopeIcon, badge: null, requiredPermission: 'organisation:update' },
        { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, badge: null, requiredPermission: 'settings:access' },
      ]
    }

    // Regular dashboard navigation (for selected client or direct client users)
    return [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, badge: null, requiredPermission: '' },
      { name: 'Live Alerts', href: '/alerts', icon: ExclamationTriangleIcon, badge: null, requiredPermission: 'alerts:read' },
      { name: 'Tickets', href: '/tickets', icon: TicketIcon, badge: null, requiredPermission: 'tickets:read' },
      { name: 'Reports', href: '/reports', icon: DocumentChartBarIcon, badge: null, requiredPermission: 'reports:read' },
      { name: 'Risk Matrix', href: '/risk-matrix', icon: ShieldExclamationIcon, badge: null, requiredPermission: 'risk-matrix:read' }, // badge: 'BETA' commented out
      { name: 'Compliance', href: '/compliance', icon: ShieldCheckIcon, badge: null, requiredPermission: 'compliance:read' },
      { name: 'Asset Register', href: '/asset-register', icon: ServerIcon, badge: null, requiredPermission: 'assets:read' },
      { name: 'Agents Overview', href: '/agents', icon: UsersIcon, badge: null, requiredPermission: 'agents:read' },
      { name: 'SIEM Portal', href: '/siem', icon: CpuChipIcon, badge: null, requiredPermission: 'siem:access' },
    ]
  }

  const navigation = getNavigationItems()

  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const decodedUser = getUserFromCookies()
    setUser(decodedUser)
  }, [])

  // Permission-based navigation filtering
  const visibleNavigation = navigation.filter(item => {
    // Always show items without permission requirements (like Dashboard)
    if (!item.requiredPermission) {
      return true
    }

    if (user && user.permissions) {
      // Check if permission exists in the permissions object
      const [resource, action] = item.requiredPermission.split(':')
      return user.permissions[resource] && user.permissions[resource][action]
    }

    return false
  })

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-6 pb-4 shadow-xl border-r border-gray-200/70 dark:border-gray-800/50">
        {/* Logo and Client Header */}
        <div className="flex h-16 shrink-0 items-center">
          <div className="flex items-center space-x-3 w-full">
            {/* Commented out original logo and text */}
            {/* <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 animate-float">
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-300 truncate">
                Codec Net
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                AI Based SIEM Dashboard
              </p>
            </div> */}
            
            {/* CodecNet SVG Logo */}
            <div className="flex items-center justify-start w-full">
              <img 
                src="/CodecNet.svg" 
                alt="Codec Net Logo" 
                className="h-12 w-auto"
              />
            </div>
          </div>
        </div>


        {/* Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1.5">
                {/* This part remains the same, as it uses the already-filtered list */}
                {visibleNavigation.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}/`))
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={clsx(
                          'group flex gap-x-3 rounded-xl p-2.5 text-sm leading-6 font-medium transition-all duration-200',
                          isActive
                            ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-800/30'
                            : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        )}
                      >
                        <item.icon
                          className={clsx(
                            'h-5 w-5 shrink-0 group-hover:scale-110',
                            isActive
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          )}
                        />
                        {item.name}
                        {item.badge && (
                          <span className={clsx(
                            "ml-auto text-xs font-medium rounded-full flex items-center justify-center shadow-sm border",
                            item.badge === 'BETA'
                              ? "px-2 py-0.5 bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-800/30 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/30"
                              : "w-6 h-6 bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/40 dark:to-red-800/30 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/30"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>

            {/* System Status */}
            <li className="mt-auto">
              <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-3 border border-gray-100 dark:border-gray-700/30 shadow-sm">
                <SystemStatus />
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}

// 'use client'

// import { useState, useEffect } from 'react'
// import Link from 'next/link'
// import { usePathname } from 'next/navigation'
// import {
//   HomeIcon,
//   ExclamationTriangleIcon,
//   DocumentChartBarIcon,
//   ShieldCheckIcon,
//   UsersIcon,
//   CpuChipIcon,
//   Cog6ToothIcon,
//   BuildingOfficeIcon,
//   TicketIcon
// } from '@heroicons/react/24/outline'
// import { clsx } from 'clsx'
// import { SystemStatus } from './system-status'
// import Cookies from 'js-cookie'

// export function Sidebar() {
//   const pathname = usePathname()

//   const navigation = [
//     { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, badge: null },
//     { name: 'Client Overview', href: '/overview', icon: BuildingOfficeIcon, badge: null },
//     { name: 'Live Alerts', href: '/alerts', icon: ExclamationTriangleIcon, badge: null },
//     { name: 'Tickets', href: '/tickets', icon: TicketIcon, badge: null },
//     { name: 'Reports', href: '/reports', icon: DocumentChartBarIcon, badge: null },
//     { name: 'Compliance', href: '/compliance', icon: ShieldCheckIcon, badge: null },
//     { name: 'Agents Overview', href: '/agents', icon: UsersIcon, badge: null },
//     { name: 'SIEM Portal', href: '/siem', icon: CpuChipIcon, badge: null },
//     { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, badge: null },
//   ]



//   type UserType = {
//     clientName: string
//   }
//   const [user, setUser] = useState<UserType | null>(null)

//   useEffect(() => {
//     const userInfo = Cookies.get('user_info')

//     if (userInfo) {
//       try {
//         const parsedUser: UserType = JSON.parse(userInfo)
//         setUser(parsedUser)
//       } catch (error) {
//         console.error('Failed to parse user info from cookies', error)
//         setUser(null)
//       }
//     }
//   }, [])

//   return (
//     <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
//       <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-6 pb-4 shadow-xl border-r border-gray-200/70 dark:border-gray-800/50">
//         {/* Logo */}
//         <div className="flex h-16 shrink-0 items-center">
//           <div className="flex items-center space-x-3">
//             <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 animate-float">
//               <ShieldCheckIcon className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-300">
//                 {user ? user.clientName : 'Codec Net'}
//               </h1>
//               <p className="text-xs text-gray-500 dark:text-gray-400">
//                 AI Based SIEM Dashboard
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Navigation */}
//         <nav className="flex flex-1 flex-col">
//           <ul role="list" className="flex flex-1 flex-col gap-y-7">
//             <li>
//               <ul role="list" className="-mx-2 space-y-1.5">
//                 {navigation.map((item) => {
//                   const isActive = pathname === item.href || (item.href === '/user' && (pathname.startsWith('/user') || pathname.startsWith('/permission') || pathname.startsWith('/role') || pathname.startsWith('/user')))
//                   return (
//                     <li key={item.name}>
//                       <Link
//                         href={item.href}
//                         className={clsx(
//                           'group flex gap-x-3 rounded-xl p-2.5 text-sm leading-6 font-medium transition-all duration-200',
//                           isActive
//                             ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-800/30'
//                             : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
//                         )}
//                       >
//                         <item.icon
//                           className={clsx(
//                             'h-5 w-5 shrink-0 group-hover:scale-110',
//                             isActive
//                               ? 'text-blue-600 dark:text-blue-400'
//                               : 'text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
//                           )}
//                         />
//                         {item.name}
//                         {item.badge && (
//                           <span className="ml-auto w-6 h-6 text-xs font-medium bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/40 dark:to-red-800/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center shadow-sm border border-red-200/50 dark:border-red-800/30">
//                             {item.badge}
//                           </span>
//                         )}
//                       </Link>
//                     </li>
//                   )
//                 })}
//               </ul>
//             </li>

//             {/* System Status */}
//             <li className="mt-auto">
//               <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-3 border border-gray-100 dark:border-gray-700/30 shadow-sm">
//                 <SystemStatus />
//               </div>
//             </li>
//           </ul>
//         </nav>
//       </div>
//     </div>
//   )
// }
