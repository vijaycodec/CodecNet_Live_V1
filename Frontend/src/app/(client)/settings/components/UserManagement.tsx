'use client';

import { useState, useEffect, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  UsersIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { User, Role } from '../types';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

// A simple type for the organization list
interface Organisation {
  _id: string;
  organisation_name: string;
}

interface UserManagementProps {
  users: User[];
  roles: Role[];
  onUsersChange: (users: User[]) => void;
  onRolesChange: (roles: Role[]) => void;
}

export default function UserManagement({
  users,
  roles,
  onUsersChange,
  onRolesChange
}: UserManagementProps) {
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // State for viewing user details (if you have a view modal)
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [showUserViewModal, setShowUserViewModal] = useState(false);


  const handleAddUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleViewUser = (user: User) => {
    setViewingUser(user);
    setShowUserViewModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const api = await import('@/lib/api');
        await api.usersApi.deleteUser(userId);
        onUsersChange(users.filter(user => user.id !== userId));
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user. Please try again.');
      }
    }
  };

  const handleSaveUser = (newUser: User) => {
    if (editingUser) {
      // Logic for updating an existing user
      onUsersChange(users.map(u => (u.id === newUser.id ? newUser : u)));
    } else {
      // Logic for adding a new user
      onUsersChange([...users, newUser]);
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            User Management
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage system users and their access permissions
          </p>
        </div>
        <button
          onClick={handleAddUser}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.full_name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {user.role || 'No Role here'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      user.user_type === 'internal'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    )}>
                      {user.user_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        'h-2 w-2 rounded-full',
                        user.status === 'active' ? 'bg-green-400' : 'bg-red-400'
                      )} />
                      <span className="text-sm text-gray-900 dark:text-white capitalize">
                        {user.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-1 text-green-600 hover:text-green-900 dark:text-green-400"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <UserModal
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            setEditingUser(null);
          }}
          user={editingUser}
          roles={roles}
          onSave={(newUser) => {
            handleSaveUser(newUser);
            setShowUserModal(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* View User Modal */}
      {showUserViewModal && (
        <UserViewModal
          isOpen={showUserViewModal}
          onClose={() => {
            setShowUserViewModal(false);
            setViewingUser(null);
          }}
          user={viewingUser}
        />
      )}
    </div>
  );
}

// User Modal Component
interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  roles: Role[];
  onSave: (user: User) => void;
}

