'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { useClient } from '@/contexts/ClientContext';
import { getUserFromCookies } from '@/lib/auth';
import { organisationsApi, subscriptionPlansApi, wazuhApi } from '@/lib/api';
import {
  BuildingOfficeIcon,
  EyeIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  CpuChipIcon,
  ArrowLeftIcon,
  ServerIcon,
  HomeIcon,
  DocumentChartBarIcon,
  ShieldExclamationIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

// Type definitions
interface ClientInstance {
  id: string;
  organisation_name: string;
  client_name: string;
  industry: string;
  status: 'active' | 'warning' | 'maintenance' | 'inactive';
  contact_email: string;
  contact_phone?: string;
  emails?: string[];  // Array of email addresses
  phone_numbers?: string[];  // Array of phone numbers
  subscription_status: string;
  subscription_plan?: {
    id: string;
    plan_name: string;
    plan_code: string;
  };
  user_count: number;
  created_at: string;
  updated_at: string;
  address?: {
    city?: string;
    country?: string;
  };
  wazuh_manager_ip?: string;
  wazuh_manager_port?: number;
  wazuh_indexer_ip?: string;
  wazuh_indexer_port?: number;
  wazuh_dashboard_ip?: string;
  wazuh_dashboard_port?: number;
}

interface SubscriptionPlan {
  id: string;
  plan_name: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP || 'http://localhost:5000/api';

export default function ClientOverview() {
  const router = useRouter();
  const { selectedClient, setSelectedClient } = useClient();
  const [selectedClientLocal, setSelectedClientLocal] = useState<ClientInstance | null>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientInstance | null>(null);
  const [clientToEdit, setClientToEdit] = useState<ClientInstance | null>(null);
  const [clientToDeactivate, setClientToDeactivate] = useState<ClientInstance | null>(null);
  const [clientToActivate, setClientToActivate] = useState<ClientInstance | null>(null);
  const [clientInstances, setClientInstances] = useState<ClientInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Check user permissions
  const user = getUserFromCookies();
  const hasCreatePermission = user?.permissions?.organisation?.create === true;
  const hasUpdatePermission = user?.permissions?.organisation?.update === true;
  const hasDeletePermission = user?.permissions?.organisation?.delete === true;
  const [totalActiveAlerts, setTotalActiveAlerts] = useState<number>(0);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [clientAlerts, setClientAlerts] = useState<Record<string, number>>({});
  const [clientAgents, setClientAgents] = useState<Record<string, number>>({});
  const [totalProtectedEndpoints, setTotalProtectedEndpoints] = useState<number>(0);

  useEffect(() => {
    // Check user access
    const user = getUserFromCookies();
    if (!user || !user.permissions?.overview?.read) {
      router.push('/dashboard');
      return;
    }

    const fetchClients = async () => {
      setLoading(true);
      setFetchError(null);

      try {
        const response = await organisationsApi.getOrganisations();

        if (response.success && Array.isArray(response.data)) {
          const mappedClients = response.data.map((org: any): ClientInstance => ({
            id: org._id,
            organisation_name: org.organisation_name,
            client_name: org.client_name,
            industry: org.industry || 'Technology',
            status: org.status === 'active' ? 'active' : org.is_active ? 'active' : 'inactive',
            contact_email: org.emails?.[0] || 'N/A',
            contact_phone: org.phone_numbers?.[0],
            emails: org.emails || [],  // Include full emails array
            phone_numbers: org.phone_numbers || [],  // Include full phone_numbers array
            subscription_status: org.subscription_status || 'active',
            subscription_plan: org.subscription_plan_id ? {
              id: typeof org.subscription_plan_id === 'string' ? org.subscription_plan_id : org.subscription_plan_id._id || org.subscription_plan_id.id,
              plan_name: org.subscription_plan_id?.plan_name || 'Basic',
              plan_code: org.subscription_plan_id?.plan_code || 'BASIC'
            } : undefined,
            user_count: org.current_user_count || 0,
            created_at: org.createdAt || new Date().toISOString(),
            updated_at: org.updatedAt || new Date().toISOString(),
            address: org.address,
            wazuh_manager_ip: org.wazuh_manager_ip,
            wazuh_manager_port: org.wazuh_manager_port,
            wazuh_indexer_ip: org.wazuh_indexer_ip,
            wazuh_indexer_port: org.wazuh_indexer_port,
            wazuh_dashboard_ip: org.wazuh_dashboard_ip,
            wazuh_dashboard_port: org.wazuh_dashboard_port,
          }));

          setClientInstances(mappedClients);
        } else {
          throw new Error('Invalid data format received from API.');
        }
      } catch (e: any) {
        setFetchError(`Failed to fetch clients: ${e.message}`);
        console.error('Error fetching clients:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [router]);

  // Fetch real alerts data from all clients (last 24 hours) using dashboard metrics
  useEffect(() => {
    const fetchAlertsData = async () => {
      if (clientInstances.length === 0) return;

      setAlertsLoading(true);

      try {
        const activeClients = clientInstances.filter(client =>
          client.status === 'active' && client.wazuh_dashboard_ip
        );

        if (activeClients.length === 0) {
          setTotalActiveAlerts(0);
          setAlertsLoading(false);
          return;
        }

        // Fetch dashboard metrics for each client (same as dashboard page)
        const alertPromises = activeClients.map(async (client) => {
          try {
            console.log(`Fetching dashboard metrics for client: ${client.client_name} (orgId: ${client.id})`);

            const data = await wazuhApi.getDashboardMetrics(client.id);
            const alertCount = data.data?.alerts_last_24hr || 0;
            const agentCount = data.data?.active_agents || 0;

            console.log(`✅ Client ${client.client_name}: ${alertCount} alerts, ${agentCount} agents (last 24hr)`);
            return { clientId: client.id, alertCount, agentCount };
          } catch (error) {
            console.error(`❌ Error fetching metrics for client ${client.client_name}:`, error);
            return { clientId: client.id, alertCount: 0, agentCount: 0 };
          }
        });

        // Wait for all promises to resolve
        const alertResults = await Promise.all(alertPromises);

        // Create individual client alerts and agents mapping
        const clientAlertsMap: Record<string, number> = {};
        const clientAgentsMap: Record<string, number> = {};
        alertResults.forEach(result => {
          clientAlertsMap[result.clientId] = result.alertCount;
          clientAgentsMap[result.clientId] = result.agentCount || 0;
        });
        setClientAlerts(clientAlertsMap);
        setClientAgents(clientAgentsMap);

        // Calculate total alerts and total protected endpoints
        const totalAlerts = alertResults.reduce((sum, result) => sum + result.alertCount, 0);
        const totalAgents = alertResults.reduce((sum, result) => sum + (result.agentCount || 0), 0);

        console.log(`📊 Total alerts across all clients (last 24hr): ${totalAlerts}`);
        console.log(`📊 Total protected endpoints across all clients: ${totalAgents}`);

        setTotalActiveAlerts(totalAlerts);
        setTotalProtectedEndpoints(totalAgents);

      } catch (error) {
        console.error('Error fetching alerts data:', error);
        setTotalActiveAlerts(0);
        setTotalProtectedEndpoints(0);
      } finally {
        setAlertsLoading(false);
      }
    };

    fetchAlertsData();
  }, [clientInstances]);

  // Handle viewing a client dashboard
  const handleViewClientDashboard = (client: ClientInstance) => {
    // Set the selected client in context
    setSelectedClient({
      id: client.id,
      name: client.client_name,
      status: client.status === 'active' ? 'active' : 'inactive',
      description: client.organisation_name,
      wazuhHost: client.wazuh_dashboard_ip || 'N/A'
    });

    // Navigate to dashboard
    router.push('/dashboard');
  };

  // Handle navigating to any client page
  const handleClientNavigation = (path: string) => {
    if (!selectedClientLocal) return;
    // Set the selected client in context
    setSelectedClient({
      id: selectedClientLocal.id,
      name: selectedClientLocal.client_name,
      status: selectedClientLocal.status === 'active' ? 'active' : 'inactive',
      description: selectedClientLocal.organisation_name,
      wazuhHost: selectedClientLocal.wazuh_dashboard_ip || 'N/A'
    });

    // Navigate to the specified path
    router.push(path);
  };

  const totalClients = clientInstances.length;
  const avgUptime = '99.9'; // Static value since uptime not in new schema


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'maintenance': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 border-green-500/20';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'maintenance': return 'bg-red-500/10 border-red-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const getPlanColor = (plan?: string) => {
    switch (plan) {
      case 'L1': return 'text-purple-400 bg-purple-500/10';
      case 'L2': return 'text-blue-400 bg-blue-500/10';
      case 'L3': return 'text-green-400 bg-green-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  const removeClient = (clientId: string) => {
    setClientInstances(clientInstances.filter(client => client.id !== clientId));
    if (selectedClientLocal?.id === clientId) {
      setSelectedClientLocal(null);
    }
    setShowDeleteModal(false);
    setClientToDelete(null);
  };

  const handleDeleteClick = (client: ClientInstance) => {
    setClientToDelete(client);
    setShowDeleteModal(true);
  };

  const handleEditClient = (client: ClientInstance) => {
    setClientToEdit(client);
    setShowEditModal(true);
  };

  const handleDeactivateClient = (client: ClientInstance) => {
    setClientToDeactivate(client);
    setShowDeactivateModal(true);
  };

  const handleActivateClient = (client: ClientInstance) => {
    setClientToActivate(client);
    setShowActivateModal(true);
  };

  const DeleteConfirmationModal = () => {
    const [superAdminPassword, setSuperAdminPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDeleteConfirm = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setError('');

      try {
        // Validate inputs
        if (!superAdminPassword || superAdminPassword.trim().length === 0) {
          setError('Super admin password is required');
          setIsSubmitting(false);
          return;
        }

        if (!clientToDelete) {
          setError('No client selected for deletion');
          setIsSubmitting(false);
          return;
        }

        // Call backend API to soft delete organisation
        const token = Cookies.get('auth_token');
        const response = await fetch(`${BASE_URL}/organisations/${clientToDelete.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            password: superAdminPassword
          })
        });

        const data = await response.json();

        if (response.ok) {
          // Remove client from local state
          removeClient(clientToDelete.id);
          setSuperAdminPassword('');
          setError('');
        } else {
          setError(data.message || 'Failed to delete organisation');
        }
      } catch (error) {
        setError('An error occurred while deleting the organisation');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleCancel = () => {
      setShowDeleteModal(false);
      setClientToDelete(null);
      setSuperAdminPassword('');
      setError('');
    };

    if (!clientToDelete) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10 border-b border-gray-200/50 dark:border-gray-700/50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Client</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Permanent deletion confirmation</p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Warning Box */}
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 dark:text-red-200 font-bold text-sm">⚠️ PERMANENT DELETION WARNING!</p>
                  <p className="text-red-700 dark:text-red-300 text-sm mt-2">
                    You are about to <strong>permanently delete</strong> the organisation <strong>{clientToDelete.client_name}</strong>.
                  </p>
                  <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                    This will also <strong>permanently delete all associated users</strong>. This action <strong>CANNOT BE UNDONE</strong>!
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleDeleteConfirm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter Super Admin Password to Confirm *
                </label>
                <input
                  type="password"
                  required
                  value={superAdminPassword}
                  onChange={(e) => {
                    setSuperAdminPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800 transition-all duration-200"
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-all"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Organisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const AddClientModal = () => {
    const [formData, setFormData] = useState({
      organisation_name: '',
      client_name: '',
      industry: 'Technology',
      emails: [''],
      phone_numbers: [{country_code: '+91', number: ''}],
      subscription_plan_id: '',
      initial_assets: 0,
      wazuh_manager_ip: '',
      wazuh_manager_port: '',
      wazuh_manager_username: '',
      wazuh_manager_password: '',
      wazuh_indexer_ip: '',
      wazuh_indexer_port: '',
      wazuh_indexer_username: '',
      wazuh_indexer_password: '',
      wazuh_dashboard_ip: '',
      wazuh_dashboard_port: '',
      wazuh_dashboard_username: '',
      wazuh_dashboard_password: ''
    });
    const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Validation state
    const [validationErrors, setValidationErrors] = useState<{[key: string]: string | null}>({});

    // Validation functions
    const validateEmail = (email: string): string | null => {
      if (!email.trim()) return null; // Empty emails are handled separately
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        return 'Please enter a valid email address';
      }
      if (email.length > 254) {
        return 'Email address must be less than 254 characters';
      }
      return null;
    };

    const validatePhoneNumber = (phone: string): string | null => {
      if (!phone.trim()) return null; // Phone numbers are optional

      // Check format: +<country code> <mobile number>
      const phoneRegex = /^\+[1-9]\d{0,3}\s?\d{4,14}$/;
      if (!phoneRegex.test(phone)) {
        return 'Phone number must be in format: +<country code> <mobile number> (e.g., +1 1234567890)';
      }
      return null;
    };

    const validateOrganisationName = (name: string): string | null => {
      if (!name.trim()) {
        return 'Organization name is required';
      }
      if (name.length < 3) {
        return 'Organization name must be at least 3 characters';
      }
      if (name.length > 100) {
        return 'Organization name must be less than 100 characters';
      }
      if (!/^[a-zA-Z0-9\s\-\.&',()]+$/.test(name)) {
        return 'Organization name contains invalid characters';
      }
      return null;
    };

    const validateClientName = (name: string): string | null => {
      if (!name.trim()) {
        return 'Client name is required';
      }
      if (name.length < 3) {
        return 'Client name must be at least 3 characters';
      }
      if (name.length > 100) {
        return 'Client name must be less than 100 characters';
      }
      if (!/^[a-zA-Z0-9\s\-\.&',()]+$/.test(name)) {
        return 'Client name contains invalid characters';
      }
      return null;
    };

    const validateIPAddress = (ip: string): string | null => {
      if (!ip.trim()) {
        return 'IP address is required';
      }
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(ip)) {
        return 'Please enter a valid IPv4 address';
      }
      return null;
    };

    const validatePort = (port: string): string | null => {
      if (!port.trim()) {
        return 'Port is required';
      }
      const portNum = parseInt(port, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return 'Port must be between 1 and 65535';
      }
      return null;
    };

    const validateUsername = (username: string): string | null => {
      if (!username.trim()) {
        return 'Username is required';
      }
      if (username.length < 3) {
        return 'Username must be at least 3 characters';
      }
      if (username.length > 50) {
        return 'Username must be less than 50 characters';
      }
      if (!/^[a-zA-Z0-9_\-]+$/.test(username)) {
        return 'Username can only contain letters, numbers, underscores, and hyphens';
      }
      return null;
    };

    const validatePassword = (password: string): string | null => {
      if (!password.trim()) {
        return 'Password is required';
      }
      if (password.length < 8) {
        return 'Password must be at least 8 characters';
      }
      if (password.length > 128) {
        return 'Password must be less than 128 characters';
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
      }
      return null;
    };

    const validateInitialAssets = (assets: number): string | null => {
      if (assets < 0) {
        return 'Initial assets cannot be negative';
      }
      if (assets > 10000) {
        return 'Initial assets cannot exceed 10,000';
      }
      return null;
    };

    // Function to clear errors when user starts typing
    const clearErrors = () => {
      if (fetchError) {
        setFetchError(null);
      }
    };

    // Real-time validation function
    const validateField = (fieldName: string, value: string | number) => {
      let error: string | null = null;

      switch (fieldName) {
        case 'organisation_name':
          error = validateOrganisationName(value as string);
          break;
        case 'client_name':
          error = validateClientName(value as string);
          break;
        case 'initial_assets':
          error = validateInitialAssets(value as number);
          break;
        default:
          break;
      }

      setValidationErrors(prev => ({
        ...prev,
        [fieldName]: error
      }));

      return error === null;
    };

    useEffect(() => {
      const fetchPlans = async () => {
        try {
          const response = await subscriptionPlansApi.getActivePlans();
          if (response.success && Array.isArray(response.data)) {
            setSubscriptionPlans(response.data);
            if (response.data.length > 0) {
              setFormData(prev => ({ ...prev, subscription_plan_id: response.data[0].id }));
            }
          }
        } catch (error) {
          console.error("Failed to fetch subscription plans", error);
        }
      };
      if (showAddClientModal) {
        fetchPlans();
      }
    }, [showAddClientModal]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setValidationErrors({});

      // Comprehensive form validation
      const errors: {[key: string]: string} = {};

      // Validate organization name
      const orgNameError = validateOrganisationName(formData.organisation_name);
      if (orgNameError) errors.organisation_name = orgNameError;

      // Validate client name
      const clientNameError = validateClientName(formData.client_name);
      if (clientNameError) errors.client_name = clientNameError;

      // Validate initial assets
      const assetsError = validateInitialAssets(formData.initial_assets);
      if (assetsError) errors.initial_assets = assetsError;

      // Validate emails
      const validEmails = formData.emails.filter(email => email.trim() !== '');
      if (validEmails.length === 0) {
        errors.emails = 'At least one email address is required';
      } else {
        formData.emails.forEach((email, index) => {
          if (email.trim()) {
            const emailError = validateEmail(email);
            if (emailError) {
              errors[`email_${index}`] = emailError;
            }
          }
        });
      }

      // Validate phone numbers
      formData.phone_numbers.forEach((phone, index) => {
        if (phone.number && phone.number.trim()) {
          const fullPhone = `${phone.country_code} ${phone.number}`;
          const phoneError = validatePhoneNumber(fullPhone);
          if (phoneError) {
            errors[`phone_${index}`] = phoneError;
          }
        }
      });

      // Validate Wazuh credentials
      const ipFields = [
        { field: 'wazuh_manager_ip', label: 'Manager IP' },
        { field: 'wazuh_indexer_ip', label: 'Indexer IP' },
        { field: 'wazuh_dashboard_ip', label: 'Dashboard IP' }
      ];

      ipFields.forEach(({field, label}) => {
        const ipError = validateIPAddress(formData[field as keyof typeof formData] as string);
        if (ipError) errors[field] = ipError.replace('IP address', label);
      });

      const portFields = [
        { field: 'wazuh_manager_port', label: 'Manager Port' },
        { field: 'wazuh_indexer_port', label: 'Indexer Port' },
        { field: 'wazuh_dashboard_port', label: 'Dashboard Port' }
      ];

      portFields.forEach(({field, label}) => {
        const portError = validatePort(formData[field as keyof typeof formData] as string);
        if (portError) errors[field] = portError.replace('Port', label);
      });

      const usernameFields = [
        { field: 'wazuh_manager_username', label: 'Manager Username' },
        { field: 'wazuh_indexer_username', label: 'Indexer Username' },
        { field: 'wazuh_dashboard_username', label: 'Dashboard Username' }
      ];

      usernameFields.forEach(({field, label}) => {
        const usernameError = validateUsername(formData[field as keyof typeof formData] as string);
        if (usernameError) errors[field] = usernameError.replace('Username', label);
      });

      const passwordFields = [
        { field: 'wazuh_manager_password', label: 'Manager Password' },
        { field: 'wazuh_indexer_password', label: 'Indexer Password' },
        { field: 'wazuh_dashboard_password', label: 'Dashboard Password' }
      ];

      passwordFields.forEach(({field, label}) => {
        const passwordError = validatePassword(formData[field as keyof typeof formData] as string);
        if (passwordError) errors[field] = passwordError.replace('Password', label);
      });

      // If there are validation errors, display them and stop submission
      if (Object.keys(errors).length > 0) {
        console.log('Validation errors:', errors);
        setValidationErrors(errors);
        const errorCount = Object.keys(errors).length;
        const errorFields = Object.keys(errors).map(key => key.replace(/_/g, ' ')).join(', ');
        setFetchError(`Found ${errorCount} validation error(s). Please check: ${errorFields}`);
        setIsSubmitting(false);
        return;
      }

      try {
        const response = await organisationsApi.createOrganisation({
          organisation_name: formData.organisation_name,
          client_name: formData.client_name,
          industry: formData.industry,
          emails: formData.emails.filter(email => email.trim() !== ''),
          phone_numbers: formData.phone_numbers
            .filter(p => p.country_code && p.number && p.number.trim() !== '')
            .map(p => `${p.country_code} ${p.number}`),
          subscription_plan_id: formData.subscription_plan_id,
          initial_assets: formData.initial_assets,
          wazuh_manager_ip: formData.wazuh_manager_ip,
          wazuh_manager_port: parseInt(formData.wazuh_manager_port, 10),
          wazuh_manager_username: formData.wazuh_manager_username,
          wazuh_manager_password: formData.wazuh_manager_password,
          wazuh_indexer_ip: formData.wazuh_indexer_ip,
          wazuh_indexer_port: parseInt(formData.wazuh_indexer_port, 10),
          wazuh_indexer_username: formData.wazuh_indexer_username,
          wazuh_indexer_password: formData.wazuh_indexer_password,
          wazuh_dashboard_ip: formData.wazuh_dashboard_ip,
          wazuh_dashboard_port: parseInt(formData.wazuh_dashboard_port, 10),
          wazuh_dashboard_username: formData.wazuh_dashboard_username,
          wazuh_dashboard_password: formData.wazuh_dashboard_password
        });

        if (response.success) {
          // Refresh the client list
          const updatedClients = await organisationsApi.getOrganisations();
          if (updatedClients.success && Array.isArray(updatedClients.data)) {
            const mappedClients = updatedClients.data.map((org: any): ClientInstance => ({
              id: org._id,
              organisation_name: org.organisation_name,
              client_name: org.client_name,
              industry: org.industry || 'Technology',
              status: org.status === 'active' ? 'active' : org.is_active ? 'active' : 'inactive',
              contact_email: org.emails?.[0] || 'N/A',
              contact_phone: org.phone_numbers?.[0],
              emails: org.emails || [],  // Include full emails array
              phone_numbers: org.phone_numbers || [],  // Include full phone_numbers array
              subscription_status: org.subscription_status || 'active',
              subscription_plan: org.subscription_plan_id ? {
                id: typeof org.subscription_plan_id === 'string' ? org.subscription_plan_id : org.subscription_plan_id._id || org.subscription_plan_id.id,
                plan_name: org.subscription_plan_id?.plan_name || 'Basic',
                plan_code: org.subscription_plan_id?.plan_code || 'BASIC'
              } : undefined,
              user_count: org.current_user_count || 0,
              created_at: org.createdAt || new Date().toISOString(),
              updated_at: org.updatedAt || new Date().toISOString(),
              address: org.address,
              wazuh_manager_ip: org.wazuh_manager_ip,
              wazuh_manager_port: org.wazuh_manager_port,
              wazuh_indexer_ip: org.wazuh_indexer_ip,
              wazuh_indexer_port: org.wazuh_indexer_port,
              wazuh_dashboard_ip: org.wazuh_dashboard_ip,
              wazuh_dashboard_port: org.wazuh_dashboard_port,
            }));
            setClientInstances(mappedClients);
          }
          setShowAddClientModal(false);
          // Reset form
          setFormData({
            organisation_name: '',
            client_name: '',
            industry: 'Technology',
            emails: [''],
            phone_numbers: [{ country_code: '+1', number: '' }],
            subscription_plan_id: subscriptionPlans.length > 0 ? subscriptionPlans[0].id : '',
            initial_assets: 0,
            wazuh_manager_ip: '',
            wazuh_manager_port: '',
            wazuh_manager_username: '',
            wazuh_manager_password: '',
            wazuh_indexer_ip: '',
            wazuh_indexer_port: '',
            wazuh_indexer_username: '',
            wazuh_indexer_password: '',
            wazuh_dashboard_ip: '',
            wazuh_dashboard_port: '',
            wazuh_dashboard_username: '',
            wazuh_dashboard_password: ''
          });
        }
      } catch (error: any) {
        console.error('Error creating organization:', error);
        setFetchError(`Failed to create client: ${error.message}`);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
          {/* Modal Header with Gradient */}
          <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Client</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Create a new client organization</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddClientModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-200"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-800/30">
            <form onSubmit={handleSubmit} className="h-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Basic Information */}
                <div className="space-y-6">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl mr-3">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      Basic Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Organization Name *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={formData.organisation_name}
                          onChange={(e) => {
                            clearErrors();
                            setFormData({ ...formData, organisation_name: e.target.value });
                            validateField('organisation_name', e.target.value);
                          }}
                          className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                            validationErrors.organisation_name
                              ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                              : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                          }`}
                          placeholder="e.g., Xyz Corporation"
                        />
                        {validationErrors.organisation_name && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {validationErrors.organisation_name}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {formData.organisation_name.length}/100 characters
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Client Name *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={formData.client_name}
                          onChange={(e) => {
                            clearErrors();
                            setFormData({ ...formData, client_name: e.target.value });
                            validateField('client_name', e.target.value);
                          }}
                          className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                            validationErrors.client_name
                              ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                              : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                          }`}
                          placeholder="e.g., Xyz Tech"
                        />
                        {validationErrors.client_name && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {validationErrors.client_name}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {formData.client_name.length}/100 characters
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Industry
                        </label>
                        <select
                          value={formData.industry}
                          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                          className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                        >
                          <option value="Technology">Technology</option>
                          <option value="Financial Services">Financial Services</option>
                          <option value="Healthcare">Healthcare</option>
                          <option value="Retail">Retail</option>
                          <option value="Education">Education</option>
                          <option value="Manufacturing">Manufacturing</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Subscription Plan *
                        </label>
                        <select
                          required
                          value={formData.subscription_plan_id}
                          onChange={(e) => setFormData({ ...formData, subscription_plan_id: e.target.value })}
                          className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                        >
                          {subscriptionPlans.map(plan => (
                            <option key={plan.id} value={plan.id}>{plan.plan_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Initial Assets
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          value={formData.initial_assets}
                          onChange={(e) => {
                            clearErrors();
                            const value = parseInt(e.target.value, 10) || 0;
                            setFormData({ ...formData, initial_assets: value });
                            validateField('initial_assets', value);
                          }}
                          className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                            validationErrors.initial_assets
                              ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                              : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                          }`}
                          placeholder="Number of initial assets (0-10,000)"
                        />
                        {validationErrors.initial_assets && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {validationErrors.initial_assets}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl mr-3">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      Contact Information
                    </h3>
                    <div className="space-y-4">
                      {/* Dynamic Email Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email Addresses *
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                emails: [...formData.emails, '']
                              });
                            }}
                            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Email
                          </button>
                        </div>
                        <div className="space-y-2">
                          {formData.emails.map((email, index) => (
                            <div key={index} className="flex gap-2">
                              <div className="flex-1">
                                <input
                                  type="email"
                                  required={index === 0}
                                  maxLength={254}
                                  value={email}
                                  onChange={(e) => {
                                    clearErrors();
                                    const newEmails = [...formData.emails];
                                    newEmails[index] = e.target.value;
                                    setFormData({ ...formData, emails: newEmails });

                                    // Validate email if not empty
                                    if (e.target.value.trim()) {
                                      const emailError = validateEmail(e.target.value);
                                      setValidationErrors(prev => ({
                                        ...prev,
                                        [`email_${index}`]: emailError
                                      }));
                                    } else {
                                      setValidationErrors(prev => {
                                        const newErrors = { ...prev };
                                        delete newErrors[`email_${index}`];
                                        return newErrors;
                                      });
                                    }
                                  }}
                                  className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                    validationErrors[`email_${index}`]
                                      ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                      : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                                  }`}
                                  placeholder={index === 0 ? "contact@example.com (Primary)" : "additional@example.com"}
                                />
                                {validationErrors[`email_${index}`] && (
                                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                    {validationErrors[`email_${index}`]}
                                  </p>
                                )}
                              </div>
                              {formData.emails.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newEmails = formData.emails.filter((_, i) => i !== index);
                                    setFormData({ ...formData, emails: newEmails });
                                  }}
                                  className="p-3 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                  title="Remove email"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Dynamic Phone Number Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Phone Numbers
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                phone_numbers: [...formData.phone_numbers, {country_code: '+91', number: ''}]
                              });
                            }}
                            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Phone
                          </button>
                        </div>
                        <div className="space-y-2">
                          {formData.phone_numbers.map((phone, index) => (
                            <div key={index} className="flex gap-2">
                              <div className="w-32">
                                <input
                                  type="text"
                                  maxLength={5}
                                  value={phone.country_code}
                                  onChange={(e) => {
                                    const newPhones = [...formData.phone_numbers];
                                    newPhones[index] = {...newPhones[index], country_code: e.target.value};
                                    setFormData({ ...formData, phone_numbers: newPhones });
                                  }}
                                  className="w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800"
                                  placeholder="+91"
                                />
                              </div>
                              <div className="flex-1">
                                <input
                                  type="tel"
                                  maxLength={14}
                                  value={phone.number}
                                  onChange={(e) => {
                                    const newPhones = [...formData.phone_numbers];
                                    newPhones[index] = {...newPhones[index], number: e.target.value.replace(/\D/g, '')};
                                    setFormData({ ...formData, phone_numbers: newPhones });
                                  }}
                                  className="w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800"
                                  placeholder="9876543210"
                                />
                              </div>
                              {formData.phone_numbers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newPhones = formData.phone_numbers.filter((_, i) => i !== index);
                                    setFormData({ ...formData, phone_numbers: newPhones });
                                  }}
                                  className="p-3 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                  title="Remove phone number"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Security Credentials */}
                <div className="space-y-6">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl mr-3">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      Security Credentials
                    </h3>
                    <div className="space-y-6">
                      {/* Manager Section */}
                      <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200/30 dark:border-gray-700/30">
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          Manager Configuration
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Manager IP *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.wazuh_manager_ip}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_manager_ip: e.target.value });
                                validateField('wazuh_manager_ip', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_manager_ip
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="123.456.789.123"
                            />
                            {validationErrors.wazuh_manager_ip && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_manager_ip}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Manager Port *
                            </label>
                            <input
                              type="number"
                              required
                              value={formData.wazuh_manager_port}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_manager_port: e.target.value });
                                validateField('wazuh_manager_port', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_manager_port
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="55000"
                            />
                            {validationErrors.wazuh_manager_port && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_manager_port}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Manager Username *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.wazuh_manager_username}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_manager_username: e.target.value });
                                validateField('wazuh_manager_username', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_manager_username
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="manager_username"
                            />
                            {validationErrors.wazuh_manager_username && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_manager_username}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Manager Password *
                            </label>
                            <input
                              type="password"
                              required
                              value={formData.wazuh_manager_password}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_manager_password: e.target.value });
                                validateField('wazuh_manager_password', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_manager_password
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="••••••••"
                            />
                            {validationErrors.wazuh_manager_password && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_manager_password}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Indexer Section */}
                      <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200/30 dark:border-gray-700/30">
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          Indexer Configuration
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Indexer IP *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.wazuh_indexer_ip}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_indexer_ip: e.target.value });
                                validateField('wazuh_indexer_ip', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_indexer_ip
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="123.456.789.123"
                            />
                            {validationErrors.wazuh_indexer_ip && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_indexer_ip}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Indexer Port *
                            </label>
                            <input
                              type="number"
                              required
                              value={formData.wazuh_indexer_port}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_indexer_port: e.target.value });
                                validateField('wazuh_indexer_port', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_indexer_port
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="9200"
                            />
                            {validationErrors.wazuh_indexer_port && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_indexer_port}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Indexer Username *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.wazuh_indexer_username}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_indexer_username: e.target.value });
                                validateField('wazuh_indexer_username', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_indexer_username
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="indexer_username"
                            />
                            {validationErrors.wazuh_indexer_username && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_indexer_username}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Indexer Password *
                            </label>
                            <input
                              type="password"
                              required
                              value={formData.wazuh_indexer_password}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_indexer_password: e.target.value });
                                validateField('wazuh_indexer_password', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_indexer_password
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="••••••••"
                            />
                            {validationErrors.wazuh_indexer_password && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_indexer_password}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Dashboard Section */}
                      <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200/30 dark:border-gray-700/30">
                        <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                          <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                          Dashboard Configuration
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Dashboard IP *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.wazuh_dashboard_ip}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_dashboard_ip: e.target.value });
                                validateField('wazuh_dashboard_ip', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_dashboard_ip
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="123.456.789.123"
                            />
                            {validationErrors.wazuh_dashboard_ip && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_dashboard_ip}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Dashboard Port *
                            </label>
                            <input
                              type="number"
                              required
                              value={formData.wazuh_dashboard_port}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_dashboard_port: e.target.value });
                                validateField('wazuh_dashboard_port', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_dashboard_port
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="443"
                            />
                            {validationErrors.wazuh_dashboard_port && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_dashboard_port}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Dashboard Username *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.wazuh_dashboard_username}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_dashboard_username: e.target.value });
                                validateField('wazuh_dashboard_username', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_dashboard_username
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="dashboard_username"
                            />
                            {validationErrors.wazuh_dashboard_username && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_dashboard_username}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Dashboard Password *
                            </label>
                            <input
                              type="password"
                              required
                              value={formData.wazuh_dashboard_password}
                              onChange={(e) => {
                                clearErrors();
                                setFormData({ ...formData, wazuh_dashboard_password: e.target.value });
                                validateField('wazuh_dashboard_password', e.target.value);
                              }}
                              className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                                validationErrors.wazuh_dashboard_password
                                  ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                                  : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                              }`}
                              placeholder="••••••••"
                            />
                            {validationErrors.wazuh_dashboard_password && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.wazuh_dashboard_password}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {fetchError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mt-6">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-700 dark:text-red-200 text-sm font-medium">{fetchError}</p>
                    <button
                      type="button"
                      onClick={() => setFetchError(null)}
                      className="ml-auto text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-4 pt-6 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddClientModal(false);
                    setFetchError(null);
                  }}
                  className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-600 hover:border-blue-700 rounded-xl transition-all duration-200 hover:scale-105 shadow-sm disabled:hover:scale-100"
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding Client...
                    </div>
                  ) : (
                    'Add Client'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const EditClientModal = () => {
    // Parse phone numbers when initializing
    const parsePhoneNumbers = (phones: string[] | undefined) => {
      if (!phones || phones.length === 0) return [{country_code: '+91', number: ''}];
      return phones.map(phone => {
        const parts = phone.split(' ');
        if (parts.length === 2) {
          return {country_code: parts[0], number: parts[1]};
        }
        return {country_code: '+91', number: ''};
      });
    };

    const [formData, setFormData] = useState({
      organisation_name: clientToEdit?.organisation_name || '',
      client_name: clientToEdit?.client_name || '',
      industry: clientToEdit?.industry || 'Technology',
      emails: clientToEdit?.emails && clientToEdit.emails.length > 0 ? clientToEdit.emails : [''],
      phone_numbers: parsePhoneNumbers(clientToEdit?.phone_numbers),
      subscription_plan_id: clientToEdit?.subscription_plan?.id || '',
      wazuh_manager_ip: clientToEdit?.wazuh_manager_ip || '',
      wazuh_manager_port: clientToEdit?.wazuh_manager_port?.toString() || '',
      wazuh_manager_username: '',
      wazuh_manager_password: '',
      wazuh_indexer_ip: clientToEdit?.wazuh_indexer_ip || '',
      wazuh_indexer_port: clientToEdit?.wazuh_indexer_port?.toString() || '',
      wazuh_indexer_username: '',
      wazuh_indexer_password: '',
      wazuh_dashboard_ip: clientToEdit?.wazuh_dashboard_ip || '',
      wazuh_dashboard_port: clientToEdit?.wazuh_dashboard_port?.toString() || '',
      wazuh_dashboard_username: '',
      wazuh_dashboard_password: ''
    });
    const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Fetch subscription plans
    useEffect(() => {
      const fetchPlans = async () => {
        try {
          const response = await subscriptionPlansApi.getActivePlans();
          if (response.success && Array.isArray(response.data)) {
            setSubscriptionPlans(response.data);
            // Set default plan if not already set
            if (!formData.subscription_plan_id && response.data.length > 0) {
              setFormData(prev => ({ ...prev, subscription_plan_id: response.data[0].id }));
            }
          }
        } catch (error) {
          console.error('Failed to fetch subscription plans:', error);
        }
      };
      fetchPlans();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setError('');

      try {
        const token = Cookies.get('auth_token');

        // Prepare payload - only include credentials if they were entered
        const payload: any = {
          organisation_name: formData.organisation_name,
          client_name: formData.client_name,
          industry: formData.industry,
          emails: formData.emails.filter(email => email && email.trim() !== '')
        };

        // Add subscription_plan_id if provided
        if (formData.subscription_plan_id && formData.subscription_plan_id.trim()) {
          payload.subscription_plan_id = formData.subscription_plan_id;
        }

        // Only include phone_numbers if there are valid ones
        const validPhoneNumbers = formData.phone_numbers
          .filter(p => p.country_code && p.number && p.number.trim() !== '')
          .map(p => `${p.country_code} ${p.number}`);
        if (validPhoneNumbers.length > 0) {
          payload.phone_numbers = validPhoneNumbers;
        }

        // Add Wazuh Manager configuration if provided
        if (formData.wazuh_manager_ip && formData.wazuh_manager_ip.trim()) {
          payload.wazuh_manager_ip = formData.wazuh_manager_ip.trim();
        }
        if (formData.wazuh_manager_port && formData.wazuh_manager_port.trim()) {
          payload.wazuh_manager_port = parseInt(formData.wazuh_manager_port, 10);
        }
        if (formData.wazuh_manager_username && formData.wazuh_manager_username.trim()) {
          payload.wazuh_manager_username = formData.wazuh_manager_username.trim();
        }
        if (formData.wazuh_manager_password && formData.wazuh_manager_password.trim()) {
          // Validate password strength
          if (formData.wazuh_manager_password.length < 8) {
            setError('Wazuh Manager password must be at least 8 characters');
            setIsSubmitting(false);
            return;
          }
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.wazuh_manager_password)) {
            setError('Wazuh Manager password must contain uppercase, lowercase, and digit');
            setIsSubmitting(false);
            return;
          }
          payload.wazuh_manager_password = formData.wazuh_manager_password;
        }

        // Add Wazuh Indexer configuration if provided
        if (formData.wazuh_indexer_ip && formData.wazuh_indexer_ip.trim()) {
          payload.wazuh_indexer_ip = formData.wazuh_indexer_ip.trim();
        }
        if (formData.wazuh_indexer_port && formData.wazuh_indexer_port.trim()) {
          payload.wazuh_indexer_port = parseInt(formData.wazuh_indexer_port, 10);
        }
        if (formData.wazuh_indexer_username && formData.wazuh_indexer_username.trim()) {
          payload.wazuh_indexer_username = formData.wazuh_indexer_username.trim();
        }
        if (formData.wazuh_indexer_password && formData.wazuh_indexer_password.trim()) {
          // Validate password strength
          if (formData.wazuh_indexer_password.length < 8) {
            setError('Wazuh Indexer password must be at least 8 characters');
            setIsSubmitting(false);
            return;
          }
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.wazuh_indexer_password)) {
            setError('Wazuh Indexer password must contain uppercase, lowercase, and digit');
            setIsSubmitting(false);
            return;
          }
          payload.wazuh_indexer_password = formData.wazuh_indexer_password;
        }

        // Add Wazuh Dashboard configuration if provided
        if (formData.wazuh_dashboard_ip && formData.wazuh_dashboard_ip.trim()) {
          payload.wazuh_dashboard_ip = formData.wazuh_dashboard_ip.trim();
        }
        if (formData.wazuh_dashboard_port && formData.wazuh_dashboard_port.trim()) {
          payload.wazuh_dashboard_port = parseInt(formData.wazuh_dashboard_port, 10);
        }
        if (formData.wazuh_dashboard_username && formData.wazuh_dashboard_username.trim()) {
          payload.wazuh_dashboard_username = formData.wazuh_dashboard_username.trim();
        }
        if (formData.wazuh_dashboard_password && formData.wazuh_dashboard_password.trim()) {
          // Validate password strength
          if (formData.wazuh_dashboard_password.length < 8) {
            setError('Wazuh Dashboard password must be at least 8 characters');
            setIsSubmitting(false);
            return;
          }
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.wazuh_dashboard_password)) {
            setError('Wazuh Dashboard password must contain uppercase, lowercase, and digit');
            setIsSubmitting(false);
            return;
          }
          payload.wazuh_dashboard_password = formData.wazuh_dashboard_password;
        }

        console.log('Sending update payload:', payload);

        const response = await fetch(`${BASE_URL}/organisations/${clientToEdit?.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
          // Refresh the client list to get updated data
          const updatedClients = await organisationsApi.getOrganisations();
          if (updatedClients.success && Array.isArray(updatedClients.data)) {
            const mappedClients = updatedClients.data.map((org: any): ClientInstance => ({
              id: org._id,
              organisation_name: org.organisation_name,
              client_name: org.client_name,
              industry: org.industry || 'Technology',
              status: org.status === 'active' ? 'active' : org.is_active ? 'active' : 'inactive',
              contact_email: org.emails?.[0] || 'N/A',
              contact_phone: org.phone_numbers?.[0],
              emails: org.emails || [],
              phone_numbers: org.phone_numbers || [],
              subscription_status: org.subscription_status || 'active',
              subscription_plan: org.subscription_plan_id ? {
                id: typeof org.subscription_plan_id === 'string' ? org.subscription_plan_id : org.subscription_plan_id._id || org.subscription_plan_id.id,
                plan_name: org.subscription_plan_id?.plan_name || 'Basic',
                plan_code: org.subscription_plan_id?.plan_code || 'BASIC'
              } : undefined,
              user_count: org.current_user_count || 0,
              created_at: org.createdAt || new Date().toISOString(),
              updated_at: org.updatedAt || new Date().toISOString(),
              address: org.address,
              wazuh_manager_ip: org.wazuh_manager_ip,
              wazuh_manager_port: org.wazuh_manager_port,
              wazuh_indexer_ip: org.wazuh_indexer_ip,
              wazuh_indexer_port: org.wazuh_indexer_port,
              wazuh_dashboard_ip: org.wazuh_dashboard_ip,
              wazuh_dashboard_port: org.wazuh_dashboard_port,
            }));
            setClientInstances(mappedClients);

            // Update selectedClientLocal if it's the one being edited
            const updatedClient = mappedClients.find((c: ClientInstance) => c.id === clientToEdit?.id);
            if (selectedClientLocal?.id === clientToEdit?.id && updatedClient) {
              setSelectedClientLocal(updatedClient);
            }
          }

          setShowEditModal(false);
          setClientToEdit(null);
        } else {
          console.error('Update failed:', data);
          // Extract detailed validation errors if available
          let errorMessage = data.message || 'Failed to update client';
          if (data.details) {
            errorMessage += ': ' + JSON.stringify(data.details);
          }
          if (data.error) {
            errorMessage += ' - ' + data.error;
          }
          setError(errorMessage);
        }
      } catch (err: any) {
        console.error('Update error:', err);
        setError(err.message || 'An error occurred while updating the client');
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!clientToEdit) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 border-b border-gray-200/50 dark:border-gray-700/50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Client</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Update client organization details</p>
                </div>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setClientToEdit(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-800/30">
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Basic Info & Contact */}
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4">Basic Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Organization Name *</label>
                        <input type="text" required value={formData.organisation_name} onChange={(e) => setFormData({ ...formData, organisation_name: e.target.value })} className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Client Name *</label>
                        <input type="text" required value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Industry</label>
                        <select value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                          <option value="Technology">Technology</option>
                          <option value="Financial Services">Financial Services</option>
                          <option value="Healthcare">Healthcare</option>
                          <option value="Retail">Retail</option>
                          <option value="Education">Education</option>
                          <option value="Manufacturing">Manufacturing</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subscription Plan</label>
                        <select
                          value={formData.subscription_plan_id}
                          onChange={(e) => setFormData({ ...formData, subscription_plan_id: e.target.value })}
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                          {subscriptionPlans.map(plan => (
                            <option key={plan.id} value={plan.id}>{plan.plan_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4">Contact Information</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Addresses *</label>
                          <button type="button" onClick={() => setFormData({ ...formData, emails: [...formData.emails, ''] })} className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded">+ Add</button>
                        </div>
                        {formData.emails.map((email, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input type="email" required={i === 0} value={email} onChange={(e) => { const newEmails = [...formData.emails]; newEmails[i] = e.target.value; setFormData({ ...formData, emails: newEmails }); }} className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder={i === 0 ? "Primary email" : "Additional email"} />
                            {formData.emails.length > 1 && <button type="button" onClick={() => setFormData({ ...formData, emails: formData.emails.filter((_, idx) => idx !== i) })} className="px-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">×</button>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Numbers</label>
                          <button type="button" onClick={() => setFormData({ ...formData, phone_numbers: [...formData.phone_numbers, {country_code: '+91', number: ''}] })} className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded">+ Add</button>
                        </div>
                        {formData.phone_numbers.map((phone, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <div className="w-24">
                              <input type="text" maxLength={5} value={phone.country_code} onChange={(e) => { const newPhones = [...formData.phone_numbers]; newPhones[i] = {...newPhones[i], country_code: e.target.value}; setFormData({ ...formData, phone_numbers: newPhones }); }} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="+91" />
                            </div>
                            <input type="tel" maxLength={14} value={phone.number} onChange={(e) => { const newPhones = [...formData.phone_numbers]; newPhones[i] = {...newPhones[i], number: e.target.value.replace(/\D/g, '')}; setFormData({ ...formData, phone_numbers: newPhones }); }} className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="9876543210" />
                            {formData.phone_numbers.length > 1 && <button type="button" onClick={() => setFormData({ ...formData, phone_numbers: formData.phone_numbers.filter((_, idx) => idx !== i) })} className="px-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">×</button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Wazuh Config */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4">Wazuh Configuration</h3>
                  <div className="space-y-4">
                    {/* Manager */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-3">Manager</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">IP</label>
                          <input type="text" value={formData.wazuh_manager_ip} onChange={(e) => setFormData({ ...formData, wazuh_manager_ip: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="192.168.1.100" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Port</label>
                          <input type="number" value={formData.wazuh_manager_port} onChange={(e) => setFormData({ ...formData, wazuh_manager_port: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="55000" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Username</label>
                          <input type="text" value={formData.wazuh_manager_username} onChange={(e) => setFormData({ ...formData, wazuh_manager_username: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="Update if needed" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Password</label>
                          <input type="password" value={formData.wazuh_manager_password} onChange={(e) => setFormData({ ...formData, wazuh_manager_password: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="Update if needed" />
                        </div>
                      </div>
                    </div>

                    {/* Indexer */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-3">Indexer</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">IP</label>
                          <input type="text" value={formData.wazuh_indexer_ip} onChange={(e) => setFormData({ ...formData, wazuh_indexer_ip: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="192.168.1.101" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Port</label>
                          <input type="number" value={formData.wazuh_indexer_port} onChange={(e) => setFormData({ ...formData, wazuh_indexer_port: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="9200" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Username</label>
                          <input type="text" value={formData.wazuh_indexer_username} onChange={(e) => setFormData({ ...formData, wazuh_indexer_username: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="Update if needed" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Password</label>
                          <input type="password" value={formData.wazuh_indexer_password} onChange={(e) => setFormData({ ...formData, wazuh_indexer_password: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="Update if needed" />
                        </div>
                      </div>
                    </div>

                    {/* Dashboard */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-3">Dashboard</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">IP</label>
                          <input type="text" value={formData.wazuh_dashboard_ip} onChange={(e) => setFormData({ ...formData, wazuh_dashboard_ip: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="192.168.1.102" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Port</label>
                          <input type="number" value={formData.wazuh_dashboard_port} onChange={(e) => setFormData({ ...formData, wazuh_dashboard_port: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="443" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Username</label>
                          <input type="text" value={formData.wazuh_dashboard_username} onChange={(e) => setFormData({ ...formData, wazuh_dashboard_username: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="Update if needed" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Password</label>
                          <input type="password" value={formData.wazuh_dashboard_password} onChange={(e) => setFormData({ ...formData, wazuh_dashboard_password: e.target.value })} className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white" placeholder="Update if needed" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => { setShowEditModal(false); setClientToEdit(null); }} className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg">
                  {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const DeactivateClientModal = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleDeactivate = async () => {
      setIsSubmitting(true);
      setError('');

      try {
        const token = Cookies.get('auth_token');
        const response = await fetch(`${BASE_URL}/organisations/${clientToDeactivate?.id}/deactivate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (response.ok) {
          setClientInstances(clientInstances.map(c =>
            c.id === clientToDeactivate?.id ? { ...c, status: 'inactive' } : c
          ));

          if (selectedClientLocal?.id === clientToDeactivate?.id) {
            setSelectedClientLocal({ ...selectedClientLocal, status: 'inactive' } as ClientInstance);
          }

          setShowDeactivateModal(false);
          setClientToDeactivate(null);
        } else {
          setError(data.message || 'Failed to deactivate client');
        }
      } catch (err) {
        setError('An error occurred while deactivating the client');
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!clientToDeactivate) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 dark:from-yellow-500/20 dark:to-yellow-600/10 border-b border-gray-200/50 dark:border-gray-700/50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Deactivate Client</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Temporarily disable client access</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setClientToDeactivate(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium mb-2">
                    Are you sure you want to deactivate <strong>{clientToDeactivate?.client_name}</strong>?
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    This will also deactivate all users who only belong to this organisation.
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeactivateModal(false);
                  setClientToDeactivate(null);
                }}
                className="flex-1 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={isSubmitting}
                className="flex-1 px-6 py-2.5 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded-lg transition-all"
              >
                {isSubmitting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ActivateClientModal = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleActivate = async () => {
      setIsSubmitting(true);
      setError('');

      try {
        const token = Cookies.get('auth_token');
        const response = await fetch(`${BASE_URL}/organisations/${clientToActivate?.id}/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (response.ok) {
          setClientInstances(clientInstances.map(c =>
            c.id === clientToActivate?.id ? { ...c, status: 'active' } : c
          ));

          if (selectedClientLocal?.id === clientToActivate?.id) {
            setSelectedClientLocal({ ...selectedClientLocal, status: 'active' } as ClientInstance);
          }

          setShowActivateModal(false);
          setClientToActivate(null);
        } else {
          setError(data.message || 'Failed to activate client');
        }
      } catch (err) {
        setError('An error occurred while activating the client');
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!clientToActivate) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-green-500/10 to-green-600/5 dark:from-green-500/20 dark:to-green-600/10 border-b border-gray-200/50 dark:border-gray-700/50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Activate Client</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Re-enable client access</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowActivateModal(false);
                  setClientToActivate(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium mb-2">
                    Are you sure you want to activate <strong>{clientToActivate?.client_name}</strong>?
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    This will also reactivate all users who only belong to this organisation.
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowActivateModal(false);
                  setClientToActivate(null);
                }}
                className="flex-1 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                disabled={isSubmitting}
                className="flex-1 px-6 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-all"
              >
                {isSubmitting ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Loading client data...</p>
      </div>
    );
  }

  if (selectedClientLocal) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setSelectedClientLocal(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Back to Client Overview</span>
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClientLocal.client_name}</h1>
              <p className="text-gray-600 dark:text-gray-400">{selectedClientLocal.organisation_name} • {selectedClientLocal.industry}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={clsx('px-3 py-1 rounded-full text-sm font-medium border', getStatusBg(selectedClientLocal.status))}>
                <span className={getStatusColor(selectedClientLocal.status)}>
                  {selectedClientLocal.status.charAt(0).toUpperCase() + selectedClientLocal.status.slice(1)}
                </span>
              </div>
              <div className="flex gap-2">
                {hasUpdatePermission && (
                  <button
                    onClick={() => handleEditClient(selectedClientLocal)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                    title="Edit Client"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                )}
                {hasUpdatePermission && (
                  selectedClientLocal.status === 'active' ? (
                    <button
                      onClick={() => handleDeactivateClient(selectedClientLocal)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                      title="Deactivate Client"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivateClient(selectedClientLocal)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                      title="Activate Client"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Activate
                    </button>
                  )
                )}
                {hasDeletePermission && (
                  <button
                    onClick={() => handleDeleteClick(selectedClientLocal)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                    title="Delete Client"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button
            onClick={() => handleClientNavigation('/dashboard')}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left shadow-sm"
          >
            <HomeIcon className="h-8 w-8 text-blue-500 mb-3" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Dashboard</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Access real-time security operations</p>
          </button>

          <button
            onClick={() => handleClientNavigation('/alerts')}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 transition-colors text-left shadow-sm"
          >
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mb-3" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Live Alerts</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Monitor security alerts in real-time</p>
          </button>

          <button
            onClick={() => handleClientNavigation('/tickets')}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors text-left shadow-sm"
          >
            <TicketIcon className="h-8 w-8 text-green-500 mb-3" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Tickets</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Review and assign security incidents</p>
          </button>

          <button
            onClick={() => handleClientNavigation('/reports')}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors text-left shadow-sm"
          >
            <DocumentChartBarIcon className="h-8 w-8 text-purple-500 mb-3" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Reports</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Generate security insights</p>
          </button>

          <button
            onClick={() => handleClientNavigation('/risk-matrix')}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 transition-colors text-left shadow-sm"
          >
            <ShieldExclamationIcon className="h-8 w-8 text-orange-500 mb-3" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Risk Matrix</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Assess security risks</p>
          </button>

          <button
            onClick={() => handleClientNavigation('/compliance')}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors text-left shadow-sm"
          >
            <ShieldCheckIcon className="h-8 w-8 text-indigo-500 mb-3" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Compliance</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Track compliance status</p>
          </button>

          <button
            onClick={() => handleClientNavigation('/asset-register')}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors text-left shadow-sm"
          >
            <ServerIcon className="h-8 w-8 text-cyan-500 mb-3" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Asset Register</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Manage your assets</p>
          </button>

          <button
            onClick={() => handleClientNavigation('/agents')}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-500 transition-colors text-left shadow-sm"
          >
            <UsersIcon className="h-8 w-8 text-teal-500 mb-3" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Agents Overview</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Monitor deployed agents</p>
          </button>

          <button
            onClick={() => handleClientNavigation('/siem')}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors text-left shadow-sm"
          >
            <CpuChipIcon className="h-8 w-8 text-yellow-500 mb-3" />
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">SIEM Portal</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Access SIEM dashboard</p>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm md:col-span-2 lg:col-span-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security Configuration</h3>
            <div className="space-y-4">
                <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Manager</p>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">IP:</span>
                        <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.wazuh_manager_ip || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Port:</span>
                        <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.wazuh_manager_port || 'N/A'}</span>
                    </div>
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Indexer</p>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">IP:</span>
                        <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.wazuh_indexer_ip || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Port:</span>
                        <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.wazuh_indexer_port || 'N/A'}</span>
                    </div>
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard</p>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">IP:</span>
                        <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.wazuh_dashboard_ip || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Port:</span>
                        <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.wazuh_dashboard_port || 'N/A'}</span>
                    </div>
                </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
            <div className="space-y-4">
              {/* Email Addresses */}
              {selectedClientLocal.emails && selectedClientLocal.emails.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Email Addresses</p>
                  <div className="space-y-1">
                    {selectedClientLocal.emails.map((email: string, index: number) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-900 dark:text-white font-mono">{email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedClientLocal.contact_email ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Email</p>
                  <div className="text-sm">
                    <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.contact_email}</span>
                  </div>
                </div>
              ) : null}

              {/* Phone Numbers */}
              {selectedClientLocal.phone_numbers && selectedClientLocal.phone_numbers.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Phone Numbers</p>
                  <div className="space-y-1">
                    {selectedClientLocal.phone_numbers.map((phone: string, index: number) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-900 dark:text-white font-mono">{phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedClientLocal.contact_phone ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Phone</p>
                  <div className="text-sm">
                    <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.contact_phone}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Plan:</span>
                <span className={clsx('px-2 py-1 rounded text-xs font-medium capitalize', getPlanColor(selectedClientLocal.subscription_plan?.plan_name))}>
                  {selectedClientLocal.subscription_plan?.plan_name || 'Basic'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modals for Detail View */}
        {showEditModal && typeof window !== 'undefined' && createPortal(
          <EditClientModal />,
          document.body
        )}

        {showDeactivateModal && typeof window !== 'undefined' && createPortal(
          <DeactivateClientModal />,
          document.body
        )}

        {showActivateModal && typeof window !== 'undefined' && createPortal(
          <ActivateClientModal />,
          document.body
        )}

        {showDeleteModal && typeof window !== 'undefined' && createPortal(
          <DeleteConfirmationModal />,
          document.body
        )}
      </div>
    );
  }

  // Main overview component - default case
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Client Overview</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor and manage security operations for all clients</p>
        </div>
        {hasCreatePermission && (
          <button
            onClick={() => setShowAddClientModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Add Client
          </button>
        )}
      </div>

      {fetchError && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg">
          <p><strong>Error:</strong> {fetchError + " OR THIS LOGIN USER DON'T HAVE ACCESS "}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <BuildingOfficeIcon className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Clients</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalClients}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            <div className="flex-1">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Total Active Alerts <span className="text-xs text-gray-500 dark:text-gray-500">(Last 24 hours, all clients)</span>
              </p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {alertsLoading ? (
                    <span className="animate-pulse text-gray-400">Loading...</span>
                  ) : (
                    totalActiveAlerts.toLocaleString()
                  )}
                </p>
                {alertsLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <ServerIcon className="h-8 w-8 text-green-500" />
            <div className="flex-1">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Total Protected Endpoints <span className="text-xs text-gray-500 dark:text-gray-500">(All clients)</span>
              </p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {alertsLoading ? (
                    <span className="animate-pulse text-gray-400">Loading...</span>
                  ) : (
                    totalProtectedEndpoints.toLocaleString()
                  )}
                </p>
                {alertsLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Average Uptime</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgUptime}%</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Client Security Operations</h2>
        {clientInstances.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {clientInstances.map((client) => (
              <div
                key={client.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer shadow-sm flex flex-col"
                onClick={() => setSelectedClientLocal(client)}
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={client.client_name}>{client.client_name}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className={clsx('px-2 py-1 rounded text-xs font-medium border capitalize', getStatusBg(client.status))}>
                        <span className={getStatusColor(client.status)}>
                          {client.status}
                        </span>
                      </div>
                      {/* <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(client);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Remove client"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button> */}
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm truncate" title={client.organisation_name}>{client.organisation_name}</p>
                  <p className="text-gray-500 dark:text-gray-500 text-xs">{client.industry}</p>
                </div>

                <div className="p-6 space-y-4 flex-grow">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Active Alerts (24h)</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {alertsLoading ? (
                        <span className="animate-pulse text-gray-400">...</span>
                      ) : (
                        clientAlerts[client.id] !== undefined ? clientAlerts[client.id] : '--'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Protected Endpoints</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {alertsLoading ? (
                        <span className="animate-pulse text-gray-400">...</span>
                      ) : (
                        clientAgents[client.id] !== undefined ? clientAgents[client.id].toLocaleString() : '--'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Uptime</span>
                    <span className="text-gray-900 dark:text-white font-medium">{'99.9%'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Service Plan</span>
                    <span className={clsx('px-2 py-1 rounded text-xs font-medium capitalize', getPlanColor(client.subscription_plan?.plan_code))}>
                      {client.subscription_plan?.plan_name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Last Activity</span>
                    <span className="text-gray-900 dark:text-white font-medium">{new Date(client.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg mt-auto">
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewClientDashboard(client);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
                    >
                      View Dashboard
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClientLocal(client);
                      }}
                      className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-3 py-2 rounded text-sm transition-colors"
                      title="Client Options"
                    >
                      <Cog6ToothIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No clients to display.</p>
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      {showAddClientModal && typeof window !== 'undefined' && createPortal(
        <AddClientModal />,
        document.body
      )}

      {/* Edit Client Modal */}
      {showEditModal && typeof window !== 'undefined' && createPortal(
        <EditClientModal />,
        document.body
      )}

      {/* Deactivate Client Modal */}
      {showDeactivateModal && typeof window !== 'undefined' && createPortal(
        <DeactivateClientModal />,
        document.body
      )}

      {/* Activate Client Modal */}
      {showActivateModal && typeof window !== 'undefined' && createPortal(
        <ActivateClientModal />,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && typeof window !== 'undefined' && createPortal(
        <DeleteConfirmationModal />,
        document.body
      )}
    </div>
  );
}









// 'use client';

// import { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { useClient } from '@/contexts/ClientContext';
// import { getUserFromCookies } from '@/lib/auth';
// import { organisationsApi, subscriptionPlansApi } from '@/lib/api';
// import {
//   BuildingOfficeIcon,
//   EyeIcon,
//   Cog6ToothIcon,
//   ChartBarIcon,
//   ExclamationTriangleIcon,
//   TicketIcon,
//   UserGroupIcon,
//   ClockIcon,
//   CheckCircleIcon,
//   XCircleIcon,
//   PlayIcon,
//   ShieldCheckIcon,
//   DocumentTextIcon,
//   PlusIcon,
//   TrashIcon,
//   CpuChipIcon,
//   ArrowLeftIcon
// } from '@heroicons/react/24/outline';
// import { clsx } from 'clsx';

// // Type definitions
// interface ClientInstance {
//   id: string;
//   organisation_name: string;
//   client_name: string;
//   industry: string;
//   status: 'active' | 'warning' | 'maintenance' | 'inactive';
//   contact_email: string;
//   contact_phone?: string;
//   subscription_status: string;
//   subscription_plan?: {
//     plan_name: string;
//     plan_code: string;
//   };
//   user_count: number;
//   created_at: string;
//   updated_at: string;
//   address?: {
//     city?: string;
//     country?: string;
//   };
// }

// interface SubscriptionPlan {
//   id: string;
//   plan_name: string;
// }

// export default function ClientOverview() {
//   const router = useRouter();
//   const { setSelectedClient } = useClient();
//   const [selectedClientLocal, setSelectedClientLocal] = useState<ClientInstance | null>(null);
//   const [showAddClientModal, setShowAddClientModal] = useState(false);
//   const [showDeleteModal, setShowDeleteModal] = useState(false);
//   const [clientToDelete, setClientToDelete] = useState<ClientInstance | null>(null);
//   const [clientInstances, setClientInstances] = useState<ClientInstance[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [fetchError, setFetchError] = useState<string | null>(null);

//   useEffect(() => {
//     // Check user access
//     const user = getUserFromCookies();
//     if (!user || (user.role !== 'SuperAdmin' && user.role !== 'Analyst')) {
//       router.push('/dashboard');
//       return;
//     }

//     const fetchClients = async () => {
//       setLoading(true);
//       setFetchError(null);

//       try {
//         const response = await organisationsApi.getOrganisations();

//         if (response.success && Array.isArray(response.data)) {
//           const mappedClients = response.data.map((org: any): ClientInstance => ({
//             id: org._id,
//             organisation_name: org.organisation_name,
//             client_name: org.client_name,
//             industry: org.industry || 'Technology',
//             status: org.status === 'active' ? 'active' : org.is_active ? 'active' : 'inactive',
//             contact_email: org.emails?.[0] || 'N/A',
//             contact_phone: org.phone_numbers?.[0],
//             subscription_status: org.subscription_status || 'active',
//             subscription_plan: org.subscription_plan_id ? {
//               plan_name: org.subscription_plan_id?.plan_name || 'Basic',
//               plan_code: org.subscription_plan_id?.plan_code || 'BASIC'
//             } : undefined,
//             user_count: org.current_user_count || 0,
//             created_at: org.createdAt || new Date().toISOString(),
//             updated_at: org.updatedAt || new Date().toISOString(),
//             address: org.address
//           }));

//           setClientInstances(mappedClients);
//         } else {
//           throw new Error('Invalid data format received from API.');
//         }
//       } catch (e: any) {
//         setFetchError(`Failed to fetch clients: ${e.message}`);
//         console.error('Error fetching clients:', e);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchClients();
//   }, [router]);

//   // Handle viewing a client dashboard
//   const handleViewClientDashboard = (client: ClientInstance) => {
//     // Set the selected client in context
//     setSelectedClient({
//       id: client.id,
//       name: client.client_name,
//       status: client.status === 'active' ? 'active' : 'inactive',
//       description: client.organisation_name,
//       wazuhHost: '192.168.1.100' // Default Wazuh host, can be made configurable
//     });

//     // Navigate to dashboard
//     router.push('/dashboard');
//   };

//   // Handle navigating to any client page
//   const handleClientNavigation = (path: string) => {
//     // Set the selected client in context
//     setSelectedClient({
//       id: selectedClientLocal!.id,
//       name: selectedClientLocal!.client_name,
//       status: selectedClientLocal!.status === 'active' ? 'active' : 'inactive',
//       description: selectedClientLocal!.organisation_name,
//       wazuhHost: '192.168.1.100' // Default since wazuhIp not in new schema
//     });

//     // Navigate to the specified path
//     router.push(path);
//   };

//   const totalClients = clientInstances.length;
//   const totalAlerts = clientInstances.reduce((sum, client) => sum + (client.user_count || 0), 0); // Use user_count as proxy
//   const totalAnalysts = clientInstances.reduce((sum, client) => sum + (client.user_count || 0), 0); // Use user_count
//   const avgUptime = '99.9'; // Static value since uptime not in new schema


//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case 'active': return 'text-green-500';
//       case 'warning': return 'text-yellow-500';
//       case 'maintenance': return 'text-red-500';
//       default: return 'text-gray-500';
//     }
//   };

//   const getStatusBg = (status: string) => {
//     switch (status) {
//       case 'active': return 'bg-green-500/10 border-green-500/20';
//       case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
//       case 'maintenance': return 'bg-red-500/10 border-red-500/20';
//       default: return 'bg-gray-500/10 border-gray-500/20';
//     }
//   };

//   const getPlanColor = (plan?: string) => {
//     switch (plan) {
//       case 'L1': return 'text-purple-400 bg-purple-500/10';
//       case 'L2': return 'text-blue-400 bg-blue-500/10';
//       case 'L3': return 'text-green-400 bg-green-500/10';
//       default: return 'text-gray-400 bg-gray-500/10';
//     }
//   };

//   const addClient = (newClient: Omit<ClientInstance, 'id'>) => {
//     const id = `new-${Date.now()}`; // Generate a unique string ID for new clients
//     setClientInstances([...clientInstances, { ...newClient, id }]);
//     setShowAddClientModal(false);
//   };

//   const removeClient = (clientId: string) => {
//     setClientInstances(clientInstances.filter(client => client.id !== clientId));
//     if (selectedClientLocal?.id === clientId) {
//       setSelectedClientLocal(null);
//     }
//     setShowDeleteModal(false);
//     setClientToDelete(null);
//   };

//   const handleDeleteClick = (client: ClientInstance) => {
//     setClientToDelete(client);
//     setShowDeleteModal(true);
//   };

//   const DeleteConfirmationModal = () => {
//     const [superAdminPassword, setSuperAdminPassword] = useState('');
//     const [error, setError] = useState('');

//     const handleDeleteConfirm = (e: React.FormEvent) => {
//       e.preventDefault();
//       // In a real application, this would be validated against a secure backend
//       if (superAdminPassword /* validate with backend */
//         if (clientToDelete) {
//           removeClient(clientToDelete.id);
//         }
//         setSuperAdminPassword('');
//         setError('');
//       } else {
//         setError('Invalid super admin password');
//       }
//     };

//     const handleCancel = () => {
//       setShowDeleteModal(false);
//       setClientToDelete(null);
//       setSuperAdminPassword('');
//       setError('');
//     };

//     if (!showDeleteModal || !clientToDelete) return null;

//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//         <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
//           <div className="flex items-center justify-between mb-4">
//             <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Confirm Client Deletion</h2>
//             <button
//               onClick={handleCancel}
//               className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
//             >
//               <XCircleIcon className="h-6 w-6" />
//             </button>
//           </div>
//           <div className="mb-4">
//             <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
//               <ExclamationTriangleIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
//               <div>
//                 <p className="text-red-800 dark:text-red-200 font-medium">Warning: This action cannot be undone!</p>
//                 <p className="text-red-700 dark:text-red-300 text-sm">
//                   You are about to permanently delete <strong>{clientToDelete.client_name}</strong> and all associated data.
//                 </p>
//               </div>
//             </div>
//           </div>
//           <form onSubmit={handleDeleteConfirm} className="space-y-4">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
//                 Enter Super Admin Password to Confirm:
//               </label>
//               <input
//                 type="password"
//                 required
//                 value={superAdminPassword}
//                 onChange={(e) => {
//                   setSuperAdminPassword(e.target.value);
//                   setError('');
//                 }}
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
//                 placeholder="Enter password"
//               />
//               {error && (
//                 <p className="text-red-500 text-sm mt-1">{error}</p>
//               )}
//             </div>
//             <div className="flex gap-3 pt-4">
//               <button
//                 type="button"
//                 onClick={handleCancel}
//                 className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
//               >
//                 Cancel
//               </button>
//               <button
//                 type="submit"
//                 className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
//               >
//                 Delete Client
//               </button>
//             </div>
//           </form>
//         </div>
//       </div>
//     );
//   };

//   const AddClientModal = () => {
//     const [formData, setFormData] = useState({
//       organisation_name: '',
//       client_name: '',
//       industry: 'Technology',
//       contact_email: '',
//       contact_phone: '',
//       subscription_plan_id: '',
//       address: {
//         street: '',
//         city: '',
//         state: '',
//         country: '',
//         postal_code: ''
//       }
//     });
//     const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
//     const [isSubmitting, setIsSubmitting] = useState(false);

//     useEffect(() => {
//       const fetchPlans = async () => {
//         try {
//           const response = await subscriptionPlansApi.getActivePlans();
//           if (response.success && Array.isArray(response.data)) {
//             setSubscriptionPlans(response.data);
//             if (response.data.length > 0) {
//               setFormData(prev => ({ ...prev, subscription_plan_id: response.data[0].id }));
//             }
//           }
//         } catch (error) {
//           console.error("Failed to fetch subscription plans", error);
//         }
//       };
//       if (showAddClientModal) {
//         fetchPlans();
//       }
//     }, [showAddClientModal]);

//     const handleSubmit = async (e: React.FormEvent) => {
//       e.preventDefault();
//       setIsSubmitting(true);

//       try {
//         const response = await organisationsApi.createOrganisation({
//           organisation_name: formData.organisation_name,
//           client_name: formData.client_name,
//           industry: formData.industry,
//           emails: [formData.contact_email],
//           phone_numbers: formData.contact_phone ? [formData.contact_phone] : undefined,
//           subscription_plan_id: formData.subscription_plan_id,
//           address: formData.address.city ? formData.address : undefined
//         });

//         if (response.success) {
//           // Refresh the client list
//           const updatedClients = await organisationsApi.getOrganisations();
//           if (updatedClients.success && Array.isArray(updatedClients.data)) {
//             const mappedClients = updatedClients.data.map((org: any): ClientInstance => ({
//               id: org._id,
//               organisation_name: org.organisation_name,
//               client_name: org.client_name,
//               industry: org.industry || 'Technology',
//               status: org.status === 'active' ? 'active' : org.is_active ? 'active' : 'inactive',
//               contact_email: org.emails?.[0] || 'N/A',
//               contact_phone: org.phone_numbers?.[0],
//               subscription_status: org.subscription_status || 'active',
//               subscription_plan: org.subscription_plan_id ? {
//                 plan_name: org.subscription_plan_id?.plan_name || 'Basic',
//                 plan_code: org.subscription_plan_id?.plan_code || 'BASIC'
//               } : undefined,
//               user_count: org.current_user_count || 0,
//               created_at: org.createdAt || new Date().toISOString(),
//               updated_at: org.updatedAt || new Date().toISOString(),
//               address: org.address
//             }));
//             setClientInstances(mappedClients);
//           }
//           setShowAddClientModal(false);
//           // Reset form
//           setFormData({
//             organisation_name: '',
//             client_name: '',
//             industry: 'Technology',
//             contact_email: '',
//             contact_phone: '',
//             subscription_plan_id: subscriptionPlans.length > 0 ? subscriptionPlans[0].id : '',
//             address: {
//               street: '',
//               city: '',
//               state: '',
//               country: '',
//               postal_code: ''
//             }
//           });
//         }
//       } catch (error: any) {
//         console.error('Error creating organization:', error);
//         setFetchError(`Failed to create client: ${error.message}`);
//       } finally {
//         setIsSubmitting(false);
//       }
//     };

//     if (!showAddClientModal) return null;

//     return (
//       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//         <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
//           <div className="flex items-center justify-between mb-4">
//             <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Client</h2>
//             <button
//               onClick={() => setShowAddClientModal(false)}
//               className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
//             >
//               <XCircleIcon className="h-6 w-6" />
//             </button>
//           </div>
//           <form onSubmit={handleSubmit} className="space-y-4">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Organization Name
//               </label>
//               <input
//                 type="text"
//                 required
//                 value={formData.organisation_name}
//                 onChange={(e) => setFormData({ ...formData, organisation_name: e.target.value })}
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 placeholder="e.g., Acme Corporation"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Client Name
//               </label>
//               <input
//                 type="text"
//                 required
//                 value={formData.client_name}
//                 onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 placeholder="e.g., Acme Tech"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Subscription Plan
//               </label>
//               <select
//                 required
//                 value={formData.subscription_plan_id}
//                 onChange={(e) => setFormData({ ...formData, subscription_plan_id: e.target.value })}
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               >
//                 {subscriptionPlans.map(plan => (
//                   <option key={plan.id} value={plan.id}>{plan.plan_name}</option>
//                 ))}
//               </select>
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Industry
//               </label>
//               <select
//                 value={formData.industry}
//                 onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               >
//                 <option value="Technology">Technology</option>
//                 <option value="Financial Services">Financial Services</option>
//                 <option value="Healthcare">Healthcare</option>
//                 <option value="Retail">Retail</option>
//                 <option value="Education">Education</option>
//                 <option value="Manufacturing">Manufacturing</option>
//                 <option value="Other">Other</option>
//               </select>
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Contact Email
//               </label>
//               <input
//                 type="email"
//                 required
//                 value={formData.contact_email}
//                 onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 placeholder="contact@example.com"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Contact Phone (Optional)
//               </label>
//               <input
//                 type="tel"
//                 value={formData.contact_phone}
//                 onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 placeholder="+1 (555) 123-4567"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 City (Optional)
//               </label>
//               <input
//                 type="text"
//                 value={formData.address.city}
//                 onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
//                 placeholder="New York"
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 State/Province (Optional)
//               </label>
//               <input
//                 type="text"
//                 value={formData.address.state}
//                 onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
//                 placeholder="NY"
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Country (Optional)
//               </label>
//               <input
//                 type="text"
//                 value={formData.address.country}
//                 onChange={(e) => setFormData({ ...formData, address: { ...formData.address, country: e.target.value } })}
//                 placeholder="United States"
//                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//             </div>
//             <div className="flex gap-3 pt-4">
//               <button
//                 type="button"
//                 onClick={() => setShowAddClientModal(false)}
//                 className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
//               >
//                 Cancel
//               </button>
//               <button
//                 type="submit"
//                 disabled={isSubmitting}
//                 className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//               >
//                 {isSubmitting ? 'Adding...' : 'Add Client'}
//               </button>
//             </div>
//           </form>
//         </div>
//       </div>
//     );
//   };

//   if (loading) {
//     return (
//       <div className="flex justify-center items-center h-64">
//         <p className="text-gray-500 dark:text-gray-400">Loading client data...</p>
//       </div>
//     );
//   }

//   if (selectedClientLocal) {
//     return (
//       <div className="space-y-6">
//         {/* Back Button */}
//         <button
//           onClick={() => setSelectedClientLocal(null)}
//           className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
//         >
//           <ArrowLeftIcon className="h-4 w-4" />
//           <span className="text-sm font-medium">Back to Client Overview</span>
//         </button>

//         <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
//           <div className="flex items-center justify-between">
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClientLocal.client_name}</h1>
//               <p className="text-gray-600 dark:text-gray-400">{selectedClientLocal.organisation_name} • {selectedClientLocal.industry}</p>
//             </div>
//             <div className={clsx('px-3 py-1 rounded-full text-sm font-medium border', getStatusBg(selectedClientLocal.status))}>
//               <span className={getStatusColor(selectedClientLocal.status)}>
//                 {selectedClientLocal.status.charAt(0).toUpperCase() + selectedClientLocal.status.slice(1)}
//               </span>
//             </div>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
//           <button
//             onClick={() => handleClientNavigation('/dashboard')}
//             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left shadow-sm"
//           >
//             <EyeIcon className="h-8 w-8 text-blue-500 mb-3" />
//             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">View Client Dashboard</h3>
//             <p className="text-gray-600 dark:text-gray-400 text-sm">Access real-time security operations</p>
//           </button>

//           <button
//             onClick={() => handleClientNavigation('/tickets')}
//             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors text-left shadow-sm"
//           >
//             <TicketIcon className="h-8 w-8 text-green-500 mb-3" />
//             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Manage Tickets</h3>
//             <p className="text-gray-600 dark:text-gray-400 text-sm">Review and assign security incidents</p>
//           </button>

//           <button
//             onClick={() => handleClientNavigation('/reports')}
//             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors text-left shadow-sm"
//           >
//             <ChartBarIcon className="h-8 w-8 text-purple-500 mb-3" />
//             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Analytics & Reports</h3>
//             <p className="text-gray-600 dark:text-gray-400 text-sm">Generate security insights</p>
//           </button>

//           <button
//             onClick={() => handleClientNavigation('/settings')}
//             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors text-left shadow-sm"
//           >
//             <Cog6ToothIcon className="h-8 w-8 text-yellow-500 mb-3" />
//             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Configuration</h3>
//             <p className="text-gray-600 dark:text-gray-400 text-sm">Manage client settings</p>
//           </button>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
//           <button
//             onClick={() => handleClientNavigation('/compliance')}
//             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors text-left shadow-sm"
//           >
//             <ShieldCheckIcon className="h-8 w-8 text-green-500 mb-3" />
//             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Compliance Status</h3>
//             <p className="text-gray-600 dark:text-gray-400 text-sm">View compliance frameworks and status</p>
//           </button>

//           <button
//             onClick={() => handleClientNavigation('/agents')}
//             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left shadow-sm"
//           >
//             <UserGroupIcon className="h-8 w-8 text-blue-500 mb-3" />
//             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Agent Overview</h3>
//             <p className="text-gray-600 dark:text-gray-400 text-sm">Monitor and manage security agents</p>
//           </button>

//           <button
//             onClick={() => handleClientNavigation('/alerts')}
//             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 transition-colors text-left shadow-sm"
//           >
//             <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mb-3" />
//             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Live Alerts</h3>
//             <p className="text-gray-600 dark:text-gray-400 text-sm">View real-time security alerts</p>
//           </button>

//           <button
//             onClick={() => handleClientNavigation('/siem')}
//             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors text-left shadow-sm"
//           >
//             <CpuChipIcon className="h-8 w-8 text-purple-500 mb-3" />
//             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">SIEM Portal</h3>
//             <p className="text-gray-600 dark:text-gray-400 text-sm">Access SIEM management interface</p>
//           </button>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
//           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//             <div className="flex items-center gap-3">
//               <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
//               <div>
//                 <p className="text-gray-600 dark:text-gray-400 text-sm">Active Alerts</p>
//                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClientLocal.user_count || 0}</p>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//             <div className="flex items-center gap-3">
//               <UserGroupIcon className="h-8 w-8 text-blue-500" />
//               <div>
//                 <p className="text-gray-600 dark:text-gray-400 text-sm">Analysts Online</p>
//                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClientLocal.user_count || 0}</p>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//             <div className="flex items-center gap-3">
//               <ShieldCheckIcon className="h-8 w-8 text-green-500" />
//               <div>
//                 <p className="text-gray-600 dark:text-gray-400 text-sm">Protected Endpoints</p>
//                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{5}</p>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//             <div className="flex items-center gap-3">
//               <ClockIcon className="h-8 w-8 text-purple-500" />
//               <div>
//                 <p className="text-gray-600 dark:text-gray-400 text-sm">Uptime</p>
//                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{'99.9%'}</p>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Wazuh Configuration</h3>
//             <div className="space-y-3">
//               <div className="flex justify-between">
//                 <span className="text-gray-600 dark:text-gray-400 text-sm">IP Address:</span>
//                 <span className="text-gray-900 dark:text-white font-mono text-sm">{'192.168.1.100'}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-gray-600 dark:text-gray-400 text-sm">Port:</span>
//                 <span className="text-gray-900 dark:text-white font-mono text-sm">{55000}</span>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
//             <div className="space-y-2">
//               <div className="text-sm">
//                 <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.contact_email}</span>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Details</h3>
//             <div className="space-y-3">
//               <div className="flex justify-between">
//                 <span className="text-gray-600 dark:text-gray-400 text-sm">Plan:</span>
//                 <span className={clsx('px-2 py-1 rounded text-xs font-medium capitalize', getPlanColor(selectedClientLocal.subscription_plan?.plan_name))}>
//                   {selectedClientLocal.subscription_plan?.plan_name || 'Basic'}
//                 </span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-gray-600 dark:text-gray-400 text-sm">Monthly Alerts:</span>
//                 <span className="text-gray-900 dark:text-white text-sm">{1234}</span>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Main overview component - default case
//   return (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Client Overview</h1>
//           <p className="text-gray-600 dark:text-gray-400">Monitor and manage security operations for all clients</p>
//         </div>
//         <button
//           onClick={() => setShowAddClientModal(true)}
//           className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
//         >
//           <PlusIcon className="h-5 w-5" />
//           Add Client
//         </button>
//       </div>

//       {fetchError && (
//         <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg">
//           <p><strong>Error:</strong> {fetchError + " OR THIS LOGIN USER DON'T HAVE ACCESS "}</p>
//         </div>
//       )}

//       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
//         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//           <div className="flex items-center gap-3">
//             <BuildingOfficeIcon className="h-8 w-8 text-blue-500" />
//             <div>
//               <p className="text-gray-600 dark:text-gray-400 text-sm">Total Clients</p>
//               <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalClients}</p>
//             </div>
//           </div>
//         </div>
//         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//           <div className="flex items-center gap-3">
//             <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
//             <div>
//               <p className="text-gray-600 dark:text-gray-400 text-sm">Total Active Alerts</p>
//               <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAlerts.toLocaleString()}</p>
//             </div>
//           </div>
//         </div>
//         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//           <div className="flex items-center gap-3">
//             <UserGroupIcon className="h-8 w-8 text-green-500" />
//             <div>
//               <p className="text-gray-600 dark:text-gray-400 text-sm">Active Analysts</p>
//               <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAnalysts}</p>
//             </div>
//           </div>
//         </div>
//         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
//           <div className="flex items-center gap-3">
//             <CheckCircleIcon className="h-8 w-8 text-purple-500" />
//             <div>
//               <p className="text-gray-600 dark:text-gray-400 text-sm">Average Uptime</p>
//               <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgUptime}%</p>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div>
//         <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Client Security Operations</h2>
//         {clientInstances.length > 0 ? (
//           <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
//             {clientInstances.map((client) => (
//               <div
//                 key={client.id}
//                 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer shadow-sm flex flex-col"
//                 onClick={() => setSelectedClientLocal(client)}
//               >
//                 <div className="p-6 border-b border-gray-200 dark:border-gray-700">
//                   <div className="flex items-center justify-between mb-2">
//                     <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={client.client_name}>{client.client_name}</h3>
//                     <div className="flex items-center gap-2 flex-shrink-0">
//                       <div className={clsx('px-2 py-1 rounded text-xs font-medium border capitalize', getStatusBg(client.status))}>
//                         <span className={getStatusColor(client.status)}>
//                           {client.status}
//                         </span>
//                       </div>
//                       <button
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           handleDeleteClick(client);
//                         }}
//                         className="text-gray-400 hover:text-red-500 transition-colors p-1"
//                         title="Remove client"
//                       >
//                         <TrashIcon className="h-4 w-4" />
//                       </button>
//                     </div>
//                   </div>
//                   <p className="text-gray-600 dark:text-gray-400 text-sm truncate" title={client.organisation_name}>{client.organisation_name}</p>
//                   <p className="text-gray-500 dark:text-gray-500 text-xs">{client.industry}</p>
//                 </div>

//                 <div className="p-6 space-y-4 flex-grow">
//                   <div className="flex justify-between text-sm">
//                     <span className="text-gray-600 dark:text-gray-400">Active Alerts</span>
//                     <span className="text-gray-900 dark:text-white font-medium">{client.user_count || 0}</span>
//                   </div>
//                   <div className="flex justify-between text-sm">
//                     <span className="text-gray-600 dark:text-gray-400">Analysts Online</span>
//                     <span className="text-gray-900 dark:text-white font-medium">{client.user_count || 0}</span>
//                   </div>
//                   <div className="flex justify-between text-sm">
//                     <span className="text-gray-600 dark:text-gray-400">Protected Endpoints</span>
//                     <span className="text-gray-900 dark:text-white font-medium">{(5).toLocaleString()}</span>
//                   </div>
//                   <div className="flex justify-between text-sm">
//                     <span className="text-gray-600 dark:text-gray-400">Uptime</span>
//                     <span className="text-gray-900 dark:text-white font-medium">{'99.9%'}</span>
//                   </div>
//                   <div className="flex justify-between text-sm">
//                     <span className="text-gray-600 dark:text-gray-400">Service Plan</span>
//                     <span className={clsx('px-2 py-1 rounded text-xs font-medium capitalize', getPlanColor(client.subscription_plan?.plan_code))}>
//                       {client.subscription_plan?.plan_name || 'N/A'}
//                     </span>
//                   </div>
//                   <div className="flex justify-between text-sm">
//                     <span className="text-gray-600 dark:text-gray-400">Last Activity</span>
//                     <span className="text-gray-900 dark:text-white font-medium">{new Date(client.updated_at).toLocaleDateString()}</span>
//                   </div>
//                 </div>

//                 <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg mt-auto">
//                   <div className="flex gap-2">
//                     <button
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         handleViewClientDashboard(client);
//                       }}
//                       className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
//                     >
//                       View Dashboard
//                     </button>
//                     <button
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         setSelectedClientLocal(client);
//                       }}
//                       className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-3 py-2 rounded text-sm transition-colors"
//                       title="Client Options"
//                     >
//                       <Cog6ToothIcon className="h-4 w-4" />
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         ) : (
//           <div className="text-center py-12">
//             <p className="text-gray-500 dark:text-gray-400">No clients to display.</p>
//           </div>
//         )}
//       </div>

//       <AddClientModal />
//       <DeleteConfirmationModal />
//     </div>
//   );
// }







// // 'use client';

// // import { useState, useEffect } from 'react';
// // import { useRouter } from 'next/navigation';
// // import { useClient } from '@/contexts/ClientContext';
// // import { getUserFromCookies } from '@/lib/auth';
// // import { organisationsApi } from '@/lib/api';
// // import {
// //   BuildingOfficeIcon,
// //   EyeIcon,
// //   Cog6ToothIcon,
// //   ChartBarIcon,
// //   ExclamationTriangleIcon,
// //   TicketIcon,
// //   UserGroupIcon,
// //   ClockIcon,
// //   CheckCircleIcon,
// //   XCircleIcon,
// //   PlayIcon,
// //   ShieldCheckIcon,
// //   DocumentTextIcon,
// //   PlusIcon,
// //   TrashIcon,
// //   CpuChipIcon,
// //   ArrowLeftIcon
// // } from '@heroicons/react/24/outline';
// // import { clsx } from 'clsx';

// // // Type definitions
// // interface ClientInstance {
// //   id: string;
// //   organisation_name: string;
// //   client_name: string;
// //   industry: string;
// //   status: 'active' | 'warning' | 'maintenance' | 'inactive';
// //   contact_email: string;
// //   contact_phone?: string;
// //   subscription_status: string;
// //   subscription_plan?: {
// //     plan_name: string;
// //     plan_code: string;
// //   };
// //   user_count: number;
// //   created_at: string;
// //   updated_at: string;
// //   address?: {
// //     city?: string;
// //     country?: string;
// //   };
// // }

// // export default function ClientOverview() {
// //   const router = useRouter();
// //   const { setSelectedClient } = useClient();
// //   const [selectedClientLocal, setSelectedClientLocal] = useState<ClientInstance | null>(null);
// //   const [showAddClientModal, setShowAddClientModal] = useState(false);
// //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// //   const [clientToDelete, setClientToDelete] = useState<ClientInstance | null>(null);
// //   const [clientInstances, setClientInstances] = useState<ClientInstance[]>([]);
// //   const [loading, setLoading] = useState(true);
// //   const [fetchError, setFetchError] = useState<string | null>(null);

// //   useEffect(() => {
// //     // Check user access
// //     const user = getUserFromCookies();
// //     if (!user || (user.role !== 'SuperAdmin' && user.role !== 'Analyst')) {
// //       router.push('/dashboard');
// //       return;
// //     }

// //     const fetchClients = async () => {
// //       setLoading(true);
// //       setFetchError(null);

// //       try {
// //         const response = await organisationsApi.getOrganisations();
        
// //         if (response.success && Array.isArray(response.data)) {
// //           const mappedClients = response.data.map((org: any): ClientInstance => ({
// //             id: org._id,
// //             organisation_name: org.organisation_name,
// //             client_name: org.client_name,
// //             industry: org.industry || 'Technology',
// //             status: org.status === 'active' ? 'active' : org.is_active ? 'active' : 'inactive',
// //             contact_email: org.contact_email,
// //             contact_phone: org.contact_phone,
// //             subscription_status: org.subscription_status || 'active',
// //             subscription_plan: org.subscription_plan_id ? {
// //               plan_name: org.subscription_plan?.plan_name || 'Basic',
// //               plan_code: org.subscription_plan?.plan_code || 'BASIC'
// //             } : undefined,
// //             user_count: org.user_count || 0,
// //             created_at: org.createdAt || new Date().toISOString(),
// //             updated_at: org.updatedAt || new Date().toISOString(),
// //             address: org.address
// //           }));
          
// //           setClientInstances(mappedClients);
// //         } else {
// //           throw new Error('Invalid data format received from API.');
// //         }
// //       } catch (e: any) {
// //         setFetchError(`Failed to fetch clients: ${e.message}`);
// //         console.error('Error fetching clients:', e);
// //       } finally {
// //         setLoading(false);
// //       }
// //     };

// //     fetchClients();
// //   }, [router]);

// //   // Handle viewing a client dashboard
// //   const handleViewClientDashboard = (client: ClientInstance) => {
// //     // Set the selected client in context
// //     setSelectedClient({
// //       id: client.id,
// //       name: client.client_name,
// //       status: client.status === 'active' ? 'active' : 'inactive',
// //       description: client.organisation_name,
// //       wazuhHost: '192.168.1.100' // Default Wazuh host, can be made configurable
// //     });
    
// //     // Navigate to dashboard
// //     router.push('/dashboard');
// //   };

// //   // Handle navigating to any client page
// //   const handleClientNavigation = (path: string) => {
// //     // Set the selected client in context
// //     setSelectedClient({
// //       id: selectedClientLocal!.id,
// //       name: selectedClientLocal!.client_name,
// //       status: selectedClientLocal!.status === 'active' ? 'active' : 'inactive',
// //       description: selectedClientLocal!.organisation_name,
// //       wazuhHost: '192.168.1.100' // Default since wazuhIp not in new schema
// //     });
    
// //     // Navigate to the specified path
// //     router.push(path);
// //   };

// //   const totalClients = clientInstances.length;
// //   const totalAlerts = clientInstances.reduce((sum, client) => sum + (client.user_count || 0), 0); // Use user_count as proxy
// //   const totalAnalysts = clientInstances.reduce((sum, client) => sum + (client.user_count || 0), 0); // Use user_count
// //   const avgUptime = '99.9'; // Static value since uptime not in new schema


// //   const getStatusColor = (status: string) => {
// //     switch (status) {
// //       case 'active': return 'text-green-500';
// //       case 'warning': return 'text-yellow-500';
// //       case 'maintenance': return 'text-red-500';
// //       default: return 'text-gray-500';
// //     }
// //   };

// //   const getStatusBg = (status: string) => {
// //     switch (status) {
// //       case 'active': return 'bg-green-500/10 border-green-500/20';
// //       case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
// //       case 'maintenance': return 'bg-red-500/10 border-red-500/20';
// //       default: return 'bg-gray-500/10 border-gray-500/20';
// //     }
// //   };

// //   const getPlanColor = (plan: string) => {
// //     switch (plan) {
// //       case 'L1': return 'text-purple-400 bg-purple-500/10';
// //       case 'L2': return 'text-blue-400 bg-blue-500/10';
// //       case 'L3': return 'text-green-400 bg-green-500/10';
// //       default: return 'text-gray-400 bg-gray-500/10';
// //     }
// //   };

// //   const addClient = (newClient: Omit<ClientInstance, 'id'>) => {
// //     const id = `new-${Date.now()}`; // Generate a unique string ID for new clients
// //     setClientInstances([...clientInstances, { ...newClient, id }]);
// //     setShowAddClientModal(false);
// //   };

// //   const removeClient = (clientId: string) => {
// //     setClientInstances(clientInstances.filter(client => client.id !== clientId));
// //     if (selectedClientLocal?.id === clientId) {
// //       setSelectedClientLocal(null);
// //     }
// //     setShowDeleteModal(false);
// //     setClientToDelete(null);
// //   };

// //   const handleDeleteClick = (client: ClientInstance) => {
// //     setClientToDelete(client);
// //     setShowDeleteModal(true);
// //   };

// //   const DeleteConfirmationModal = () => {
// //     const [superAdminPassword, setSuperAdminPassword] = useState('');
// //     const [error, setError] = useState('');

// //     const handleDeleteConfirm = (e: React.FormEvent) => {
// //       e.preventDefault();
// //       // In a real application, this would be validated against a secure backend
// //       if (superAdminPassword /* validate with backend */
// //         if (clientToDelete) {
// //           removeClient(clientToDelete.id);
// //         }
// //         setSuperAdminPassword('');
// //         setError('');
// //       } else {
// //         setError('Invalid super admin password');
// //       }
// //     };

// //     const handleCancel = () => {
// //       setShowDeleteModal(false);
// //       setClientToDelete(null);
// //       setSuperAdminPassword('');
// //       setError('');
// //     };

// //     if (!showDeleteModal || !clientToDelete) return null;

// //     return (
// //       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
// //         <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
// //           <div className="flex items-center justify-between mb-4">
// //             <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Confirm Client Deletion</h2>
// //             <button
// //               onClick={handleCancel}
// //               className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
// //             >
// //               <XCircleIcon className="h-6 w-6" />
// //             </button>
// //           </div>
// //           <div className="mb-4">
// //             <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
// //               <ExclamationTriangleIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
// //               <div>
// //                 <p className="text-red-800 dark:text-red-200 font-medium">Warning: This action cannot be undone!</p>
// //                 <p className="text-red-700 dark:text-red-300 text-sm">
// //                   You are about to permanently delete <strong>{clientToDelete.client_name}</strong> and all associated data.
// //                 </p>
// //               </div>
// //             </div>
// //           </div>
// //           <form onSubmit={handleDeleteConfirm} className="space-y-4">
// //             <div>
// //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
// //                 Enter Super Admin Password to Confirm:
// //               </label>
// //               <input
// //                 type="password"
// //                 required
// //                 value={superAdminPassword}
// //                 onChange={(e) => {
// //                   setSuperAdminPassword(e.target.value);
// //                   setError('');
// //                 }}
// //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
// //                 placeholder="Enter password"
// //               />
// //               {error && (
// //                 <p className="text-red-500 text-sm mt-1">{error}</p>
// //               )}
// //             </div>
// //             <div className="flex gap-3 pt-4">
// //               <button
// //                 type="button"
// //                 onClick={handleCancel}
// //                 className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 type="submit"
// //                 className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
// //               >
// //                 Delete Client
// //               </button>
// //             </div>
// //           </form>
// //         </div>
// //       </div>
// //     );
// //   };

// //   const AddClientModal = () => {
// //     const [formData, setFormData] = useState({
// //       organisation_name: '',
// //       client_name: '',
// //       industry: 'Technology',
// //       contact_email: '',
// //       contact_phone: '',
// //       address: {
// //         street: '',
// //         city: '',
// //         state: '',
// //         country: '',
// //         postal_code: ''
// //       }
// //     });
// //     const [isSubmitting, setIsSubmitting] = useState(false);

// //     const handleSubmit = async (e: React.FormEvent) => {
// //       e.preventDefault();
// //       setIsSubmitting(true);
      
// //       try {
// //         const response = await organisationsApi.createOrganisation({
// //           organisation_name: formData.organisation_name,
// //           client_name: formData.client_name,
// //           industry: formData.industry,
// //           contact_email: formData.contact_email,
// //           contact_phone: formData.contact_phone || undefined,
// //           address: formData.address.city ? formData.address : undefined
// //         });

// //         if (response.success) {
// //           // Refresh the client list
// //           const updatedClients = await organisationsApi.getOrganisations();
// //           if (updatedClients.success && Array.isArray(updatedClients.data)) {
// //             const mappedClients = updatedClients.data.map((org: any): ClientInstance => ({
// //               id: org._id,
// //               organisation_name: org.organisation_name,
// //               client_name: org.client_name,
// //               industry: org.industry || 'Technology',
// //               status: org.status === 'active' ? 'active' : org.is_active ? 'active' : 'inactive',
// //               contact_email: org.contact_email,
// //               contact_phone: org.contact_phone,
// //               subscription_status: org.subscription_status || 'active',
// //               subscription_plan: org.subscription_plan_id ? {
// //                 plan_name: org.subscription_plan?.plan_name || 'Basic',
// //                 plan_code: org.subscription_plan?.plan_code || 'BASIC'
// //               } : undefined,
// //               user_count: org.user_count || 0,
// //               created_at: org.createdAt || new Date().toISOString(),
// //               updated_at: org.updatedAt || new Date().toISOString(),
// //               address: org.address
// //             }));
// //             setClientInstances(mappedClients);
// //           }
// //           setShowAddClientModal(false);
// //           // Reset form
// //           setFormData({
// //             organisation_name: '',
// //             client_name: '',
// //             industry: 'Technology',
// //             contact_email: '',
// //             contact_phone: '',
// //             address: {
// //               street: '',
// //               city: '',
// //               state: '',
// //               country: '',
// //               postal_code: ''
// //             }
// //           });
// //         }
// //       } catch (error: any) {
// //         console.error('Error creating organization:', error);
// //         setFetchError(`Failed to create client: ${error.message}`);
// //       } finally {
// //         setIsSubmitting(false);
// //       }
// //     };

// //     if (!showAddClientModal) return null;

// //     return (
// //       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
// //         <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
// //           <div className="flex items-center justify-between mb-4">
// //             <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Client</h2>
// //             <button
// //               onClick={() => setShowAddClientModal(false)}
// //               className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
// //             >
// //               <XCircleIcon className="h-6 w-6" />
// //             </button>
// //           </div>
// //           <form onSubmit={handleSubmit} className="space-y-4">
// //             <div>
// //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// //                 Organization Name
// //               </label>
// //               <input
// //                 type="text"
// //                 required
// //                 value={formData.organisation_name}
// //                 onChange={(e) => setFormData({ ...formData, organisation_name: e.target.value })}
// //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// //                 placeholder="e.g., Acme Corporation"
// //               />
// //             </div>
// //             <div>
// //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// //                 Client Name
// //               </label>
// //               <input
// //                 type="text"
// //                 required
// //                 value={formData.client_name}
// //                 onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
// //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// //                 placeholder="e.g., Acme Tech"
// //               />
// //             </div>
// //             <div>
// //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// //                 Industry
// //               </label>
// //               <select
// //                 value={formData.industry}
// //                 onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
// //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// //               >
// //                 <option value="Technology">Technology</option>
// //                 <option value="Financial Services">Financial Services</option>
// //                 <option value="Healthcare">Healthcare</option>
// //                 <option value="Retail">Retail</option>
// //                 <option value="Education">Education</option>
// //                 <option value="Manufacturing">Manufacturing</option>
// //                 <option value="Other">Other</option>
// //               </select>
// //             </div>
// //             <div>
// //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// //                 Contact Email
// //               </label>
// //               <input
// //                 type="email"
// //                 required
// //                 value={formData.contact_email}
// //                 onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
// //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// //                 placeholder="contact@example.com"
// //               />
// //             </div>
// //             <div>
// //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// //                 Contact Phone (Optional)
// //               </label>
// //               <input
// //                 type="tel"
// //                 value={formData.contact_phone}
// //                 onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
// //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// //                 placeholder="+1 (555) 123-4567"
// //               />
// //             </div>
// //             <div>
// //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// //                 City (Optional)
// //               </label>
// //               <input
// //                 type="text"
// //                 value={formData.address.city}
// //                 onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
// //                 placeholder="New York"
// //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// //               />
// //             </div>
// //             <div>
// //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// //                 State/Province (Optional)
// //               </label>
// //               <input
// //                 type="text"
// //                 value={formData.address.state}
// //                 onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
// //                 placeholder="NY"
// //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// //               />
// //             </div>
// //             <div>
// //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// //                 Country (Optional)
// //               </label>
// //               <input
// //                 type="text"
// //                 value={formData.address.country}
// //                 onChange={(e) => setFormData({ ...formData, address: { ...formData.address, country: e.target.value } })}
// //                 placeholder="United States"
// //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// //               />
// //             </div>
// //             <div className="flex gap-3 pt-4">
// //               <button
// //                 type="button"
// //                 onClick={() => setShowAddClientModal(false)}
// //                 className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 type="submit"
// //                 disabled={isSubmitting}
// //                 className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
// //               >
// //                 {isSubmitting ? 'Adding...' : 'Add Client'}
// //               </button>
// //             </div>
// //           </form>
// //         </div>
// //       </div>
// //     );
// //   };

// //   if (loading) {
// //     return (
// //       <div className="flex justify-center items-center h-64">
// //         <p className="text-gray-500 dark:text-gray-400">Loading client data...</p>
// //       </div>
// //     );
// //   }

// //   if (selectedClientLocal) {
// //     return (
// //       <div className="space-y-6">
// //         {/* Back Button */}
// //         <button
// //           onClick={() => setSelectedClientLocal(null)}
// //           className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
// //         >
// //           <ArrowLeftIcon className="h-4 w-4" />
// //           <span className="text-sm font-medium">Back to Client Overview</span>
// //         </button>

// //         <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
// //           <div className="flex items-center justify-between">
// //             <div>
// //               <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClientLocal.client_name}</h1>
// //               <p className="text-gray-600 dark:text-gray-400">{selectedClientLocal.organisation_name} • {selectedClientLocal.industry}</p>
// //             </div>
// //             <div className={clsx('px-3 py-1 rounded-full text-sm font-medium border', getStatusBg(selectedClientLocal.status))}>
// //               <span className={getStatusColor(selectedClientLocal.status)}>
// //                 {selectedClientLocal.status.charAt(0).toUpperCase() + selectedClientLocal.status.slice(1)}
// //               </span>
// //             </div>
// //           </div>
// //         </div>

// //         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
// //           <button 
// //             onClick={() => handleClientNavigation('/dashboard')}
// //             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left shadow-sm"
// //           >
// //             <EyeIcon className="h-8 w-8 text-blue-500 mb-3" />
// //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">View Client Dashboard</h3>
// //             <p className="text-gray-600 dark:text-gray-400 text-sm">Access real-time security operations</p>
// //           </button>

// //           <button 
// //             onClick={() => handleClientNavigation('/tickets')}
// //             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors text-left shadow-sm"
// //           >
// //             <TicketIcon className="h-8 w-8 text-green-500 mb-3" />
// //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Manage Tickets</h3>
// //             <p className="text-gray-600 dark:text-gray-400 text-sm">Review and assign security incidents</p>
// //           </button>

// //           <button 
// //             onClick={() => handleClientNavigation('/reports')}
// //             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors text-left shadow-sm"
// //           >
// //             <ChartBarIcon className="h-8 w-8 text-purple-500 mb-3" />
// //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Analytics & Reports</h3>
// //             <p className="text-gray-600 dark:text-gray-400 text-sm">Generate security insights</p>
// //           </button>

// //           <button 
// //             onClick={() => handleClientNavigation('/settings')}
// //             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors text-left shadow-sm"
// //           >
// //             <Cog6ToothIcon className="h-8 w-8 text-yellow-500 mb-3" />
// //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Configuration</h3>
// //             <p className="text-gray-600 dark:text-gray-400 text-sm">Manage client settings</p>
// //           </button>
// //         </div>

// //         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
// //           <button 
// //             onClick={() => handleClientNavigation('/compliance')}
// //             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors text-left shadow-sm"
// //           >
// //             <ShieldCheckIcon className="h-8 w-8 text-green-500 mb-3" />
// //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Compliance Status</h3>
// //             <p className="text-gray-600 dark:text-gray-400 text-sm">View compliance frameworks and status</p>
// //           </button>

// //           <button 
// //             onClick={() => handleClientNavigation('/agents')}
// //             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left shadow-sm"
// //           >
// //             <UserGroupIcon className="h-8 w-8 text-blue-500 mb-3" />
// //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Agent Overview</h3>
// //             <p className="text-gray-600 dark:text-gray-400 text-sm">Monitor and manage security agents</p>
// //           </button>

// //           <button 
// //             onClick={() => handleClientNavigation('/alerts')}
// //             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 transition-colors text-left shadow-sm"
// //           >
// //             <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mb-3" />
// //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Live Alerts</h3>
// //             <p className="text-gray-600 dark:text-gray-400 text-sm">View real-time security alerts</p>
// //           </button>

// //           <button 
// //             onClick={() => handleClientNavigation('/siem')}
// //             className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors text-left shadow-sm"
// //           >
// //             <CpuChipIcon className="h-8 w-8 text-purple-500 mb-3" />
// //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">SIEM Portal</h3>
// //             <p className="text-gray-600 dark:text-gray-400 text-sm">Access SIEM management interface</p>
// //           </button>
// //         </div>

// //         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
// //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //             <div className="flex items-center gap-3">
// //               <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
// //               <div>
// //                 <p className="text-gray-600 dark:text-gray-400 text-sm">Active Alerts</p>
// //                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClientLocal.user_count || 0}</p>
// //               </div>
// //             </div>
// //           </div>

// //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //             <div className="flex items-center gap-3">
// //               <UserGroupIcon className="h-8 w-8 text-blue-500" />
// //               <div>
// //                 <p className="text-gray-600 dark:text-gray-400 text-sm">Analysts Online</p>
// //                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClientLocal.user_count || 0}</p>
// //               </div>
// //             </div>
// //           </div>

// //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //             <div className="flex items-center gap-3">
// //               <ShieldCheckIcon className="h-8 w-8 text-green-500" />
// //               <div>
// //                 <p className="text-gray-600 dark:text-gray-400 text-sm">Protected Endpoints</p>
// //                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{5}</p>
// //               </div>
// //             </div>
// //           </div>

// //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //             <div className="flex items-center gap-3">
// //               <ClockIcon className="h-8 w-8 text-purple-500" />
// //               <div>
// //                 <p className="text-gray-600 dark:text-gray-400 text-sm">Uptime</p>
// //                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{'99.9%'}</p>
// //               </div>
// //             </div>
// //           </div>
// //         </div>

// //         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
// //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Wazuh Configuration</h3>
// //             <div className="space-y-3">
// //               <div className="flex justify-between">
// //                 <span className="text-gray-600 dark:text-gray-400 text-sm">IP Address:</span>
// //                 <span className="text-gray-900 dark:text-white font-mono text-sm">{'192.168.1.100'}</span>
// //               </div>
// //               <div className="flex justify-between">
// //                 <span className="text-gray-600 dark:text-gray-400 text-sm">Port:</span>
// //                 <span className="text-gray-900 dark:text-white font-mono text-sm">{55000}</span>
// //               </div>
// //             </div>
// //           </div>

// //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
// //             <div className="space-y-2">
// //               <div className="text-sm">
// //                 <span className="text-gray-900 dark:text-white font-mono">{selectedClientLocal.contact_email}</span>
// //               </div>
// //             </div>
// //           </div>

// //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Details</h3>
// //             <div className="space-y-3">
// //               <div className="flex justify-between">
// //                 <span className="text-gray-600 dark:text-gray-400 text-sm">Plan:</span>
// //                 <span className={clsx('px-2 py-1 rounded text-xs font-medium capitalize', getPlanColor(selectedClientLocal.subscription_plan?.plan_name || 'Basic'))}>
// //                   {selectedClientLocal.subscription_plan?.plan_name || 'Basic'}
// //                 </span>
// //               </div>
// //               <div className="flex justify-between">
// //                 <span className="text-gray-600 dark:text-gray-400 text-sm">Monthly Alerts:</span>
// //                 <span className="text-gray-900 dark:text-white text-sm">{1234}</span>
// //               </div>
// //             </div>
// //           </div>
// //         </div>
// //       </div>
// //     );
// //   }

// //   // Main overview component - default case
// //   return (
// //     <div className="space-y-6">
// //       <div className="flex items-center justify-between">
// //         <div>
// //           <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Client Overview</h1>
// //           <p className="text-gray-600 dark:text-gray-400">Monitor and manage security operations for all clients</p>
// //         </div>
// //         <button
// //           onClick={() => setShowAddClientModal(true)}
// //           className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
// //         >
// //           <PlusIcon className="h-5 w-5" />
// //           Add Client
// //         </button>
// //       </div>

// //       {fetchError && (
// //         <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg">
// //           <p><strong>Error:</strong> {fetchError + " OR THIS LOGIN USER DON'T HAVE ACCESS "}</p>
// //         </div>
// //       )}

// //       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
// //         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //           <div className="flex items-center gap-3">
// //             <BuildingOfficeIcon className="h-8 w-8 text-blue-500" />
// //             <div>
// //               <p className="text-gray-600 dark:text-gray-400 text-sm">Total Clients</p>
// //               <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalClients}</p>
// //             </div>
// //           </div>
// //         </div>
// //         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //           <div className="flex items-center gap-3">
// //             <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
// //             <div>
// //               <p className="text-gray-600 dark:text-gray-400 text-sm">Total Active Alerts</p>
// //               <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAlerts.toLocaleString()}</p>
// //             </div>
// //           </div>
// //         </div>
// //         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //           <div className="flex items-center gap-3">
// //             <UserGroupIcon className="h-8 w-8 text-green-500" />
// //             <div>
// //               <p className="text-gray-600 dark:text-gray-400 text-sm">Active Analysts</p>
// //               <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAnalysts}</p>
// //             </div>
// //           </div>
// //         </div>
// //         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// //           <div className="flex items-center gap-3">
// //             <CheckCircleIcon className="h-8 w-8 text-purple-500" />
// //             <div>
// //               <p className="text-gray-600 dark:text-gray-400 text-sm">Average Uptime</p>
// //               <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgUptime}%</p>
// //             </div>
// //           </div>
// //         </div>
// //       </div>

// //       <div>
// //         <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Client Security Operations</h2>
// //         {clientInstances.length > 0 ? (
// //           <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
// //             {clientInstances.map((client) => (
// //               <div
// //                 key={client.id}
// //                 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer shadow-sm flex flex-col"
// //                 onClick={() => setSelectedClientLocal(client)}
// //               >
// //                 <div className="p-6 border-b border-gray-200 dark:border-gray-700">
// //                   <div className="flex items-center justify-between mb-2">
// //                     <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={client.client_name}>{client.client_name}</h3>
// //                     <div className="flex items-center gap-2 flex-shrink-0">
// //                       <div className={clsx('px-2 py-1 rounded text-xs font-medium border capitalize', getStatusBg(client.status))}>
// //                         <span className={getStatusColor(client.status)}>
// //                           {client.status}
// //                         </span>
// //                       </div>
// //                       <button
// //                         onClick={(e) => {
// //                           e.stopPropagation();
// //                           handleDeleteClick(client);
// //                         }}
// //                         className="text-gray-400 hover:text-red-500 transition-colors p-1"
// //                         title="Remove client"
// //                       >
// //                         <TrashIcon className="h-4 w-4" />
// //                       </button>
// //                     </div>
// //                   </div>
// //                   <p className="text-gray-600 dark:text-gray-400 text-sm truncate" title={client.organisation_name}>{client.organisation_name}</p>
// //                   <p className="text-gray-500 dark:text-gray-500 text-xs">{client.industry}</p>
// //                 </div>

// //                 <div className="p-6 space-y-4 flex-grow">
// //                   <div className="flex justify-between text-sm">
// //                     <span className="text-gray-600 dark:text-gray-400">Active Alerts</span>
// //                     <span className="text-gray-900 dark:text-white font-medium">{client.user_count || 0}</span>
// //                   </div>
// //                   <div className="flex justify-between text-sm">
// //                     <span className="text-gray-600 dark:text-gray-400">Analysts Online</span>
// //                     <span className="text-gray-900 dark:text-white font-medium">{client.user_count || 0}</span>
// //                   </div>
// //                   <div className="flex justify-between text-sm">
// //                     <span className="text-gray-600 dark:text-gray-400">Protected Endpoints</span>
// //                     <span className="text-gray-900 dark:text-white font-medium">{(5).toLocaleString()}</span>
// //                   </div>
// //                   <div className="flex justify-between text-sm">
// //                     <span className="text-gray-600 dark:text-gray-400">Uptime</span>
// //                     <span className="text-gray-900 dark:text-white font-medium">{'99.9%'}</span>
// //                   </div>
// //                   <div className="flex justify-between text-sm">
// //                     <span className="text-gray-600 dark:text-gray-400">Service Plan</span>
// //                     <span className={clsx('px-2 py-1 rounded text-xs font-medium capitalize', getPlanColor(client.level))}>
// //                       {client.level}
// //                     </span>
// //                   </div>
// //                   <div className="flex justify-between text-sm">
// //                     <span className="text-gray-600 dark:text-gray-400">Last Activity</span>
// //                     <span className="text-gray-900 dark:text-white font-medium">{client.lastActivity}</span>
// //                   </div>
// //                 </div>

// //                 <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg mt-auto">
// //                   <div className="flex gap-2">
// //                     <button 
// //                       onClick={(e) => {
// //                         e.stopPropagation();
// //                         handleViewClientDashboard(client);
// //                       }}
// //                       className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
// //                     >
// //                       View Dashboard
// //                     </button>
// //                     <button 
// //                       onClick={(e) => {
// //                         e.stopPropagation();
// //                         setSelectedClientLocal(client);
// //                       }}
// //                       className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-3 py-2 rounded text-sm transition-colors"
// //                       title="Client Options"
// //                     >
// //                       <Cog6ToothIcon className="h-4 w-4" />
// //                     </button>
// //                   </div>
// //                 </div>
// //               </div>
// //             ))}
// //           </div>
// //         ) : (
// //           <div className="text-center py-12">
// //             <p className="text-gray-500 dark:text-gray-400">No clients to display.</p>
// //           </div>
// //         )}
// //       </div>

// //       <AddClientModal />
// //       <DeleteConfirmationModal />
// //     </div>
// //   );
// // }




// // // 'use client';

// // // import { useState } from 'react';
// // // import {
// // //   BuildingOfficeIcon,
// // //   EyeIcon,
// // //   Cog6ToothIcon,
// // //   ChartBarIcon,
// // //   ExclamationTriangleIcon,
// // //   TicketIcon,
// // //   UserGroupIcon,
// // //   ClockIcon,
// // //   CheckCircleIcon,
// // //   XCircleIcon,
// // //   PlayIcon,
// // //   ShieldCheckIcon,
// // //   DocumentTextIcon,
// // //   PlusIcon,
// // //   TrashIcon
// // // } from '@heroicons/react/24/outline';
// // // import { clsx } from 'clsx';

// // // // Type definitions
// // // interface ClientInstance {
// // //   id: number;
// // //   clientName: string;
// // //   organization: string;
// // //   industry: string;
// // //   status: 'active' | 'warning' | 'maintenance';
// // //   alerts: number;
// // //   analysts: number;
// // //   lastActivity: string;
// // //   uptime: string;
// // //   plan: 'starter' | 'professional' | 'enterprise';
// // //   endpoints: number;
// // //   monthlyAlerts: number;
// // //   wazuhIp: string;
// // //   wazuhPort: number;
// // //   clientEmails: string[];
// // // }

// // // export default function ClientOverview() {
// // //   const [selectedClient, setSelectedClient] = useState<ClientInstance | null>(null);
// // //   const [showAddClientModal, setShowAddClientModal] = useState(false);
// // //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// // //   const [clientToDelete, setClientToDelete] = useState<ClientInstance | null>(null);
// // //   const [clientInstances, setClientInstances] = useState<ClientInstance[]>([
// // //     {
// // //       id: 1,
// // //       clientName: "TechCorp Solutions",
// // //       organization: "TechCorp Inc.",
// // //       industry: "Technology",
// // //       status: "active",
// // //       alerts: 347,
// // //       analysts: 2,
// // //       lastActivity: "2 minutes ago",
// // //       uptime: "99.8%",
// // //       plan: "enterprise",
// // //       endpoints: 1250,
// // //       monthlyAlerts: 8420,
// // //       wazuhIp: "192.168.1.100",
// // //       wazuhPort: 1514,
// // //       clientEmails: ["admin@techcorp.com", "security@techcorp.com"]
// // //     },
// // //     {
// // //       id: 2,
// // //       clientName: "FinanceSecure",
// // //       organization: "Global Finance Corp",
// // //       industry: "Financial Services",
// // //       status: "active",
// // //       alerts: 189,
// // //       analysts: 3,
// // //       lastActivity: "5 minutes ago",
// // //       uptime: "99.9%",
// // //       plan: "professional",
// // //       endpoints: 890,
// // //       monthlyAlerts: 5230,
// // //       wazuhIp: "10.0.1.50",
// // //       wazuhPort: 1515,
// // //       clientEmails: ["ops@globalfinance.com", "security-team@globalfinance.com"]
// // //     },
// // //     {
// // //       id: 3,
// // //       clientName: "HealthGuard Systems",
// // //       organization: "MedTech Healthcare",
// // //       industry: "Healthcare",
// // //       status: "warning",
// // //       alerts: 456,
// // //       analysts: 1,
// // //       lastActivity: "1 minute ago",
// // //       uptime: "98.2%",
// // //       plan: "enterprise",
// // //       endpoints: 2100,
// // //       monthlyAlerts: 12890,
// // //       wazuhIp: "172.16.2.80",
// // //       wazuhPort: 1514,
// // //       clientEmails: ["it@medtech.com", "compliance@medtech.com", "security@medtech.com"]
// // //     },
// // //     {
// // //       id: 4,
// // //       clientName: "RetailWatch",
// // //       organization: "Global Retail Chain",
// // //       industry: "Retail",
// // //       status: "active",
// // //       alerts: 123,
// // //       analysts: 2,
// // //       lastActivity: "8 minutes ago",
// // //       uptime: "99.5%",
// // //       plan: "professional",
// // //       endpoints: 670,
// // //       monthlyAlerts: 3450,
// // //       wazuhIp: "192.168.10.25",
// // //       wazuhPort: 1514,
// // //       clientEmails: ["sysadmin@retailchain.com", "security@retailchain.com"]
// // //     },
// // //     {
// // //       id: 5,
// // //       clientName: "EduSecure",
// // //       organization: "University Network",
// // //       industry: "Education",
// // //       status: "maintenance",
// // //       alerts: 67,
// // //       analysts: 1,
// // //       lastActivity: "15 minutes ago",
// // //       uptime: "97.8%",
// // //       plan: "starter",
// // //       endpoints: 320,
// // //       monthlyAlerts: 1890,
// // //       wazuhIp: "10.1.0.15",
// // //       wazuhPort: 1516,
// // //       clientEmails: ["admin@university.edu"]
// // //     }
// // //   ]);

// // //   const totalClients = clientInstances.length;
// // //   const totalAlerts = clientInstances.reduce((sum, client) => sum + client.user_count || 0, 0);
// // //   const totalAnalysts = clientInstances.reduce((sum, client) => sum + client.user_count || 0, 0);
// // //   const avgUptime = (clientInstances.reduce((sum, client) => sum + parseFloat('99.9%'), 0) / clientInstances.length).toFixed(1);

// // //   const getStatusColor = (status: string) => {
// // //     switch (status) {
// // //       case 'active': return 'text-green-500';
// // //       case 'warning': return 'text-yellow-500';
// // //       case 'maintenance': return 'text-red-500';
// // //       default: return 'text-gray-500';
// // //     }
// // //   };

// // //   const getStatusBg = (status: string) => {
// // //     switch (status) {
// // //       case 'active': return 'bg-green-500/10 border-green-500/20';
// // //       case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
// // //       case 'maintenance': return 'bg-red-500/10 border-red-500/20';
// // //       default: return 'bg-gray-500/10 border-gray-500/20';
// // //     }
// // //   };

// // //   const getPlanColor = (plan: string) => {
// // //     switch (plan) {
// // //       case 'enterprise': return 'text-purple-400 bg-purple-500/10';
// // //       case 'professional': return 'text-blue-400 bg-blue-500/10';
// // //       case 'starter': return 'text-green-400 bg-green-500/10';
// // //       default: return 'text-gray-400 bg-gray-500/10';
// // //     }
// // //   };

// // //   const addClient = (newClient: Omit<ClientInstance, 'id'>) => {
// // //     const id = Math.max(...clientInstances.map(c => c.id)) + 1;
// // //     setClientInstances([...clientInstances, { ...newClient, id }]);
// // //     setShowAddClientModal(false);
// // //   };

// // //   const removeClient = (clientId: number) => {
// // //     setClientInstances(clientInstances.filter(client => client.id !== clientId));
// // //     if (selectedClient?.id === clientId) {
// // //       setSelectedClient(null);
// // //     }
// // //     setShowDeleteModal(false);
// // //     setClientToDelete(null);
// // //   };

// // //   const handleDeleteClick = (client: ClientInstance) => {
// // //     setClientToDelete(client);
// // //     setShowDeleteModal(true);
// // //   };

// // //   const DeleteConfirmationModal = () => {
// // //     const [superAdminPassword, setSuperAdminPassword] = useState('');
// // //     const [error, setError] = useState('');

// // //     const handleDeleteConfirm = (e: React.FormEvent) => {
// // //       e.preventDefault();
// // //       // In a real application, this would be validated against a secure backend
// // //       if (superAdminPassword /* validate with backend */
// // //         if (clientToDelete) {
// // //           removeClient(clientToDelete.id);
// // //         }
// // //         setSuperAdminPassword('');
// // //         setError('');
// // //       } else {
// // //         setError('Invalid super admin password');
// // //       }
// // //     };

// // //     const handleCancel = () => {
// // //       setShowDeleteModal(false);
// // //       setClientToDelete(null);
// // //       setSuperAdminPassword('');
// // //       setError('');
// // //     };

// // //     if (!showDeleteModal || !clientToDelete) return null;

// // //     return (
// // //       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
// // //         <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
// // //           <div className="flex items-center justify-between mb-4">
// // //             <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Confirm Client Deletion</h2>
// // //             <button
// // //               onClick={handleCancel}
// // //               className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
// // //             >
// // //               <XCircleIcon className="h-6 w-6" />
// // //             </button>
// // //           </div>
// // //           <div className="mb-4">
// // //             <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
// // //               <ExclamationTriangleIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
// // //               <div>
// // //                 <p className="text-red-800 dark:text-red-200 font-medium">Warning: This action cannot be undone!</p>
// // //                 <p className="text-red-700 dark:text-red-300 text-sm">
// // //                   You are about to permanently delete <strong>{clientToDelete.client_name}</strong> and all associated data.
// // //                 </p>
// // //               </div>
// // //             </div>
// // //           </div>
// // //           <form onSubmit={handleDeleteConfirm} className="space-y-4">
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
// // //                 Enter Super Admin Password to Confirm:
// // //               </label>
// // //               <input
// // //                 type="password"
// // //                 required
// // //                 value={superAdminPassword}
// // //                 onChange={(e) => {
// // //                   setSuperAdminPassword(e.target.value);
// // //                   setError('');
// // //                 }}
// // //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
// // //                 placeholder="Enter password"
// // //               />
// // //               {error && (
// // //                 <p className="text-red-500 text-sm mt-1">{error}</p>
// // //               )}
// // //             </div>
// // //             <div className="flex gap-3 pt-4">
// // //               <button
// // //                 type="button"
// // //                 onClick={handleCancel}
// // //                 className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
// // //               >
// // //                 Cancel
// // //               </button>
// // //               <button
// // //                 type="submit"
// // //                 className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
// // //               >
// // //                 Delete Client
// // //               </button>
// // //             </div>
// // //           </form>
// // //         </div>
// // //       </div>
// // //     );
// // //   };

// // //   const AddClientModal = () => {
// // //     const [formData, setFormData] = useState({
// // //       clientName: '',
// // //       organization: '',
// // //       industry: '',
// // //       status: 'active' as ClientInstance['status'],
// // //       plan: 'starter' as ClientInstance['plan'],
// // //       alerts: 0,
// // //       analysts: 1,
// // //       endpoints: 100,
// // //       uptime: '99.0',
// // //       lastActivity: 'Just now',
// // //       monthlyAlerts: 0,
// // //       wazuhIp: '',
// // //       wazuhPort: 1514,
// // //       clientEmails: ['']
// // //     });

// // //     const handleSubmit = (e: React.FormEvent) => {
// // //       e.preventDefault();
// // //       const clientData = {
// // //         ...formData,
// // //         clientEmails: formData.clientEmails.filter(email => email.trim() !== '')
// // //       };
// // //       addClient(clientData);
// // //     };

// // //     if (!showAddClientModal) return null;

// // //     return (
// // //       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
// // //         <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
// // //           <div className="flex items-center justify-between mb-4">
// // //             <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Client</h2>
// // //             <button
// // //               onClick={() => setShowAddClientModal(false)}
// // //               className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
// // //             >
// // //               <XCircleIcon className="h-6 w-6" />
// // //             </button>
// // //           </div>
// // //           <form onSubmit={handleSubmit} className="space-y-4">
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// // //                 Client Name
// // //               </label>
// // //               <input
// // //                 type="text"
// // //                 required
// // //                 value={formData.clientName}
// // //                 onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
// // //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// // //               />
// // //             </div>
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// // //                 Organization
// // //               </label>
// // //               <input
// // //                 type="text"
// // //                 required
// // //                 value={formData.organization}
// // //                 onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
// // //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// // //               />
// // //             </div>
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// // //                 Industry
// // //               </label>
// // //               <select
// // //                 value={formData.industry}
// // //                 onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
// // //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// // //               >
// // //                 <option value="Technology">Technology</option>
// // //                 <option value="Financial Services">Financial Services</option>
// // //                 <option value="Healthcare">Healthcare</option>
// // //                 <option value="Retail">Retail</option>
// // //                 <option value="Education">Education</option>
// // //                 <option value="Manufacturing">Manufacturing</option>
// // //                 <option value="Other">Other</option>
// // //               </select>
// // //             </div>
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// // //                 Service Plan
// // //               </label>
// // //               <select
// // //                 value={formData.plan}
// // //                 onChange={(e) => setFormData({ ...formData, plan: e.target.value as ClientInstance['plan'] })}
// // //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// // //               >
// // //                 <option value="starter">Starter</option>
// // //                 <option value="professional">Professional</option>
// // //                 <option value="enterprise">Enterprise</option>
// // //               </select>
// // //             </div>
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// // //                 Initial Endpoints
// // //               </label>
// // //               <input
// // //                 type="number"
// // //                 min="1"
// // //                 value={formData.endpoints}
// // //                 onChange={(e) => setFormData({ ...formData, endpoints: parseInt(e.target.value) })}
// // //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// // //               />
// // //             </div>
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// // //                 Assigned Analysts
// // //               </label>
// // //               <input
// // //                 type="number"
// // //                 min="1"
// // //                 value={formData.analysts}
// // //                 onChange={(e) => setFormData({ ...formData, analysts: parseInt(e.target.value) })}
// // //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// // //               />
// // //             </div>
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// // //                 Wazuh IP Address
// // //               </label>
// // //               <input
// // //                 type="text"
// // //                 required
// // //                 value={formData.wazuhIp}
// // //                 onChange={(e) => setFormData({ ...formData, wazuhIp: e.target.value })}
// // //                 placeholder="192.168.1.100"
// // //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// // //               />
// // //             </div>
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// // //                 Wazuh Port
// // //               </label>
// // //               <input
// // //                 type="number"
// // //                 min="1"
// // //                 max="65535"
// // //                 value={formData.wazuhPort}
// // //                 onChange={(e) => setFormData({ ...formData, wazuhPort: parseInt(e.target.value) })}
// // //                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// // //               />
// // //             </div>
// // //             <div>
// // //               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
// // //                 Client Emails
// // //               </label>
// // //               <div className="space-y-2">
// // //                 {formData.clientEmails.map((email, index) => (
// // //                   <div key={index} className="flex gap-2">
// // //                     <input
// // //                       type="email"
// // //                       value={email}
// // //                       onChange={(e) => {
// // //                         const newEmails = [...formData.clientEmails];
// // //                         newEmails[index] = e.target.value;
// // //                         setFormData({ ...formData, clientEmails: newEmails });
// // //                       }}
// // //                       placeholder="admin@example.com"
// // //                       className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
// // //                     />
// // //                     {formData.clientEmails.length > 1 && (
// // //                       <button
// // //                         type="button"
// // //                         onClick={() => {
// // //                           const newEmails = formData.clientEmails.filter((_, i) => i !== index);
// // //                           setFormData({ ...formData, clientEmails: newEmails });
// // //                         }}
// // //                         className="px-3 py-2 text-red-500 hover:text-red-700 transition-colors"
// // //                       >
// // //                         ×
// // //                       </button>
// // //                     )}
// // //                   </div>
// // //                 ))}
// // //                 <button
// // //                   type="button"
// // //                   onClick={() => setFormData({ ...formData, clientEmails: [...formData.clientEmails, ''] })}
// // //                   className="text-blue-500 hover:text-blue-700 text-sm transition-colors"
// // //                 >
// // //                   + Add another email
// // //                 </button>
// // //               </div>
// // //             </div>
// // //             <div className="flex gap-3 pt-4">
// // //               <button
// // //                 type="button"
// // //                 onClick={() => setShowAddClientModal(false)}
// // //                 className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
// // //               >
// // //                 Cancel
// // //               </button>
// // //               <button
// // //                 type="submit"
// // //                 className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
// // //               >
// // //                 Add Client
// // //               </button>
// // //             </div>
// // //           </form>
// // //         </div>
// // //       </div>
// // //     );
// // //   };

// // //   if (selectedClient) {
// // //     return (
// // //       <div className="space-y-6">
// // //         {/* Back Button */}
// // //         <button
// // //           onClick={() => setSelectedClient(null)}
// // //           className="flex items-center gap-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
// // //         >
// // //           ← Back to Client Overview
// // //         </button>

// // //         {/* Client Header */}
// // //         <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
// // //           <div className="flex items-center justify-between">
// // //             <div>
// // //               <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClient.clientName}</h1>
// // //               <p className="text-gray-600 dark:text-gray-400">{selectedClient.organization} • {selectedClient.industry}</p>
// // //             </div>
// // //             <div className={clsx('px-3 py-1 rounded-full text-sm font-medium border', getStatusBg(selectedClient.status))}>
// // //               <span className={getStatusColor(selectedClient.status)}>
// // //                 {selectedClient.status.charAt(0).toUpperCase() + selectedClient.status.slice(1)}
// // //               </span>
// // //             </div>
// // //           </div>
// // //         </div>

// // //         {/* Client Management Actions */}
// // //         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
// // //           <button className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left shadow-sm">
// // //             <EyeIcon className="h-8 w-8 text-blue-500 mb-3" />
// // //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">View Client Dashboard</h3>
// // //             <p className="text-gray-600 dark:text-gray-400 text-sm">Access real-time security operations</p>
// // //           </button>

// // //           <button className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors text-left shadow-sm">
// // //             <TicketIcon className="h-8 w-8 text-green-500 mb-3" />
// // //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Manage Tickets</h3>
// // //             <p className="text-gray-600 dark:text-gray-400 text-sm">Review and assign security incidents</p>
// // //           </button>

// // //           <button className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors text-left shadow-sm">
// // //             <ChartBarIcon className="h-8 w-8 text-purple-500 mb-3" />
// // //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Analytics & Reports</h3>
// // //             <p className="text-gray-600 dark:text-gray-400 text-sm">Generate security insights</p>
// // //           </button>

// // //           <button className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors text-left shadow-sm">
// // //             <Cog6ToothIcon className="h-8 w-8 text-yellow-500 mb-3" />
// // //             <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Configuration</h3>
// // //             <p className="text-gray-600 dark:text-gray-400 text-sm">Manage client settings</p>
// // //           </button>
// // //         </div>

// // //         {/* Client Metrics */}
// // //         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
// // //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //             <div className="flex items-center gap-3">
// // //               <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
// // //               <div>
// // //                 <p className="text-gray-600 dark:text-gray-400 text-sm">Active Alerts</p>
// // //                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClientLocal.user_count || 0}</p>
// // //               </div>
// // //             </div>
// // //           </div>

// // //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //             <div className="flex items-center gap-3">
// // //               <UserGroupIcon className="h-8 w-8 text-blue-500" />
// // //               <div>
// // //                 <p className="text-gray-600 dark:text-gray-400 text-sm">Analysts Online</p>
// // //                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClientLocal.user_count || 0}</p>
// // //               </div>
// // //             </div>
// // //           </div>

// // //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //             <div className="flex items-center gap-3">
// // //               <ShieldCheckIcon className="h-8 w-8 text-green-500" />
// // //               <div>
// // //                 <p className="text-gray-600 dark:text-gray-400 text-sm">Protected Endpoints</p>
// // //                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{5}</p>
// // //               </div>
// // //             </div>
// // //           </div>

// // //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //             <div className="flex items-center gap-3">
// // //               <ClockIcon className="h-8 w-8 text-purple-500" />
// // //               <div>
// // //                 <p className="text-gray-600 dark:text-gray-400 text-sm">Uptime</p>
// // //                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{'99.9%'}</p>
// // //               </div>
// // //             </div>
// // //           </div>
// // //         </div>

// // //         {/* Additional Client Information */}
// // //         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
// // //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Wazuh Configuration</h3>
// // //             <div className="space-y-3">
// // //               <div className="flex justify-between">
// // //                 <span className="text-gray-600 dark:text-gray-400 text-sm">IP Address:</span>
// // //                 <span className="text-gray-900 dark:text-white font-mono text-sm">{'192.168.1.100'}</span>
// // //               </div>
// // //               <div className="flex justify-between">
// // //                 <span className="text-gray-600 dark:text-gray-400 text-sm">Port:</span>
// // //                 <span className="text-gray-900 dark:text-white font-mono text-sm">{55000}</span>
// // //               </div>
// // //             </div>
// // //           </div>

// // //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
// // //             <div className="space-y-2">
// // //               {selectedClientLocal.clientEmails.map((email, index) => (
// // //                 <div key={index} className="text-sm">
// // //                   <span className="text-gray-900 dark:text-white font-mono">{email}</span>
// // //                 </div>
// // //               ))}
// // //             </div>
// // //           </div>

// // //           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Details</h3>
// // //             <div className="space-y-3">
// // //               <div className="flex justify-between">
// // //                 <span className="text-gray-600 dark:text-gray-400 text-sm">Plan:</span>
// // //                 <span className={clsx('px-2 py-1 rounded text-xs font-medium capitalize', getPlanColor(selectedClient.plan))}>
// // //                   {selectedClient.plan}
// // //                 </span>
// // //               </div>
// // //               <div className="flex justify-between">
// // //                 <span className="text-gray-600 dark:text-gray-400 text-sm">Monthly Alerts:</span>
// // //                 <span className="text-gray-900 dark:text-white text-sm">{1234}</span>
// // //               </div>
// // //             </div>
// // //           </div>
// // //         </div>
// // //       </div>
// // //     );
// // //   }

// // //   return (
// // //     <div className="space-y-6">
// // //       {/* Header */}
// // //       <div className="flex items-center justify-between">
// // //         <div>
// // //           <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Client Overview</h1>
// // //           <p className="text-gray-600 dark:text-gray-400">Monitor and manage security operations for all clients</p>
// // //         </div>
// // //         <button
// // //           onClick={() => setShowAddClientModal(true)}
// // //           className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
// // //         >
// // //           <PlusIcon className="h-5 w-5" />
// // //           Add Client
// // //         </button>
// // //       </div>

// // //       {/* Overview Stats */}
// // //       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
// // //         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //           <div className="flex items-center gap-3">
// // //             <BuildingOfficeIcon className="h-8 w-8 text-blue-500" />
// // //             <div>
// // //               <p className="text-gray-600 dark:text-gray-400 text-sm">Total Clients</p>
// // //               <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalClients}</p>
// // //             </div>
// // //           </div>
// // //         </div>

// // //         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //           <div className="flex items-center gap-3">
// // //             <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
// // //             <div>
// // //               <p className="text-gray-600 dark:text-gray-400 text-sm">Total Active Alerts</p>
// // //               <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAlerts}</p>
// // //             </div>
// // //           </div>
// // //         </div>

// // //         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //           <div className="flex items-center gap-3">
// // //             <UserGroupIcon className="h-8 w-8 text-green-500" />
// // //             <div>
// // //               <p className="text-gray-600 dark:text-gray-400 text-sm">Active Analysts</p>
// // //               <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAnalysts}</p>
// // //             </div>
// // //           </div>
// // //         </div>

// // //         <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
// // //           <div className="flex items-center gap-3">
// // //             <CheckCircleIcon className="h-8 w-8 text-purple-500" />
// // //             <div>
// // //               <p className="text-gray-600 dark:text-gray-400 text-sm">Average Uptime</p>
// // //               <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgUptime}%</p>
// // //             </div>
// // //           </div>
// // //         </div>
// // //       </div>

// // //       {/* Client Instances Grid */}
// // //       <div>
// // //         <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Client Security Operations</h2>
// // //         <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
// // //           {clientInstances.map((client) => (
// // //             <div
// // //               key={client.id}
// // //               className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer shadow-sm"
// // //               onClick={() => setSelectedClient(client)}
// // //             >
// // //               {/* Client Header */}
// // //               <div className="p-6 border-b border-gray-200 dark:border-gray-700">
// // //                 <div className="flex items-center justify-between mb-2">
// // //                   <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{client.client_name}</h3>
// // //                   <div className="flex items-center gap-2">
// // //                     <div className={clsx('px-2 py-1 rounded text-xs font-medium border', getStatusBg(client.status))}>
// // //                       <span className={getStatusColor(client.status)}>
// // //                         {client.status}
// // //                       </span>
// // //                     </div>
// // //                     <button
// // //                       onClick={(e) => {
// // //                         e.stopPropagation();
// // //                         handleDeleteClick(client);
// // //                       }}
// // //                       className="text-gray-400 hover:text-red-500 transition-colors p-1"
// // //                       title="Remove client"
// // //                     >
// // //                       <TrashIcon className="h-4 w-4" />
// // //                     </button>
// // //                   </div>
// // //                 </div>
// // //                 <p className="text-gray-600 dark:text-gray-400 text-sm">{client.organisation_name}</p>
// // //                 <p className="text-gray-500 dark:text-gray-500 text-xs">{client.industry}</p>
// // //               </div>

// // //               {/* Client Metrics */}
// // //               <div className="p-6 space-y-4">
// // //                 <div className="flex justify-between text-sm">
// // //                   <span className="text-gray-600 dark:text-gray-400">Active Alerts</span>
// // //                   <span className="text-gray-900 dark:text-white font-medium">{client.user_count || 0}</span>
// // //                 </div>
// // //                 <div className="flex justify-between text-sm">
// // //                   <span className="text-gray-600 dark:text-gray-400">Analysts Online</span>
// // //                   <span className="text-gray-900 dark:text-white font-medium">{client.user_count || 0}</span>
// // //                 </div>
// // //                 <div className="flex justify-between text-sm">
// // //                   <span className="text-gray-600 dark:text-gray-400">Protected Endpoints</span>
// // //                   <span className="text-gray-900 dark:text-white font-medium">{5}</span>
// // //                 </div>
// // //                 <div className="flex justify-between text-sm">
// // //                   <span className="text-gray-600 dark:text-gray-400">Uptime</span>
// // //                   <span className="text-gray-900 dark:text-white font-medium">{'99.9%'}</span>
// // //                 </div>
// // //                 <div className="flex justify-between text-sm">
// // //                   <span className="text-gray-600 dark:text-gray-400">Wazuh IP</span>
// // //                   <span className="text-gray-900 dark:text-white font-medium text-xs font-mono">{client.wazuhIp}</span>
// // //                 </div>
// // //                 <div className="flex justify-between text-sm">
// // //                   <span className="text-gray-600 dark:text-gray-400">Wazuh Port</span>
// // //                   <span className="text-gray-900 dark:text-white font-medium">{client.wazuhPort}</span>
// // //                 </div>
// // //                 <div className="flex justify-between text-sm">
// // //                   <span className="text-gray-600 dark:text-gray-400">Contact Emails</span>
// // //                   <span className="text-gray-900 dark:text-white font-medium text-right text-xs">
// // //                     {client.clientEmails.length} email{client.clientEmails.length !== 1 ? 's' : ''}
// // //                   </span>
// // //                 </div>
// // //                 <div className="flex justify-between text-sm">
// // //                   <span className="text-gray-600 dark:text-gray-400">Service Plan</span>
// // //                   <span className={clsx('px-2 py-1 rounded text-xs font-medium capitalize', getPlanColor(client.plan))}>
// // //                     {client.plan}
// // //                   </span>
// // //                 </div>
// // //                 <div className="flex justify-between text-sm">
// // //                   <span className="text-gray-600 dark:text-gray-400">Last Activity</span>
// // //                   <span className="text-gray-900 dark:text-white font-medium">{client.lastActivity}</span>
// // //                 </div>
// // //               </div>

// // //               {/* Quick Actions */}
// // //               <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
// // //                 <div className="flex gap-2">
// // //                   <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors">
// // //                     View Dashboard
// // //                   </button>
// // //                   <button className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-3 py-2 rounded text-sm transition-colors">
// // //                     <Cog6ToothIcon className="h-4 w-4" />
// // //                   </button>
// // //                 </div>
// // //               </div>
// // //             </div>
// // //           ))}
// // //         </div>
// // //       </div>

// // //       {/* Add Client Modal */}
// // //       <AddClientModal />
// // //       {/* Delete Confirmation Modal */}
// // //       <DeleteConfirmationModal />
// // //     </div>
// // //   );
// // // }
