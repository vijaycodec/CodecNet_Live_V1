import React, { useState, useEffect, FormEvent } from 'react';
import Cookies from 'js-cookie';
import { Permission } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

// --- Component Props ---
interface PermissionFormProps {
    initialData?: Permission | null;
    onClose: () => void;
    onPermissionUpdate: (permission: Permission) => void;
}

const PermissionForm: React.FC<PermissionFormProps> = ({ initialData, onClose, onPermissionUpdate }) => {
    // --- State Management ---
    const [resource, setResource] = useState('');
    const [action, setAction] = useState('read');
    const [scope, setScope] = useState('own');
    const [description, setDescription] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = !!initialData;

    // --- State Initialization ---
    useEffect(() => {
        if (initialData) {
            setResource(initialData.resource || '');
            setAction(initialData.action || 'read');
            setScope(initialData.scope || 'own');
            setDescription(initialData.description || '');
        } else {
            // Reset for "Add New"
            setResource('');
            setAction('read');
            setScope('own');
            setDescription('');
        }
    }, [initialData]);

    // --- Event Handlers ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const token = Cookies.get('auth_token');
        if (!token) {
            setError("Authentication token not found. Please log in.");
            setIsLoading(false);
            return;
        }

        // Automatically construct permission_name from other fields
        const permission_name = `${resource}:${action}:${scope}`;

        const payload = {
            permission_name,
            resource,
            action,
            scope,
            description
        };

        // Note: Editing functionality would require a PUT request and a different URL
        const url = `${API_BASE_URL}/permissions/create`;
        const method = 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `Failed to create permission.`);
            }

            alert(`Permission created successfully!`);
            onPermissionUpdate(result.permission || result.data); // Pass back the created permission
            onClose();

        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred during submission.');
        } finally {
            setIsLoading(false);
        }
    };

    // --- JSX Rendering ---
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl mr-3">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    Permission Details
                </h3>
                <div className="space-y-4">
                    {/* Resource */}
                    <div>
                        <label htmlFor="resource" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resource *</label>
                        <input
                            id="resource"
                            type="text"
                            value={resource}
                            onChange={(e) => setResource(e.target.value)}
                            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                            placeholder="e.g., users, tickets"
                            required
                        />
                    </div>

                    {/* Action */}
                    <div>
                        <label htmlFor="action" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Action *</label>
                        <select
                            id="action"
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                        >
                            <option value="create">Create</option>
                            <option value="read">Read</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="manage">Manage</option>
                            <option value="execute">Execute</option>
                            <option value="access">Access</option>
                        </select>
                    </div>

                    {/* Scope */}
                    <div>
                        <label htmlFor="scope" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scope *</label>
                        <select
                            id="scope"
                            value={scope}
                            onChange={(e) => setScope(e.target.value)}
                            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                        >
                            <option value="own">Own</option>
                            <option value="organisation">Organisation</option>
                            <option value="all">All</option>
                            <option value="none">None</option>
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                            placeholder="A brief description of what this permission allows"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
                    disabled={isLoading}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-6 py-3 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-2 border-blue-600 hover:border-blue-700 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    disabled={isLoading}
                >
                    {isLoading ? 'Saving...' : (isEditing ? 'Update Permission' : 'Create Permission')}
                </button>
            </div>
        </form>
    );
};

export default PermissionForm;










// import React, { useState, useEffect, FormEvent } from 'react';
// import Cookies from 'js-cookie';
// import { Permission } from '../types';

// // --- Component Props ---
// interface PermissionFormProps {
//     initialData?: Permission | null;
//     onClose: () => void;
//     onPermissionUpdate: (permission: Permission) => void;
// }

// const PermissionForm: React.FC<PermissionFormProps> = ({ initialData, onClose, onPermissionUpdate }) => {
//     // --- State Management ---
//     const [resource, setResource] = useState('');
//     const [action, setAction] = useState('read');
//     const [scope, setScope] = useState('own');
//     const [description, setDescription] = useState('');

//     const [isLoading, setIsLoading] = useState(false);
//     const [error, setError] = useState<string | null>(null);

//     const isEditing = !!initialData;

//     // --- State Initialization ---
//     useEffect(() => {
//         if (initialData) {
//             setResource(initialData.resource || '');
//             setAction(initialData.action || 'read');
//             setScope(initialData.scope || 'own');
//             setDescription(initialData.description || '');
//         } else {
//             // Reset for "Add New"
//             setResource('');
//             setAction('read');
//             setScope('own');
//             setDescription('');
//         }
//     }, [initialData]);

//     // --- Event Handlers ---
//     const handleSubmit = async (e: FormEvent) => {
//         e.preventDefault();
//         setIsLoading(true);
//         setError(null);

//         const token = Cookies.get('auth_token');
//         if (!token) {
//             setError("Authentication token not found. Please log in.");
//             setIsLoading(false);
//             return;
//         }

//         // Automatically construct permission_name from other fields
//         const permission_name = `${resource}:${action}:${scope}`;

//         const payload = {
//             permission_name,
//             resource,
//             action,
//             scope,
//             description
//         };

//         // Note: Editing functionality would require a PUT request and a different URL
//         const url = 'http://localhost:5000/api/permissions/create';
//         const method = 'POST';

//         try {
//             const response = await fetch(url, {
//                 method: method,
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'Authorization': `Bearer ${token}`
//                 },
//                 body: JSON.stringify(payload)
//             });

//             const result = await response.json();

//             if (!response.ok) {
//                 throw new Error(result.message || `Failed to create permission.`);
//             }

//             alert(`Permission created successfully!`);
//             onPermissionUpdate(result.permission || result.data); // Pass back the created permission
//             onClose();

//         } catch (err: any) {
//             setError(err.message || 'An unexpected error occurred during submission.');
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     // --- JSX Rendering ---
//     return (
//         <form onSubmit={handleSubmit}>
//             {/* Resource */}
//             <div className="mb-4">
//                 <label htmlFor="resource" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resource</label>
//                 <input
//                     id="resource"
//                     type="text"
//                     value={resource}
//                     onChange={(e) => setResource(e.target.value)}
//                     className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                     placeholder="e.g., users, tickets"
//                     required
//                 />
//             </div>

//             {/* Action */}
//             <div className="mb-4">
//                 <label htmlFor="action" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
//                 <select
//                     id="action"
//                     value={action}
//                     onChange={(e) => setAction(e.target.value)}
//                     className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                     <option value="create">Create</option>
//                     <option value="read">Read</option>
//                     <option value="update">Update</option>
//                     <option value="delete">Delete</option>
//                     <option value="manage">Manage</option>
//                     <option value="execute">Execute</option>
//                     <option value="access">Access</option>
//                 </select>
//             </div>

//             {/* Scope */}
//             <div className="mb-4">
//                 <label htmlFor="scope" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope</label>
//                 <select
//                     id="scope"
//                     value={scope}
//                     onChange={(e) => setScope(e.target.value)}
//                     className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                     <option value="own">Own</option>
//                     <option value="organisation">Organisation</option>
//                     <option value="all">All</option>
//                     <option value="none">None</option>
//                 </select>
//             </div>

//             {/* Description */}
//             <div className="mb-6">
//                 <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
//                 <textarea
//                     id="description"
//                     value={description}
//                     onChange={(e) => setDescription(e.target.value)}
//                     rows={3}
//                     className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                     placeholder="A brief description of what this permission allows"
//                 />
//             </div>

//             {error && <div className="text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-300 p-3 rounded-md mb-4 text-sm">{error}</div>}

//             {/* Form Actions */}
//             <div className="flex justify-end gap-3 pt-4">
//                 <button
//                     type="button"
//                     onClick={onClose}
//                     className="flex-1 sm:flex-none px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
//                     disabled={isLoading}
//                 >
//                     Cancel
//                 </button>
//                 <button
//                     type="submit"
//                     className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
//                     disabled={isLoading}
//                 >
//                     {isLoading ? 'Saving...' : (isEditing ? 'Update Permission' : 'Create Permission')}
//                 </button>
//             </div>
//         </form>
//     );
// };

