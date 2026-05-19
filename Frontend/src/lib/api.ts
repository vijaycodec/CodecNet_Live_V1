// Centralized API service for unified backend communication
import Cookies from 'js-cookie';
import { clearAuthSession } from './auth'; // PATCH 55: Session expiry handling

// API Configuration - Updated for new MongoDB backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
const AUTH_BASE_URL = `${API_BASE_URL}/auth`;
const USERS_BASE_URL = `${API_BASE_URL}/users`;
const ROLES_BASE_URL = `${API_BASE_URL}/roles`;
const PERMISSIONS_BASE_URL = `${API_BASE_URL}/permissions`;
const ORGANISATIONS_BASE_URL = `${API_BASE_URL}/organisations`;
const SUBSCRIPTION_PLANS_BASE_URL = `${API_BASE_URL}/subscription-plans`;
const WAZUH_BASE_URL = `${API_BASE_URL}/wazuh`;
const TICKETS_BASE_URL = `${API_BASE_URL}/tickets`;
const ALERT_NOTIFICATIONS_BASE_URL = `${API_BASE_URL}/alert-notifications`;

// Authentication helper
const getAuthHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add JWT token for SIEM-dev backend authentication
  if (typeof window !== 'undefined') {
    // const token = localStorage.getItem('token');
    const token = Cookies.get('auth_token');
    if (token) {
      // console.log('🔑 Using token for API call:', token.substring(0, 20) + '...')
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      // console.warn('⚠️ No token found in localStorage for API call')
    }
  }
  
  return headers;
};

// Generic API request helper
const apiRequest = async (url: string, options: RequestInit = {}) => {
  const config: RequestInit = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  };

  console.log('🌐 Making API request to:', url)
  console.log('🔧 Request config:', config)

  try {
    const response = await fetch(url, config);
    console.log('📡 Response status:', response.status, response.statusText)

    // PATCH 55: Handle session expiry - 401 Unauthorized
    // When session expires or is invalid, clear auth and redirect to login
    if (response.status === 401) {
      console.log('🔒 [SESSION EXPIRED] 401 Unauthorized - Session expired or invalid');
      await clearAuthSession();
      if (typeof window !== 'undefined') {
        console.log('🔄 [SESSION EXPIRED] Redirecting to login page...');
        window.location.href = '/login';
      }
      const errorData = await response.json().catch(() => ({ message: 'Session expired' }));
      throw new Error(errorData.message || 'Session expired. Please login again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ API request failed:', { url, status: response.status, error: errorData })
      // Check multiple error field formats from backend
      const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ API request successful:', url)
    console.log('📄 Response data:', data)
    return data;
  } catch (error) {
    console.error('💥 API request failed:', error);
    throw error;
  }
};