function UserModal({ isOpen, onClose, user, roles, onSave }: UserModalProps) {
  const [loading, setLoading] = useState(false);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  const [form, setForm] = useState({
    username: '',
    full_name: '',
    email: '',
    country_code: '+91',
    phone_number: '',
    password: '',
    confirmPassword: '',
    role_id: '',
    organisation_id: '',
    organisation_ids: [] as string[],
    user_type: 'internal' as 'internal' | 'external',
    status: 'active',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN'
  });

  const isEditing = !!user;

  useEffect(() => {
    const fetchOrganisations = async () => {
      const token = Cookies.get('auth_token');
      if (!token) {
        console.error("No auth token found");
        setOrganisations([]);
        return;
      }
      try {
        console.log("Fetching organisations...");
        const res = await fetch(`${API_BASE_URL}/organisations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          }
        });
        console.log("Organisations response status:", res.status, res.statusText);

        if (!res.ok) {
          console.error("Organisations API error:", res.status, res.statusText);
          setOrganisations([]);
          return;
        }

        const data = await res.json();
        console.log("Organisations response data:", data);
        console.log("Organisations data type:", typeof data);
        console.log("Organisations data structure:", Object.keys(data || {}));

        // Handle different response formats
        let orgs = [];
        if (data && data.success && Array.isArray(data.data)) {
          orgs = data.data;
        } else if (Array.isArray(data)) {
          orgs = data;
        } else if (data && Array.isArray(data.organisations)) {
          orgs = data.organisations;
        } else {
          console.error("Unexpected organisations response format:", data);
          setOrganisations([]);
          return;
        }

        console.log("Parsed organisations:", orgs);
        setOrganisations(orgs);
        console.log("Set organisations count:", orgs.length);
      } catch (err) {
        console.error("Failed to fetch organisations:", err);
        setOrganisations([]);
      }
    };

    if (isOpen) {
      fetchOrganisations();
      setValidationErrors({});
      setError(null);

      if (user) {
        // Split phone number into country code and number
        let countryCode = '+91';
        let phoneNumber = '';
        if (user.phone_number) {
          const parts = user.phone_number.split(' ');
          if (parts.length === 2) {
            countryCode = parts[0];
            phoneNumber = parts[1];
          }
        }

        setForm({
          username: user.username || '',
          full_name: user.full_name || '',
          email: user.email || '',
          country_code: countryCode,
          phone_number: phoneNumber,
          password: '',
          confirmPassword: '',
          role_id: user.role_id || '',
          organisation_id: user.organisation_id || '',
          organisation_ids: user.organisation_ids || [],
          user_type: user.user_type || 'internal',
          status: user.status || 'active',
          timezone: 'Asia/Kolkata',
          locale: 'en-IN'
        });
      } else {
        setForm({
          username: '',
          full_name: '',
          email: '',
          country_code: '+91',
          phone_number: '',
          password: '',
          confirmPassword: '',
          role_id: '',
          organisation_id: '',
          organisation_ids: [],
          user_type: 'internal',
          status: 'active',
          timezone: 'Asia/Kolkata',
          locale: 'en-IN'
        });
      }
    }
  }, [isOpen, user]);

  // Validation functions
  const validateUsername = (username: string): string | null => {
    if (!username.trim()) return 'Username is required';
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (username.length > 50) return 'Username must not exceed 50 characters';
    if (!/^[a-zA-Z][a-zA-Z0-9_]{2,49}$/.test(username)) {
      return 'Username must start with a letter and contain only letters, numbers, and underscores';
    }
    return null;
  };

  const validateFullName = (fullName: string): string | null => {
    if (!fullName.trim()) return 'Full name is required';
    if (fullName.length < 2) return 'Full name must be at least 2 characters';
    if (fullName.length > 100) return 'Full name must not exceed 100 characters';
    return null;
  };

  const validateEmail = (email: string): string | null => {
    if (!email.trim()) return 'Email is required';
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const validateCountryCode = (code: string): string | null => {
    if (!code) return 'Country code is required';
    const codeRegex = /^\+[1-9]\d{0,2}$/;
    if (!codeRegex.test(code)) {
      return 'Invalid country code (e.g., +1, +91, +44)';
    }
    return null;
  };

  const validatePhoneNumber = (phone: string): string | null => {
    if (!phone) return null;
    // Validate mobile number (7-14 digits, no spaces or special characters)
    const phoneRegex = /^\d{7,14}$/;
    if (!phoneRegex.test(phone)) {
      return 'Phone number must be 7-14 digits without spaces or special characters';
    }
    return null;
  };

  const validatePassword = (password: string): string | null => {
    if (!isEditing && !password) return 'Password is required';
    if (password && password.length < 8) return 'Password must be at least 8 characters';
    if (password && password.length > 128) return 'Password must not exceed 128 characters';
    if (password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    return null;
  };

  const validateConfirmPassword = (confirmPassword: string, password: string): string | null => {
    if ((!isEditing || password) && confirmPassword !== password) {
      return 'Passwords do not match';
    }
    return null;
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    const usernameError = validateUsername(form.username);
    if (usernameError) errors.username = usernameError;

    const fullNameError = validateFullName(form.full_name);
    if (fullNameError) errors.full_name = fullNameError;

    const emailError = validateEmail(form.email);
    if (emailError) errors.email = emailError;

    const countryCodeError = validateCountryCode(form.country_code);
    if (countryCodeError) errors.country_code = countryCodeError;

    const phoneError = validatePhoneNumber(form.phone_number);
    if (phoneError) errors.phone_number = phoneError;

    const passwordError = validatePassword(form.password);
    if (passwordError) errors.password = passwordError;

    const confirmPasswordError = validateConfirmPassword(form.confirmPassword, form.password);
    if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;

    if (!form.role_id) errors.role_id = 'Role is required';

    if (form.user_type === 'external' && !form.organisation_id && form.organisation_ids.length === 0) {
      errors.organisation = 'At least one organisation is required for external users';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleOrganisationChange = (orgId: string, checked: boolean) => {
    if (form.user_type === 'external') {
      setForm(prev => ({
        ...prev,
        organisation_ids: checked
          ? [...prev.organisation_ids, orgId]
          : prev.organisation_ids.filter(id => id !== orgId)
      }));
    } else {
      setForm(prev => ({ ...prev, organisation_id: checked ? orgId : '' }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const token = Cookies.get('auth_token');
    if (!token) {
      setError("Authentication token not found. Please log in.");
      setLoading(false);
      return;
    }

    const payload: any = { ...form };
    delete payload.confirmPassword;
    delete payload.country_code; // Remove from payload, we'll combine it below

    // Combine country code and phone number
    if (form.phone_number && form.country_code) {
      payload.phone_number = `${form.country_code} ${form.phone_number}`;
    } else {
      delete payload.phone_number;
    }
    // Note: Backend will format the phone number to "+<country code> <mobile number>"

    // Handle organisation assignment based on user type
    if (form.user_type === 'internal') {
      // For internal users: only send organisation_id, remove organisation_ids
      delete payload.organisation_ids;
      // For internal users, if no organisation selected, set to null (not associated with any org)
      if (!payload.organisation_id) {
        payload.organisation_id = null;
      }
    } else {
      // For external users: only send organisation_ids, remove organisation_id
      delete payload.organisation_id;
      // Ensure organisation_ids is not empty for external users
      if (!payload.organisation_ids || payload.organisation_ids.length === 0) {
        setError('Please select at least one organisation for external users');
        return;
      }
    }

    if (isEditing && !form.password) {
      delete payload.password;
    }

    try {
      const apiUrl = isEditing ? `${API_BASE_URL}/users/${user?.id}` : `${API_BASE_URL}/users`;
      const method = isEditing ? 'PUT' : 'POST';

      console.log('Making request to:', apiUrl, 'with payload:', payload);

      const response = await fetch(apiUrl, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Backend response:', result);

      if (!result.success) {
        if (result.errors) {
          const backendErrors: {[key: string]: string} = {};
          result.errors.forEach((err: any) => {
            backendErrors[err.field] = err.message;
          });
          setValidationErrors(backendErrors);
        } else {
          setError(result.message || 'Failed to save user.');
        }
        return;
      }

      onSave(result.data);

    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the user.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return typeof window !== 'undefined' ? createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Modal Header with Gradient */}
        <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <UserPlusIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isEditing ? 'Edit User' : 'Add New User'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isEditing ? 'Update user information and permissions' : 'Create a new user account with role and organization assignment'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-200"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-800/30">
          <div className="max-w-5xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl mr-3">
                  <UserPlusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    value={form.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                      validationErrors.username
                        ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                        : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                    }`}
                    placeholder="e.g., john_doe"
                  />
                  {validationErrors.username && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.username}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {form.username.length}/50 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={form.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                      validationErrors.full_name
                        ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                        : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                    }`}
                    placeholder="e.g., John Doe"
                  />
                  {validationErrors.full_name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.full_name}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {form.full_name.length}/100 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    maxLength={254}
                    value={form.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                      validationErrors.email
                        ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                        : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                    }`}
                    placeholder="e.g., john.doe@company.com"
                  />
                  {validationErrors.email && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.email}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {form.email.length}/254 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <div className="w-32">
                      <input
                        type="text"
                        maxLength={5}
                        value={form.country_code}
                        onChange={(e) => handleInputChange('country_code', e.target.value)}
                        className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                          validationErrors.country_code
                            ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                            : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                        }`}
                        placeholder="+91"
                      />
                      {validationErrors.country_code && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {validationErrors.country_code}
                        </p>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="tel"
                        maxLength={14}
                        value={form.phone_number}
                        onChange={(e) => handleInputChange('phone_number', e.target.value.replace(/\D/g, ''))}
                        className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                          validationErrors.phone_number
                            ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                            : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                        }`}
                        placeholder="9876543210"
                      />
                      {validationErrors.phone_number && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {validationErrors.phone_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl mr-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                Security
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password {!isEditing && '*'}
                  </label>
                  <input
                    type="password"
                    maxLength={128}
                    value={form.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    autoComplete={isEditing ? "new-password" : "new-password"}
                    className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                      validationErrors.password
                        ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                        : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                    }`}
                    placeholder={isEditing ? "Leave blank to keep current password" : "Enter a strong password"}
                  />
                  {validationErrors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.password}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Must be 8+ characters with uppercase, lowercase, and number
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password {(!isEditing || form.password) && '*'}
                  </label>
                  <input
                    type="password"
                    maxLength={128}
                    value={form.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    autoComplete="new-password"
                    className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                      validationErrors.confirmPassword
                        ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                        : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                    }`}
                    placeholder="Confirm your password"
                  />
                  {validationErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Role & Access */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl mr-3">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                Role & Access
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    User Type *
                  </label>
                  <select
                    value={form.user_type}
                    onChange={(e) => handleInputChange('user_type', e.target.value)}
                    className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                  >
                    <option value="internal">Internal User</option>
                    <option value="external">External User</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Role *
                  </label>
                  <select
                    value={form.role_id}
                    onChange={(e) => handleInputChange('role_id', e.target.value)}
                    className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 transition-all duration-200 ${
                      validationErrors.role_id
                        ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-800'
                        : 'border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-200 dark:focus:ring-blue-800'
                    }`}
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role._id} value={role._id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                  {validationErrors.role_id && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.role_id}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Organisation Assignment - Only show for external users */}
            {form.user_type === 'external' && (
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl mr-3">
                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  Organisation Assignment
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Accessible Organisations *
                  </label>
                  <div className={`max-h-48 overflow-y-auto border-2 rounded-xl p-4 bg-white dark:bg-gray-800 transition-all duration-200 ${
                    validationErrors.organisation
                      ? 'border-red-500 dark:border-red-400'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}>
                    {organisations.length > 0 ? (
                      <div className="space-y-3">
                        {organisations.map((org) => (
                          <label key={org._id} className="flex items-center space-x-4 p-4 rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 border border-transparent hover:border-blue-200 dark:hover:border-gray-600">
                            <input
                              type="checkbox"
                              checked={form.organisation_ids.includes(org._id)}
                              onChange={(e) => handleOrganisationChange(org._id, e.target.checked)}
                              className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded-lg focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 transition-all duration-200"
                            />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {org.organisation_name}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No organisations available
                      </p>
                    )}
                  </div>
                  {validationErrors.organisation && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.organisation}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Select all organisations this external user should have access to
                  </p>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Error
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="flex justify-end items-center p-6 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-3 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-2 border-blue-600 hover:border-blue-700 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {isEditing ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                isEditing ? 'Update User' : 'Create User'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

// User View Modal Component (remains unchanged)
interface UserViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

function UserViewModal({ isOpen, onClose, user }: UserViewModalProps) {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            User Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Personal Information</h3>
            <div className="space-y-3">
              <div>
                <span className="block text-sm text-gray-500 dark:text-gray-400">Full Name</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</span>
              </div>
              <div>
                <span className="block text-sm text-gray-500 dark:text-gray-400">Username</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</span>
              </div>
              <div>
                <span className="block text-sm text-gray-500 dark:text-gray-400">Email</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Account Information</h3>
            <div className="space-y-3">
              <div>
                <span className="block text-sm text-gray-500 dark:text-gray-400">Role</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.role || 'No Role here'}
                </span>
              </div>
              <div>
                <span className="block text-sm text-gray-500 dark:text-gray-400">User Type</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {user.user_type}
                </span>
              </div>
              <div>
                <span className="block text-sm text-gray-500 dark:text-gray-400">Status</span>
                <span className={clsx(
                  'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                  user.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                )}>
                  {user.status}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Activity</h3>
            <div className="space-y-3">
              <div>
                <span className="block text-sm text-gray-500 dark:text-gray-400">Last Login</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                </span>
              </div>
              <div>
                <span className="block text-sm text-gray-500 dark:text-gray-400">Created</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}












// 'use client';

// import { useState, useEffect } from 'react';
// import {
//   UsersIcon,
//   PlusIcon,
//   PencilIcon,
//   TrashIcon,
//   EyeIcon,
//   XMarkIcon
// } from '@heroicons/react/24/outline';
// import { clsx } from 'clsx';
// import { User, Role } from '../types';
// import { usersApi, rolesApi } from '@/lib/api';

// interface UserManagementProps {
//   users: User[];
//   roles: Role[];
//   onUsersChange: (users: User[]) => void;
//   onRolesChange: (roles: Role[]) => void;
// }

// export default function UserManagement({
//   users,
//   roles,
//   onUsersChange,
//   onRolesChange
// }: UserManagementProps) {
//   const [loading, setLoading] = useState(false);
//   const [showUserModal, setShowUserModal] = useState(false);
//   const [showUserViewModal, setShowUserViewModal] = useState(false);
//   const [editingUser, setEditingUser] = useState<User | null>(null);
//   const [viewingUser, setViewingUser] = useState<User | null>(null);

//   const fetchUsers = async () => {
//     try {
//       setLoading(true);
//       const fetchedUsers = await usersApi.getAll();
//       onUsersChange(fetchedUsers);
//     } catch (error) {
//       console.error('Error fetching users:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchRoles = async () => {
//     try {
//       const fetchedRoles = await rolesApi.getAll();
//       onRolesChange(fetchedRoles);
//     } catch (error) {
//       console.error('Error fetching roles:', error);
//     }
//   };

//   const handleAddUser = () => {
//     setEditingUser(null);
//     setShowUserModal(true);
//   };

//   const handleEditUser = (user: User) => {
//     setEditingUser(user);
//     setShowUserModal(true);
//   };

//   const handleViewUser = (user: User) => {
//     setViewingUser(user);
//     setShowUserViewModal(true);
//   };

//   const handleDeleteUser = async (userId: string) => {
//     if (window.confirm('Are you sure you want to delete this user?')) {
//       try {
//         await usersApi.delete(userId);
//         onUsersChange(users.filter(user => user.id !== userId));
//       } catch (error) {
//         console.error('Error deleting user:', error);
//       }
//     }
//   };

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
//             User Management
//           </h3>
//           <p className="text-gray-600 dark:text-gray-400 mt-1">
//             Manage system users and their access permissions
//           </p>
//         </div>
//         <button
//           onClick={handleAddUser}
//           className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
//         >
//           <PlusIcon className="h-4 w-4" />
//           Add User
//         </button>
//       </div>

//       {/* Users Table */}
//       <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
//             <thead className="bg-gray-50 dark:bg-gray-900">
//               <tr>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   User
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Role
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Type
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Status
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Last Login
//                 </th>
//                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Actions
//                 </th>
//               </tr>
//             </thead>
//             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
//               {/* console.log(users) */}
//               {users.map((user) => (
//                 <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
//                   <td className="px-6 py-4">
//                     <div>
//                       <div className="text-sm font-medium text-gray-900 dark:text-white">
//                         {user.full_name}
//                       </div>
//                       <div className="text-sm text-gray-500 dark:text-gray-400">
//                         {user.email}
//                       </div>
//                     </div>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
//                       {user.role || 'No Role here'}
//                     </span>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <span className={clsx(
//                       'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
//                       user.user_type === 'internal'
//                         ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
//                         : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
//                     )}>
//                       {user.user_type}
//                     </span>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <div className="flex items-center gap-2">
//                       <div className={clsx(
//                         'h-2 w-2 rounded-full',
//                         user.status === 'active' ? 'bg-green-400' : 'bg-red-400'
//                       )} />
//                       <span className="text-sm text-gray-900 dark:text-white capitalize">
//                         {user.status}
//                       </span>
//                     </div>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
//                     {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
//                     <div className="flex items-center justify-end gap-2">
//                       <button
//                         onClick={() => handleViewUser(user)}
//                         className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
//                       >
//                         <EyeIcon className="h-4 w-4" />
//                       </button>
//                       <button
//                         onClick={() => handleEditUser(user)}
//                         className="p-1 text-green-600 hover:text-green-900 dark:text-green-400"
//                       >
//                         <PencilIcon className="h-4 w-4" />
//                       </button>
//                       <button
//                         onClick={() => handleDeleteUser(user.id)}
//                         className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
//                       >
//                         <TrashIcon className="h-4 w-4" />
//                       </button>
//                     </div>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* Add/Edit User Modal */}
//       <UserModal
//         isOpen={showUserModal}
//         onClose={() => {
//           setShowUserModal(false);
//           setEditingUser(null);
//         }}
//         user={editingUser}
//         roles={roles}
//         onSave={(userData) => {
//           if (editingUser) {
//             onUsersChange(users.map(u => u.id === editingUser.id ? { ...u, ...userData } : u));
//           } else {
//             const newUser: User = {
//               id: Date.now().toString(),
//               ...userData,
//               created_at: new Date().toISOString(),
//               updated_at: new Date().toISOString()
//             };
//             onUsersChange([...users, newUser]);
//           }
//           setShowUserModal(false);
//           setEditingUser(null);
//         }}
//       />

//       {/* View User Modal */}
//       <UserViewModal
//         isOpen={showUserViewModal}
//         onClose={() => {
//           setShowUserViewModal(false);
//           setViewingUser(null);
//         }}
//         user={viewingUser}
//       />
//     </div>
//   );
// }

// // User Modal Component
// interface UserModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   user?: User | null;
//   roles: Role[];
//   onSave: (userData: Partial<User>) => void;
// }

// function UserModal({ isOpen, onClose, user, roles, onSave }: UserModalProps) {
//   const [loading, setLoading] = useState(false);
//   const [form, setForm] = useState({
//     username: '',
//     full_name: '',
//     email: '',
//     role_id: '',
//     user_type: 'internal' as 'internal' | 'external',
//     status: 'active'
//   });

//   useEffect(() => {
//     if (user) {
//       setForm({
//         username: user.username,
//         full_name: user.full_name,
//         email: user.email,
//         role_id: user.role_id,
//         user_type: user.user_type,
//         status: user.status
//       });
//     } else {
//       setForm({
//         username: '',
//         full_name: '',
//         email: '',
//         role_id: '',
//         user_type: 'internal',
//         status: 'active'
//       });
//     }
//   }, [user]);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       onSave(form);
//     } catch (error) {
//       console.error('Error saving user:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//       <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
//             {user ? 'Edit User' : 'Add User'}
//           </h2>
//           <button
//             onClick={onClose}
//             className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
//           >
//             <XMarkIcon className="h-6 w-6" />
//           </button>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-4">
//           <div>
//             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//               Username
//             </label>
//             <input
//               type="text"
//               required
//               value={form.username}
//               onChange={(e) => setForm({ ...form, username: e.target.value })}
//               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             />
//           </div>

//           <div>
//             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//               Full Name
//             </label>
//             <input
//               type="text"
//               required
//               value={form.full_name}
//               onChange={(e) => setForm({ ...form, full_name: e.target.value })}
//               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             />
//           </div>

//           <div>
//             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//               Email
//             </label>
//             <input
//               type="email"
//               required
//               value={form.email}
//               onChange={(e) => setForm({ ...form, email: e.target.value })}
//               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             />
//           </div>

//           <div>
//             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//               Role
//             </label>
//             <select
//               value={form.role_id}
//               onChange={(e) => setForm({ ...form, role_id: e.target.value })}
//               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               required
//             >
//               <option value="">Select Role</option>
//               {roles.map((role) => (
//                 <option key={role._id} value={role._id}>
//                   {role.role_name}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div>
//             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//               User Type
//             </label>
//             <select
//               value={form.user_type}
//               onChange={(e) => setForm({ ...form, user_type: e.target.value as 'internal' | 'external' })}
//               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               required
//             >
//               <option value="internal">Internal</option>
//               <option value="external">External</option>
//             </select>
//           </div>

//           <div>
//             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//               Status
//             </label>
//             <select
//               value={form.status}
//               onChange={(e) => setForm({ ...form, status: e.target.value })}
//               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               required
//             >
//               <option value="active">Active</option>
//               <option value="inactive">Inactive</option>
//             </select>
//           </div>

//           <div className="flex gap-3 pt-4">
//             <button
//               type="button"
//               onClick={onClose}
//               className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
//               disabled={loading}
//             >
//               Cancel
//             </button>
//             <button
//               type="submit"
//               className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
//               disabled={loading}
//             >
//               {loading ? 'Saving...' : user ? 'Update User' : 'Add User'}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// // User View Modal Component
// interface UserViewModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   user: User | null;
// }

// function UserViewModal({ isOpen, onClose, user }: UserViewModalProps) {
//   if (!isOpen || !user) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//       <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4">
//         <div className="flex items-center justify-between mb-6">
//           <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
//             User Details
//           </h2>
//           <button
//             onClick={onClose}
//             className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
//           >
//             <XMarkIcon className="h-6 w-6" />
//           </button>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           <div>
//             <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Personal Information</h3>
//             <div className="space-y-3">
//               <div>
//                 <span className="block text-sm text-gray-500 dark:text-gray-400">Full Name</span>
//                 <span className="text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</span>
//               </div>
//               <div>
//                 <span className="block text-sm text-gray-500 dark:text-gray-400">Username</span>
//                 <span className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</span>
//               </div>
//               <div>
//                 <span className="block text-sm text-gray-500 dark:text-gray-400">Email</span>
//                 <span className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</span>
//               </div>
//             </div>
//           </div>

//           <div>
//             <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Account Information</h3>
//             <div className="space-y-3">
//               <div>
//                 <span className="block text-sm text-gray-500 dark:text-gray-400">Role</span>
//                 <span className="text-sm font-medium text-gray-900 dark:text-white">
//                   {user.role?.role_name || 'No Role here'}
//                 </span>
//               </div>
//               <div>
//                 <span className="block text-sm text-gray-500 dark:text-gray-400">User Type</span>
//                 <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
//                   {user.user_type}
//                 </span>
//               </div>
//               <div>
//                 <span className="block text-sm text-gray-500 dark:text-gray-400">Status</span>
//                 <span className={clsx(
//                   'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
//                   user.status === 'active'
//                     ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
//                     : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
//                 )}>
//                   {user.status}
//                 </span>
//               </div>
//             </div>
//           </div>

//           <div>
//             <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Activity</h3>
//             <div className="space-y-3">
//               <div>
//                 <span className="block text-sm text-gray-500 dark:text-gray-400">Last Login</span>
//                 <span className="text-sm font-medium text-gray-900 dark:text-white">
//                   {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
//                 </span>
//               </div>
//               <div>
//                 <span className="block text-sm text-gray-500 dark:text-gray-400">Created</span>
//                 <span className="text-sm font-medium text-gray-900 dark:text-white">
//                   {new Date(user.created_at).toLocaleDateString()}
//                 </span>
//               </div>
//             </div>
//           </div>

//           {user.role?.permissions && (
//             <div>
//               <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Permissions</h3>
//               <div className="max-h-32 overflow-y-auto">
//                 <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
//                   {JSON.stringify(user.role.permissions, null, 2)}
//                 </pre>
//               </div>
//             </div>
//           )}
//         </div>

//         <div className="flex justify-end mt-6">
//           <button
//             onClick={onClose}
//             className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
//           >
//             Close
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }