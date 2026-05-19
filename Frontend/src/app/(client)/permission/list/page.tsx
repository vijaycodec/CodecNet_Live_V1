'use client';

import React, { useEffect, useState } from 'react';
import AddUserForm from '@/app/(client)/permission/add/page';

import {
    LockClosedIcon,
    EyeIcon,
    PencilIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import PermissionGuard from '@/components/auth/PermissionGuard';

interface ClientUser {
    permission: string;
    phoneNumber: number;
    password: string;
    role: string;
    level: string;
    is_active: boolean;
}

const UserList = () => {
    const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
    const [editingUser, setEditingUser] = useState<ClientUser | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);


    useEffect(() => {
        const fetchUsers = async () => {
            // SECURITY FIX: Removed hardcoded demo passwords
            const data: ClientUser[] = [
                {
                    permission: 'Client',
                    phoneNumber: 9871111222,
                    password: '***', // Password should be fetched from backend or set by user
                    role: '68874c0cbb43bw9a1f241',
                    level: 'L1',
                    is_active: true,
                },
                {
                    permission: 'Manager',
                    phoneNumber: 9873333233,
                    password: '***', // Password should be fetched from backend or set by user
                    role: '68874c0cbb43bw9a1f241',
                    level: 'L1',
                    is_active: false,
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

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setShowModal(false);
        setEditingUser(null);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="mb-4 flex items-center space-x-2">
                <LockClosedIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Permissions</h1>
            </div>
            <div className="flex justify-between items-center mt-4 mb-2">

                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                >
                    Add Permission
                </button>
            </div>


            <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full table-fixed border-collapse divide-y divide-gray-100 dark:divide-gray-500">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        <tr>
                            <th className="w-3/4 px-4 py-2 text-left font-semibold">Permission</th>
                            <th className="w-1/4 px-2 py-2 text-center font-semibold">Actions</th>
                        </tr>
                    </thead>

                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {clientUsers.map((user, index) => (
                            <tr
                                key={index}
                                className="text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <td className="px-4 py-2 capitalize align-middle">{user.permission}</td>
                                <td className="px-2 py-2 align-middle">
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


            {/* EDIT PERMISSION MODAL */}
            {showModal && editingUser && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center">
                    <div className="bg-gray-900 p-6 rounded-xl w-[500px] shadow-lg relative">
                        <button
                            className="absolute top-4 right-4 text-white hover:text-gray-400"
                            onClick={handleCloseModal}
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                        <h2 className="text-white text-2xl font-bold mb-6">Edit Permission</h2>
                        <form className="space-y-4" onSubmit={handleSave}>
                            <div>
                                <label className="block text-sm text-gray-300 mb-1">Permission</label>
                                <input
                                    className="w-full px-4 py-2 rounded-md bg-gray-800 text-white"
                                    defaultValue={editingUser.permission}
                                />
                            </div>
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

            {/* ✅ FIXED: ADD PERMISSION MODAL placed outside */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center">
                    <div className="bg-gray-900 p-6 rounded-xl w-[500px] shadow-lg relative">
                        <button
                            className="absolute top-4 right-4 text-white hover:text-gray-400"
                            onClick={() => setShowAddModal(false)}
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                        <AddUserForm />
                    </div>
                </div>
            )}

        </div>
    );
};

// PATCH 24: Permission-based access control for Permission Management (singular form: permission:read)
export default function ProtectedPermissionList() {
    return (
        <PermissionGuard requiredPermissions={['permission:read']}>
            <UserList />
        </PermissionGuard>
    );
}