// export default PermissionForm;










// // import React, { useState } from 'react';
// // import { Role, Permission, AccessRule } from '../types';

// // interface PermissionFormProps {
// //     initialData?: Permission | null;
// //     onSubmit: (data: Permission) => void;
// //     onCancel: () => void;
// // }

// // export default function PermissionForm({ initialData, onSubmit, onCancel }: PermissionFormProps) {
// //     const [name, setName] = useState(initialData?.name || '');
// //     const [resource, setResource] = useState(initialData?.resource || '');
// //     const [description, setDescription] = useState(initialData?.description || '');
// //     const [actions, setActions] = useState<string[]>(initialData?.actions || []);

// //     function handleAddAction(action: string) {
// //         if (action && !actions.includes(action)) {
// //             setActions([...actions, action]);
// //         }
// //     }

// //     function handleRemoveAction(action: string) {
// //         setActions(actions.filter(a => a !== action));
// //     }

// //     function handleSubmit(e: React.FormEvent) {
// //         e.preventDefault();
// //         onSubmit({
// //             _id: initialData?._id || Date.now().toString(),
// //             name,
// //             resource,
// //             description,
// //             actions,
// //             created_at: initialData?.created_at || new Date().toISOString(),
// //             updated_at: new Date().toISOString(),
// //         });
// //     }

// //     const [newAction, setNewAction] = useState('');

// //     return (
// //         <form onSubmit={handleSubmit} className="space-y-4 bg-gray-900 p-6 rounded-lg shadow-lg">
// //             <div>
// //                 <label className="block text-sm font-medium text-gray-200">Permission Name</label>
// //                 <input
// //                     className="w-full border border-gray-700 bg-gray-800 text-gray-100 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //                     value={name}
// //                     onChange={e => setName(e.target.value)}
// //                     required
// //                 />
// //             </div>
// //             <div>
// //                 <label className="block text-sm font-medium text-gray-200">Resource</label>
// //                 <input
// //                     className="w-full border border-gray-700 bg-gray-800 text-gray-100 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //                     value={resource}
// //                     onChange={e => setResource(e.target.value)}
// //                     required
// //                 />
// //             </div>
// //             <div>
// //                 <label className="block text-sm font-medium text-gray-200">Description</label>
// //                 <input
// //                     className="w-full border border-gray-700 bg-gray-800 text-gray-100 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //                     value={description}
// //                     onChange={e => setDescription(e.target.value)}
// //                 />
// //             </div>
// //             <div>
// //                 <label className="block text-sm font-medium text-gray-200">Actions</label>
// //                 <div className="flex gap-2 mb-2">
// //                     <input
// //                         className="flex-1 border border-gray-700 bg-gray-800 text-gray-100 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
// //                         value={newAction}
// //                         onChange={e => setNewAction(e.target.value)}
// //                         placeholder="Add action"
// //                     />
// //                     <button
// //                         type="button"
// //                         className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
// //                         onClick={() => {
// //                             handleAddAction(newAction.trim());
// //                             setNewAction('');
// //                         }}
// //                     >
// //                         Add
// //                     </button>
// //                 </div>
// //                 <div className="flex flex-wrap gap-2">
// //                     {actions.map(action => (
// //                         <span key={action} className="bg-blue-900 text-blue-100 px-2 py-1 rounded flex items-center">
// //                             {action}
// //                             <button
// //                                 type="button"
// //                                 className="ml-1 text-red-400 hover:text-red-600"
// //                                 onClick={() => handleRemoveAction(action)}
// //                             >
// //                                 ×
// //                             </button>
// //                         </span>
// //                     ))}
// //                 </div>
// //             </div>
// //             <div className="flex gap-2">
// //                 <button
// //                     type="button"
// //                     onClick={onCancel}
// //                     className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600"
// //                 >
// //                     Cancel
// //                 </button>
// //                 <button
// //                     type="submit"
// //                     className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800"
// //                 >
// //                     Save
// //                 </button>
// //             </div>
// //         </form>
// //     );
// // }