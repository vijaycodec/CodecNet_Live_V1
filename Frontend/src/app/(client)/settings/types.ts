// Shared types for settings components

export interface ApiEndpoint {
  id: number;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  frequency: number; // in minutes
  enabled: boolean;
  lastCall: string;
  nextCall: string;
  responseTime: number;
  status: 'active' | 'error' | 'warning';
}

export interface NotificationSettings {
  emailAlerts: boolean;
  smsAlerts: boolean;
  pushNotifications: boolean;
  alertThresholds: {
    critical: boolean;
    high: boolean;
    medium: boolean;
    low: boolean;
  };
  channels: {
    slack: boolean;
    teams: boolean;
    webhook: boolean;
  };
}

export interface GeneralSettings {
  timezone: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
  dateFormat: string;
  autoRefresh: boolean;
  refreshInterval: number;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  loginAttempts: number;
  passwordExpiry: number;
  requireStrongPassword: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone_number?: string;
  role_id: string;
  // role?: {
  //   role_name: string;
  //   permissions: Record<string, any>;
  // };
  role: string;
  status: string;
  organisation_id?: string;
  organisation_ids?: string[];
  user_type: 'internal' | 'external';
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  _id: string;
  role_name: string;
  description?: string;
  permissions: Record<string, any>;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  _id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  created_at: string;
  updated_at: string;
  scope: string
}

