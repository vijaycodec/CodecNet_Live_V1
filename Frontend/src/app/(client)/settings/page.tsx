'use client';

import { useState, useEffect } from 'react';
import {
  Cog6ToothIcon,
  ClockIcon,
  BellIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

// Import modular components
import ApiFrequencyManagement from './components/ApiFrequencyManagement';
import NotificationSettings from './components/NotificationSettings';
import GeneralSettings from './components/GeneralSettings';
import SecuritySettings from './components/SecuritySettings';
import AccessControl from './components/AccessControl';
import UserManagement from './components/UserManagement';

// Import types
import {
  ApiEndpoint,
  NotificationSettings as NotificationSettingsType,
  GeneralSettings as GeneralSettingsType,
  SecuritySettings as SecuritySettingsType,
  User,
  Role,
  Permission
} from './types';
import api from '@/lib/api';
import PermissionGuard from '@/components/auth/PermissionGuard';


// Tab configuration
const tabs = [
  // { id: 'api-frequency', name: 'API Frequency Management', icon: ClockIcon },
  // { id: 'notifications', name: 'Notifications', icon: BellIcon },
  // { id: 'general', name: 'General Settings', icon: Cog6ToothIcon },
  // { id: 'security', name: 'Security', icon: ShieldCheckIcon },
  { id: 'access-control', name: 'Access Control', icon: LockClosedIcon },
  { id: 'user-management', name: 'User Management', icon: UsersIcon }
];

function ClientSettings() {
  const [activeTab, setActiveTab] = useState('access-control');

  // --- Step 2: Add state to store the roles data ---
  const [roles, setRoles] = useState<Role[]>([]);

  // --- Step 3: Fetch roles when the component mounts ---
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        console.log("Fetching roles from API...");
        const response = await api.roles.getRoles();
        // The backend returns the list of roles inside a 'data' property
        if (response && response.data) {
          setRoles(response.data);
          // console.log("Successfully fetched roles:", response.data);
        } else {
          setRoles([]);
        }
      } catch (error) {
        console.error("Failed to fetch roles:", error);
        setRoles([]); // Set to empty on error to prevent crashes
      }
    };

    fetchRoles();
  }, []);

  const handleRolesChange = (updatedRoles: Role[]) => {
    setRoles(updatedRoles);
  };

  // --- Step 2: Add state to store the roles data ---
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // --- Step 3: Fetch roles when the component mounts ---
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        console.log("Fetching permissions from API...");
        const response = await api.permissions.getPermissions();
        // The backend returns the list of roles inside a 'data' property
        if (response && response.data) {
          setPermissions(response.data);
          // console.log("Successfully fetched permissions:", response.data);
        } else {
          setPermissions([]);
        }
      } catch (error) {
        console.error("Failed to fetch permissions:", error);
        setPermissions([]); // Set to empty on error to prevent crashes
      }
    };

    fetchPermissions();
  }, []);

  const handlePermissionsChange = (updatedPermissions: Permission[]) => {
    setPermissions(updatedPermissions);
  };


  // --- Step 2: Add state to store the roles data ---
  const [users, setUsers] = useState<User[]>([]);

  // --- Step 3: Fetch roles when the component mounts ---
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        console.log("Fetching users from API...");
        const response = await api.users.getUsers();
        // The backend returns the list of roles inside a 'data' property
        if (response && response.data) {
          setUsers(response.data);
          // console.log("Successfully fetched users:", response.data);
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
        setUsers([]); // Set to empty on error to prevent crashes
      }
    };

    fetchUsers();
  }, []);

  const handleUsersChange = (updatedUsers: User[]) => {
    setUsers(updatedUsers);
  };


  // API Frequency Management State
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoint[]>([
    {
      id: 1,
      name: 'Threat Intelligence Feed',
      url: 'https://api.threatintel.com/v1/feeds',
      method: 'GET',
      frequency: 15,
      enabled: true,
      lastCall: '2 mins ago',
      nextCall: 'in 13 mins',
      responseTime: 234,
      status: 'active'
    },
    {
      id: 2,
      name: 'Vulnerability Database',
      url: 'https://api.vulndb.com/v2/vulnerabilities',
      method: 'GET',
      frequency: 60,
      enabled: true,
      lastCall: '45 mins ago',
      nextCall: 'in 15 mins',
      responseTime: 1203,
      status: 'warning'
    },
    {
      id: 3,
      name: 'Security Events API',
      url: 'https://api.security.com/v1/events',
      method: 'POST',
      frequency: 5,
      enabled: false,
      lastCall: 'Never',
      nextCall: 'Disabled',
      responseTime: 0,
      status: 'error'
    }
  ]);

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsType>({
    emailAlerts: true,
    smsAlerts: false,
    pushNotifications: true,
    alertThresholds: {
      critical: true,
      high: true,
      medium: false,
      low: false
    },
    channels: {
      slack: true,
      teams: false,
      webhook: false
    }
  });

  // General Settings State
  const [generalSettings, setGeneralSettings] = useState<GeneralSettingsType>({
    timezone: 'UTC',
    language: 'en',
    theme: 'system',
    dateFormat: 'MM/dd/yyyy',
    autoRefresh: true,
    refreshInterval: 300
  });

  // Security Settings State
  const [securitySettings, setSecuritySettings] = useState<SecuritySettingsType>({
    twoFactorEnabled: false,
    sessionTimeout: 60,
    loginAttempts: 5,
    passwordExpiry: 90,
    requireStrongPassword: true
  });

  // User Management State
  // const [users, setUsers] = useState<User[]>([]);
  // const [roles, setRoles] = useState<Role[]>([]);
  // const [permissions, setPermissions] = useState<Permission[]>([]);

  // Load initial data
  useEffect(() => {
    // Here you would typically load data from APIs
    // For now, we'll use mock data
    setUsers([
      // {
      //   id: '1',
      //   username: 'admin',
      //   email: 'admin@codecnetworks.com',
      //   full_name: 'System Administrator',
      //   role_id: 'role_1',
      //   role: {
      //     role_name: 'Super Admin',
      //     permissions: { all: true }
      //   },
      //   status: 'active',
      //   user_type: 'internal',
      //   last_login_at: '2024-01-15T09:30:00Z',
      //   created_at: '2024-01-01T00:00:00Z',
      //   updated_at: '2024-01-15T09:30:00Z'
      // }
    ]);

    // setRoles([
    //   {
    //     _id: 'role_1',
    //     role_name: 'Super Admin',
    //     description: 'Full system access',
    //     permissions: { all: true },
    //     status: true,
    //     created_at: '2024-01-01T00:00:00Z',
    //     updated_at: '2024-01-01T00:00:00Z'
    //   },
    //   {
    //     _id: 'role_2',
    //     role_name: 'Client',
    //     description: 'Client access with limited permissions',
    //     permissions: { dashboard: { read: true }, reports: { read: true } },
    //     status: true,
    //     created_at: '2024-01-01T00:00:00Z',
    //     updated_at: '2024-01-01T00:00:00Z'
    //   }
    // ]);

    //   setPermissions([
    //     {
    //       _id: 'perm_1',
    //       name: 'Dashboard Access',
    //       description: 'Access to view dashboard',
    //       resource: 'dashboard',
    //       actions: ['read', 'view'],
    //       created_at: '2024-01-01T00:00:00Z',
    //       updated_at: '2024-01-01T00:00:00Z'
    //     },
    //     {
    //       _id: 'perm_2',
    //       name: 'User Management',
    //       description: 'Full user management capabilities',
    //       resource: 'users',
    //       actions: ['create', 'read', 'update', 'delete'],
    //       created_at: '2024-01-01T00:00:00Z',
    //       updated_at: '2024-01-01T00:00:00Z'
    //     },
    //     {
    //       _id: 'perm_3',
    //       name: 'Reports Access',
    //       description: 'Access to view and export reports',
    //       resource: 'reports',
    //       actions: ['read', 'export'],
    //       created_at: '2024-01-01T00:00:00Z',
    //       updated_at: '2024-01-01T00:00:00Z'
    //     }
    //   ]);
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'api-frequency':
        return (
          <ApiFrequencyManagement
            apiEndpoints={apiEndpoints}
            onEndpointsChange={setApiEndpoints}
          />
        );

      case 'notifications':
        return (
          <NotificationSettings
            settings={notificationSettings}
            onSettingsChange={setNotificationSettings}
          />
        );

      case 'general':
        return (
          <GeneralSettings
            settings={generalSettings}
            onSettingsChange={setGeneralSettings}
          />
        );

      case 'security':
        return (
          <SecuritySettings
            settings={securitySettings}
            onSettingsChange={setSecuritySettings}
          />
        );

      // case 'access-control':
      //   return (
      //     <AccessControl
      //       accessRules={accessRules}
      //       roles={roles}
      //       permissions={permissions}
      //       onAccessRulesChange={setAccessRules}
      //       onRolesChange={setRoles}
      //       onPermissionsChange={setPermissions}
      //     />
      //   );
      case 'access-control':
        // --- Step 4: Pass the fetched roles to the AccessControl component ---
        return (
          <AccessControl
            roles={roles}
            onRolesChange={handleRolesChange}
            permissions={permissions}
            onPermissionsChange={handlePermissionsChange}
          />
        );

      case 'user-management':
        return (
          <UserManagement
            users={users}
            roles={roles}
            onUsersChange={handleUsersChange}
            onRolesChange={handleRolesChange}
          />
        );

      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your SIEM client configuration and preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab Content */}
      <div className="min-h-[600px]">
        {renderActiveTab()}
      </div>
    </div>
  );
}

// PATCH 25: Permission-based access control for Settings Page (singular forms)
export default function ProtectedClientSettings() {
  return (
    <PermissionGuard requiredPermissions={['role:read', 'user:read']}>
      <ClientSettings />
    </PermissionGuard>
  );
}