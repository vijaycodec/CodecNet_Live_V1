'use client';

import React, { useEffect, useState } from 'react';
import AddRoleForm from '../../role/add/page';

import {
    UserGroupIcon,
    EyeIcon,
    PencilIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import PermissionGuard from '@/components/auth/PermissionGuard';

interface ClientUser {
    role: string;
    level: string;
    is_active: boolean;
    permissions?: string; // Added for permissions
}

const RoleList = () => {
    const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
    const [editingUser, setEditingUser] = useState<ClientUser | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isAddModalOpen, setAddModalOpen] = useState(false);



    useEffect(() => {
        const fetchUsers = async () => {
            const data: ClientUser[] = [
                {
                    role: 'Admin',
                    level: 'L2',
                    is_active: true,
                    permissions: 'Read, Write'
                },
                {
                    role: 'Viewer',
                    level: 'L1',
                    is_active: false,
                    permissions: 'Read'
                },
            ];
            setClientUsers(data);
        };

        fetchUsers();
    }, []);

    const handleEditClick = (user: ClientUser) => {
        setEditingUser(user);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingUser(null);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="mb-4 flex items-center space-x-2">
                <UserGroupIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">User Role</h1>
            </div>
            <div className="flex justify-between items-center mt-4 mb-2">

                <button
                    onClick={() => setAddModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                >
                    Add User Role
                </button>
            </div>


            <div className="overflow-x-auto rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        <tr>
                            <th className="px-4 py-2 text-left w-1/3">User Role</th>
                            <th className="px-4 py-2 text-left w-1/2">Permission</th>
                            <th className="px-2 py-2 text-center w-1/6">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {clientUsers.map((user, index) => (
                            <tr key={index} className="text-gray-800 dark:text-gray-200">
                                <td className="px-4 py-2">{user.role}</td>
                                <td className="px-4 py-2">{user.permissions || 'N/A'}</td>
                                <td className="px-2 py-2">
                                    <div className="flex justify-center gap-2">
                                        <button title="View">
                                            <EyeIcon className="h-4 w-4 text-blue-600 hover:text-blue-800" />
                                        </button>
                                        <button title="Edit" onClick={() => handleEditClick(user)}>
                                            <PencilIcon className="h-4 w-4 text-green-600 hover:text-green-800" />
                                        </button>
                                        <button title="Delete">
                                            <TrashIcon className="h-4 w-4 text-red-600 hover:text-red-800" />
                                        </button>
                                    </div>
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
                        <h2 className="text-white text-2xl font-bold mb-4">Edit User Role Info</h2>
                        <form className="space-y-4">
                            <input
                                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white"
                                defaultValue={editingUser.role}
                                placeholder="User Role"
                            />
                            <input
                                className="w-full px-4 py-2 rounded-md bg-gray-800 text-white"
                                defaultValue={editingUser.permissions}
                                placeholder="Permissions"
                            />
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-semibold">
                                Save Changes
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {isAddModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full relative">
                        <button
                            onClick={() => setAddModalOpen(false)}
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>

                        <AddRoleForm />
                    </div>
                </div>
            )}

        </div>
    );
};

// PATCH 23: Permission-based access control for Role Management (singular form: role:read)
export default function ProtectedRoleList() {
    return (
        <PermissionGuard requiredPermissions={['role:read']}>
            <RoleList />
        </PermissionGuard>
    );
}
