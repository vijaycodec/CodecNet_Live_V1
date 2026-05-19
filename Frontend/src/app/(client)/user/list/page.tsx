'use client';

import React, { useEffect, useState } from 'react';
import {
  UsersIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import Cookies from 'js-cookie';
import PermissionGuard from '@/components/auth/PermissionGuard';

const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP

interface ClientUser {
  firstName: string;
  lastName: string;
  clientName: string;
  email: string;
  phoneNumber: number | string;
  role: string;     // role.name (display) or role_id (for submit)
  level: string;
  is_active: boolean;
  client_id: string;
  role_id: string;
}

const UserList = () => {
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [editingUser, setEditingUser] = useState<ClientUser | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Form state for controlled inputs
  const [formFields, setFormFields] = useState({
    firstName: '',
    lastName: '',
    clientName: '',
    email: '',
    phoneNumber: '',
    role: '',
    level: '',
    is_active: false as boolean | string,
    password: '',
  });

  // Fetch users (use independently, so can be re-called)
  const fetchUsers = async () => {
    try {
      const token = Cookies.get('auth_token');
      const res = await fetch(`${BASE_URL}/users/all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await res.json();
      if (res.ok && result.success) {
        const mappedUsers = result.data.map((user: any) => ({
          firstName: user.firstName,
          lastName: user.lastName,
          clientName: user.clientName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role.name || '',      // show name
          level: user.level || '',
          is_active: user.is_active,
          client_id: user._id,
          role_id: user.role._id,          // for update
        }));

        setClientUsers(mappedUsers);
      } else {
        console.error('Failed to fetch users:', result.message);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // When edit is clicked, sync state for modal
  const handleEditClick = (user: ClientUser) => {
    setEditingUser(user);
    setFormFields({
      firstName: user.firstName,
      lastName: user.lastName,
      clientName: user.clientName,
      email: user.email,
      phoneNumber: String(user.phoneNumber),
      role: user.role_id, // Needs to submit role_id!
      level: user.level || '',
      is_active: user.is_active,
      password: '',       // Ask user to enter new password, or keep blank
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  // Controlled input change handler
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target as any;
    setFormFields(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Submit update request
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Validation for required fields (example: password can be required)
    if (!formFields.password) {
      alert('Password is required to update user!');
      return;
    }

    try {
      const token = Cookies.get('auth_token');

      const res = await fetch(
        `${BASE_URL}/users/update/${editingUser.client_id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            firstName: formFields.firstName,
            lastName: formFields.lastName,
            clientName: formFields.clientName,
            email: formFields.email,
            phoneNumber: formFields.phoneNumber,
            password: formFields.password,
            role: formFields.role,     // Must be role_id!
            level: formFields.level,
            is_active: formFields.is_active === true || formFields.is_active === "true",
          }),
        }
      );

      const result = await res.json();
      if (res.ok && result.success) {
        setShowModal(false);
        setEditingUser(null);
        await fetchUsers();
      } else {
        alert(result.message || 'Failed to update user');
      }
    } catch (err) {
      alert('Error updating user');
      console.error(err);
    }
  };

  // Inside your UserList component, add this function:

  const handleDelete = async (client_id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this user?');
    if (!confirmed) return;

    try {
      const token = Cookies.get('auth_token');
      const res = await fetch(`${BASE_URL}/users/delete/${client_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await res.json();
      if (res.ok && result.success) {
        alert('User deleted successfully.');
        fetchUsers();   // Refresh list after delete
      } else {
        alert(result.message || 'Failed to delete user.');
      }
    } catch (err) {
      alert('Error deleting user.');
      console.error(err);
    }
  };


  return (
    <div className="p-6 space-y-6">
      <div className="mb-4 flex items-center space-x-2">
        <UsersIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Client Users
        </h1>
      </div>

      <div className="overflow-x-auto rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-left">Client</th>
              <th className="px-4 py-2 text-left">Level</th>
              <th className="px-4 py-2 text-left">Role ID</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {clientUsers.map((user, index) => (
              <tr key={index} className="text-gray-800 dark:text-gray-200">
                <td className="px-4 py-2">{user.firstName + " " + user.lastName}</td>
                <td className="px-4 py-2">{user.email}</td>
                <td className="px-4 py-2">{user.phoneNumber}</td>
                <td className="px-4 py-2">{user.clientName}</td>
                <td className="px-4 py-2">{user.level}</td>
                <td className="px-4 py-2">{user.role}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className='rounded-full text-xs font-medium flex items-center gap-1'>
                    <button title="View">
                      <EyeIcon className="h-5 w-5 text-blue-600 hover:text-blue-400" />
                    </button>
                    <button title="Edit" onClick={() => handleEditClick(user)}>
                      <PencilIcon className="h-5 w-5 text-green-600 hover:text-green-700" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => handleDelete(user.client_id)}
                    >
                      <TrashIcon className="h-5 w-5 text-red-600 hover:text-red-800" />
                    </button>

                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-gray-900 p-6 rounded-xl w-[500px] shadow-lg relative">
            <button className="absolute top-4 right-4 text-white hover:text-gray-400" onClick={handleCloseModal}>
              <XMarkIcon className="h-6 w-6" />
            </button>
            <h2 className="text-white text-2xl font-bold mb-4">Edit User</h2>
            <form className="space-y-4" onSubmit={handleFormSubmit}>
              <div className="flex gap-4">
                <input
                  className="w-1/2 px-4 py-2 rounded-md bg-gray-800 text-white"
                  name="firstName"
                  value={formFields.firstName}
                  onChange={handleFormChange}
                  placeholder="First Name"
                  required
                />
                <input
                  className="w-1/2 px-4 py-2 rounded-md bg-gray-800 text-white"
                  name="lastName"
                  value={formFields.lastName}
                  onChange={handleFormChange}
                  placeholder="Last Name"
                  required
                />
              </div>
              <input
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white"
                name="email"
                value={formFields.email}
                onChange={handleFormChange}
                placeholder="Email"
                required
              />
              <input
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white"
                name="phoneNumber"
                value={formFields.phoneNumber}
                onChange={handleFormChange}
                placeholder="Phone"
                required
              />
              <input
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white"
                name="clientName"
                value={formFields.clientName}
                onChange={handleFormChange}
                placeholder="Client Name"
                required
              />
              <input
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-gray-400"
                name="role"
                value={formFields.role}
                placeholder="Role ID"
                required
                readOnly
                disabled
              />
              <input
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white"
                name="level"
                value={formFields.level}
                onChange={handleFormChange}
                placeholder="Level (optional)"
              />
              <input
                type="password"
                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white"
                name="password"
                value={formFields.password}
                onChange={handleFormChange}
                placeholder="Password (required)"
                required
              />
              <label className="text-white flex items-center gap-2">
                Is Active
                <input
                  type="checkbox"
                  name="is_active"
                  checked={!!formFields.is_active}
                  onChange={handleFormChange}
                  className="ml-2"
                />
              </label>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-semibold"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// PATCH 22: Permission-based access control for User Management
export default function ProtectedUserList() {
  return (
    <PermissionGuard requiredPermissions={['user:read']}>
      <UserList />
    </PermissionGuard>
  );
}