// Authentication API calls
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    apiRequest(`${AUTH_BASE_URL}/login`, {
      method: 'POST',
      body: JSON.stringify({ identifier: credentials.email, password: credentials.password }),
    }),
  
  verify2FA: (data: { session_id: string; code: string }) =>
    apiRequest(`${AUTH_BASE_URL}/verify-2fa`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  refreshToken: (refresh_token: string) =>
    apiRequest(`${AUTH_BASE_URL}/refresh-token`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token }),
    }),
  
  logout: () =>
    apiRequest(`${AUTH_BASE_URL}/logout`, {
      method: 'POST',
    }),
  
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiRequest(`${AUTH_BASE_URL}/change-password`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  requestPasswordReset: (email: string) =>
    apiRequest(`${AUTH_BASE_URL}/password-reset/request`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  
  resetPassword: (data: { token: string; new_password: string }) =>
    apiRequest(`${AUTH_BASE_URL}/password-reset/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getProfile: () => apiRequest(`${AUTH_BASE_URL}/me`),
  
  setup2FA: () => apiRequest(`${AUTH_BASE_URL}/2fa/setup`),
  
  enable2FA: (data: { secret: string; code: string }) =>
    apiRequest(`${AUTH_BASE_URL}/2fa/enable`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  disable2FA: (code: string) =>
    apiRequest(`${AUTH_BASE_URL}/2fa/disable`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
};

// Users API calls
export const usersApi = {
  getUsers: (params?: { page?: number; limit?: number; search?: string }) => {
    const searchParams = new URLSearchParams(params as Record<string, string>);
    return apiRequest(`${USERS_BASE_URL}?${searchParams}`);
  },
  
  getActiveUsers: () => apiRequest(`${USERS_BASE_URL}/active`),
  
  getUserById: (id: string) => apiRequest(`${USERS_BASE_URL}/${id}`),
  
  createUser: (userData: {
    username: string;
    email: string;
    full_name: string;
    role_id: string;
    organisation_id: string;
    password: string;
    phone?: string;
    department?: string;
  }) =>
    apiRequest(USERS_BASE_URL, {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  
  updateUser: (id: string, userData: any) =>
    apiRequest(`${USERS_BASE_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),
  
  updateProfile: (userData: any) =>
    apiRequest(`${USERS_BASE_URL}/me/profile`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),
  
  toggleUserStatus: (id: string) =>
    apiRequest(`${USERS_BASE_URL}/${id}/status`, {
      method: 'PATCH',
    }),
  
  unlockUser: (id: string) =>
    apiRequest(`${USERS_BASE_URL}/${id}/unlock`, {
      method: 'POST',
    }),
  
  deleteUser: (id: string) =>
    apiRequest(`${USERS_BASE_URL}/${id}`, {
      method: 'DELETE',
    }),
  
  getUsersByRole: (roleId: string) => apiRequest(`${USERS_BASE_URL}/role/${roleId}`),
  
  getUsersByOrganisation: (orgId: string) => apiRequest(`${USERS_BASE_URL}/organisation/${orgId}`),
  
  searchUsers: (query: string) => apiRequest(`${USERS_BASE_URL}/search?q=${encodeURIComponent(query)}`),
  
  getUserStatistics: () => apiRequest(`${USERS_BASE_URL}/statistics`),
};

// Roles API calls
export const rolesApi = {
  getRoles: () => apiRequest(`${ROLES_BASE_URL}/get`),
  
  getActiveRoles: () => apiRequest(`${ROLES_BASE_URL}/active`),
  
  getRoleById: (id: string) => apiRequest(`${ROLES_BASE_URL}/${id}`),
  
  createRole: (roleData: {
    role_name: string;
    role_code: string;
    description?: string;
    permissions: Record<string, boolean>;
    organisation_id?: string;
  }) =>
    apiRequest(ROLES_BASE_URL, {
      method: 'POST',
      body: JSON.stringify(roleData),
    }),
  
  updateRole: (id: string, roleData: any) =>
    apiRequest(`${ROLES_BASE_URL}/update/${id}`, {
      method: 'PUT',
      body: JSON.stringify(roleData),
    }),

  deleteRole: (id: string) =>
    apiRequest(`${ROLES_BASE_URL}/delete/${id}`, {
      method: 'DELETE',
    }),
  
  cloneRole: (id: string, newName: string) =>
    apiRequest(`${ROLES_BASE_URL}/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ role_name: newName }),
    }),
};

// Organizations API calls (for client management)
export const organisationsApi = {
  getOrganisations: () => apiRequest(ORGANISATIONS_BASE_URL),
  
  getActiveOrganisations: () => apiRequest(`${ORGANISATIONS_BASE_URL}/active`),
  
  getOrganisationById: (id: string, includeCredentials = false) =>
    apiRequest(`${ORGANISATIONS_BASE_URL}/${id}${includeCredentials ? '?includeCredentials=true' : ''}`),
  
  createOrganisation: (orgData: {
    organisation_name: string;
    client_name: string;
    industry?: string;
    emails: string[];
    phone_numbers: string[];
    subscription_plan_id: string;
    initial_assets?: number;
    wazuh_manager_ip: string;
    wazuh_manager_port: number;
    wazuh_manager_username: string;
    wazuh_manager_password: string;
    wazuh_indexer_ip: string;
    wazuh_indexer_port: number;
    wazuh_indexer_username: string;
    wazuh_indexer_password: string;
    wazuh_dashboard_ip: string;
    wazuh_dashboard_port: number;
    wazuh_dashboard_username: string;
    wazuh_dashboard_password: string;
  }) =>
    apiRequest(ORGANISATIONS_BASE_URL, {
      method: 'POST',
      body: JSON.stringify(orgData),
    }),
  
  updateOrganisation: (id: string, orgData: any) =>
    apiRequest(`${ORGANISATIONS_BASE_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orgData),
    }),
  
  deleteOrganisation: (id: string) =>
    apiRequest(`${ORGANISATIONS_BASE_URL}/${id}`, {
      method: 'DELETE',
    }),
  
  getOrganisationStatistics: (id: string) => 
    apiRequest(`${ORGANISATIONS_BASE_URL}/${id}/statistics`),
};

// Permissions API calls
export const permissionsApi = {
  getPermissions: () => apiRequest(`${PERMISSIONS_BASE_URL}/all`),
  
  getPermissionById: (id: string) => apiRequest(`${PERMISSIONS_BASE_URL}/${id}`),
  
  createPermission: (permissionData: {
    permission_name: string;
    permission_code: string;
    description?: string;
    category?: string;
  }) =>
    apiRequest(PERMISSIONS_BASE_URL, {
      method: 'POST',
      body: JSON.stringify(permissionData),
    }),
  
  updatePermission: (id: string, permissionData: any) =>
    apiRequest(`${PERMISSIONS_BASE_URL}/update/${id}`, {
      method: 'PUT',
      body: JSON.stringify(permissionData),
    }),

  deletePermission: (id: string) =>
    apiRequest(`${PERMISSIONS_BASE_URL}/delete/${id}`, {
      method: 'DELETE',
    }),
};

// Subscription Plans API calls
export const subscriptionPlansApi = {
  getPlans: () => apiRequest(SUBSCRIPTION_PLANS_BASE_URL),
  
  getActivePlans: () => apiRequest(`${SUBSCRIPTION_PLANS_BASE_URL}/active`),
  
  getPlanById: (id: string) => apiRequest(`${SUBSCRIPTION_PLANS_BASE_URL}/${id}`),
  
  createPlan: (planData: {
    plan_name: string;
    plan_code: string;
    description?: string;
    price_monthly: number;
    price_yearly?: number;
    features: Record<string, boolean>;
    limits: Record<string, number>;
  }) =>
    apiRequest(SUBSCRIPTION_PLANS_BASE_URL, {
      method: 'POST',
      body: JSON.stringify(planData),
    }),
  
  updatePlan: (id: string, planData: any) =>
    apiRequest(`${SUBSCRIPTION_PLANS_BASE_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(planData),
    }),
  
  deletePlan: (id: string) =>
    apiRequest(`${SUBSCRIPTION_PLANS_BASE_URL}/${id}`, {
      method: 'DELETE',
    }),
};

// Wazuh API calls (using SIEM-dev backend)
export const wazuhApi = {
  getAgentsBasic: (orgId?: string) => {
    const url = orgId ? `${WAZUH_BASE_URL}/agents-basic?orgId=${orgId}` : `${WAZUH_BASE_URL}/agents-basic`;
    return apiRequest(url);
  },

  getAgentsSummary: (orgId?: string) => {
    const url = orgId ? `${WAZUH_BASE_URL}/agents-summary?orgId=${orgId}` : `${WAZUH_BASE_URL}/agents-summary`;
    return apiRequest(url);
  },

  getAlerts: (orgId?: string) => {
    const url = orgId ? `${WAZUH_BASE_URL}/alerts?orgId=${orgId}` : `${WAZUH_BASE_URL}/alerts`;
    return apiRequest(url);
  },

  getDashboardMetrics: (orgId?: string) => {
    const url = orgId ? `${WAZUH_BASE_URL}/dashboard-metrics?orgId=${orgId}` : `${WAZUH_BASE_URL}/dashboard-metrics`;
    return apiRequest(url);
  },

  getCompliance: (orgId?: string) => {
    const url = orgId ? `${WAZUH_BASE_URL}/compliance?orgId=${orgId}` : `${WAZUH_BASE_URL}/compliance`;
    return apiRequest(url);
  },

  getComplianceFramework: (framework: string, timeParams: { type: 'relative' | 'absolute', hours?: number, from?: string, to?: string } = { type: 'relative', hours: 168 }, orgId?: string) => {
    let url = `${WAZUH_BASE_URL}/compliance/${framework}?_t=${Date.now()}`;

    // Add time range parameters
    if (timeParams.type === 'relative' && timeParams.hours !== undefined && timeParams.hours > 0) {
      url += `&hours=${timeParams.hours}`;
    } else if (timeParams.type === 'absolute' && timeParams.from && timeParams.to) {
      url += `&from=${encodeURIComponent(timeParams.from)}&to=${encodeURIComponent(timeParams.to)}`;
    }

    if (orgId) url += `&orgId=${orgId}`;
    return apiRequest(url);
  },
};


// Tickets API calls (updated for new backend structure)
export const ticketsApi = {
  getTickets: (params?: {
    status?: string;
    priority?: string;
    severity?: string;
    page?: number;
    limit?: number;
    assigned_to?: string;
    organisation_id?: string;
  }) => {
    const searchParams = new URLSearchParams();
    // Add populate parameter to get organisation details including emails
    searchParams.append('populate', 'organisation_id');

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const url = `${TICKETS_BASE_URL}?${searchParams}`;
    console.log('=== TICKETS API CALL ===');
    console.log('TICKETS_BASE_URL:', TICKETS_BASE_URL);
    console.log('searchParams:', searchParams.toString());
    console.log('Final URL:', url);
    console.log('About to make apiRequest to:', url);

    return apiRequest(url);
  },
  
  getMyTickets: () => apiRequest(`${TICKETS_BASE_URL}/my`),
  
  getTicketById: (ticketId: string) => apiRequest(`${TICKETS_BASE_URL}/${ticketId}`),
  
  createTicket: (ticketData: {
    title: string;
    description: string;
    category?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    severity?: 'minor' | 'major' | 'critical';
    assigned_to?: string;
    related_asset_id?: string;
    alert_id?: string;
    rule_id?: string;
    rule_name?: string;
    host_name?: string;
    agent_name?: string;
    source_ip?: string;
    alert_timestamp?: string;
    tags?: string[];
    due_date?: string;
    estimated_hours?: number;
  }) =>
    apiRequest(TICKETS_BASE_URL, {
      method: 'POST',
      body: JSON.stringify(ticketData),
    }),
  
  updateTicket: (ticketId: string, updateData: any) =>
    apiRequest(`${TICKETS_BASE_URL}/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    }),
  
  updateTicketStatus: (ticketId: string, status: 'open' | 'investigating' | 'resolved', resolutionType?: string, resolutionNotes?: string) => {
    const body: any = { status };
    if (status === 'resolved' && resolutionType && resolutionNotes) {
      body.resolution_type = resolutionType;
      body.resolution_notes = resolutionNotes;
    }
    return apiRequest(`${TICKETS_BASE_URL}/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  
  assignTicket: (ticketId: string, assigneeId: string) =>
    apiRequest(`${TICKETS_BASE_URL}/${ticketId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigned_to: assigneeId }),
    }),
  
  addComment: (ticketId: string, comment: string) =>
    apiRequest(`${TICKETS_BASE_URL}/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),
  
  deleteTicket: (ticketId: string) =>
    apiRequest(`${TICKETS_BASE_URL}/${ticketId}`, {
      method: 'DELETE',
    }),
  
  searchTickets: (query: string) =>
    apiRequest(`${TICKETS_BASE_URL}/search?q=${encodeURIComponent(query)}`),

  getTicketStatistics: () => apiRequest(`${TICKETS_BASE_URL}/statistics`),

  updateTicketTime: (ticketId: string, estimatedHours?: number, actualHours?: number) => {
    const body: any = {};
    if (estimatedHours !== undefined) body.estimated_hours = estimatedHours;
    if (actualHours !== undefined) body.actual_hours = actualHours;
    return apiRequest(`${TICKETS_BASE_URL}/${ticketId}/time`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  assignTicketToAsset: (ticketId: string, assetId: string) =>
    apiRequest(`${TICKETS_BASE_URL}/${ticketId}/asset`, {
      method: 'PATCH',
      body: JSON.stringify({ asset_id: assetId }),
    }),
};

// Critical Alert Email Notifications API
export const alertNotificationsApi = {
  // Email delivery logs (paginated)
  getLogs: (params?: {
    organisationId?: string;
    status?: 'queued' | 'sent' | 'failed';
    alert_id?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const qs = searchParams.toString();
    return apiRequest(`${ALERT_NOTIFICATIONS_BASE_URL}/logs${qs ? `?${qs}` : ''}`);
  },

  // Manual / test trigger
  sendTest: (body: {
    organisationId?: string;
    extraCc?: string[];
    alert?: {
      alert_id?: string;
      alert_title?: string;
      alert_severity?: number;
      alert_source?: string;
      alert_time?: string;
      alert_description?: string;
    };
  } = {}) =>
    apiRequest(`${ALERT_NOTIFICATIONS_BASE_URL}/test`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // SMTP health check
  verifySmtp: () => apiRequest(`${ALERT_NOTIFICATIONS_BASE_URL}/smtp/verify`),

  // CC email management for an organisation
  getOrgCc: (organisationId: string) =>
    apiRequest(`${ALERT_NOTIFICATIONS_BASE_URL}/cc/${organisationId}`),

  updateOrgCc: (
    organisationId: string,
    data: { cc_emails?: string[]; alert_email_notifications_enabled?: boolean }
  ) =>
    apiRequest(`${ALERT_NOTIFICATIONS_BASE_URL}/cc/${organisationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Legacy API calls for backward compatibility (will be removed)
export const legacyApi = {
  // These should be replaced with wazuhApi calls
  getAgentsSummary: () => fetch('http://localhost:4000/agents-summary').then(res => res.json()),
  getAlerts: () => fetch('http://localhost:4000/alerts').then(res => res.json()),
  getDashboardMetrics: () => fetch('http://localhost:4000/dashboard-metrics').then(res => res.json()),
  getCompliance: () => fetch('http://localhost:4000/compliance').then(res => res.json()),
};

// Export the main API object
export const api = {
  auth: authApi,
  users: usersApi,
  roles: rolesApi,
  permissions: permissionsApi,
  organisations: organisationsApi,
  subscriptionPlans: subscriptionPlansApi,
  wazuh: wazuhApi,
  tickets: ticketsApi,
  alertNotifications: alertNotificationsApi,
  legacy: legacyApi, // For migration purposes
};

export default api;