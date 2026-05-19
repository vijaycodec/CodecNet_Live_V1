import React, { useState, useEffect, FormEvent } from 'react';
import Cookies from 'js-cookie';
import { Role, Permission } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

// --- Helper Types ---
interface GroupedPermissions {
    [resource: string]: Permission[];
}

interface SelectedPermissions {
    [resource: string]: {
        [action: string]: boolean;
    };
}

// --- Component Props ---
interface RoleFormProps {
    initialData?: Role | null;
    onClose: () => void;
    onRoleUpdate: (role: Role) => void;
}

const RoleForm: React.FC<RoleFormProps> = ({ initialData, onClose, onRoleUpdate }) => {
    // --- State Management ---
    const [roleName, setRoleName] = useState('');
    const [description, setDescription] = useState('');
    const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({});
    const [selectedPermissions, setSelectedPermissions] = useState<SelectedPermissions>({});

    const [isLoading, setIsLoading] = useState(true); // Start with loading true
    const [error, setError] = useState<string | null>(null);

    const isEditing = !!initialData;

    // --- Data Fetching & State Initialization ---
    useEffect(() => {
        const fetchAndSetPermissions = async () => {
            setIsLoading(true);
            setError(null);
            const token = Cookies.get('auth_token');

            if (!token) {
                setError("Authentication token not found. Please log in.");
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/permissions/all`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch permissions.');
                }

                const result = await response.json();
                const allPermissions: Permission[] = result.data || [];

                // Group permissions by resource for the UI
                const grouped = allPermissions.reduce((acc, permission) => {
                    const { resource } = permission;
                    if (!acc[resource]) acc[resource] = [];
                    acc[resource].push(permission);
                    return acc;
                }, {} as GroupedPermissions);
                setGroupedPermissions(grouped);

                // --- Initialize Checkboxes ---
                // 1. Create a base state with all available permissions set to false
                const baseSelection = allPermissions.reduce((acc, p) => {
                    if (!acc[p.resource]) acc[p.resource] = {};
                    acc[p.resource][p.action] = false;
                    return acc;
                }, {} as SelectedPermissions);

                // 2. If editing, overlay the role's existing permissions
                if (initialData?.permissions) {
                    for (const resource in initialData.permissions) {
                        if (baseSelection[resource]) {
                            for (const action in initialData.permissions[resource]) {
                                if (baseSelection[resource].hasOwnProperty(action)) {
                                    baseSelection[resource][action] = true;
                                }
                            }
                        }
                    }
                }
                setSelectedPermissions(baseSelection);

                // 3. Set other form fields if editing
                if (initialData) {
                    setRoleName(initialData.role_name);
                    setDescription(initialData.description || '');
                } else {
                    // Reset for "Add New"
                    setRoleName('');
                    setDescription('');
                }

            } catch (err: any) {
                setError(err.message || 'An unexpected error occurred.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndSetPermissions();
    }, [initialData]);

    // --- Event Handlers ---
    const handlePermissionChange = (resource: string, action: string) => {
        setSelectedPermissions(prev => ({
            ...prev,
            [resource]: {
                ...prev[resource],
                [action]: !prev[resource][action]
            }
        }));
    };

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

        // Filter permissions to only include true values
        const finalPermissions: SelectedPermissions = {};
        for (const resource in selectedPermissions) {
            const actions = selectedPermissions[resource];
            const enabledActions: { [action: string]: boolean } = {};
            for (const action in actions) {
                if (actions[action] === true) {
                    enabledActions[action] = true;
                }
            }
            if (Object.keys(enabledActions).length > 0) {
                finalPermissions[resource] = enabledActions;
            }
        }

        const payload = {
            role_name: roleName,
            description: description,
            permissions: finalPermissions
        };

        const url = isEditing
            ? `${API_BASE_URL}/roles/update/${initialData?._id}`
            : `${API_BASE_URL}/roles/create`;
        const method = isEditing ? 'PUT' : 'POST';

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
                throw new Error(result.message || `Failed to ${isEditing ? 'update' : 'create'} role.`);
            }

            alert(`Role ${isEditing ? 'updated' : 'created'} successfully!`);
            onRoleUpdate(result.role || result.data); // Pass back the created/updated role
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
            {/* Role Name and Description */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl mr-3">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    Basic Information
                </h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="roleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role Name *</label>
                        <input
                            id="roleName"
                            type="text"
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                            placeholder="e.g., Administrator"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                            placeholder="Describe the role's purpose"
                        />
                    </div>
                </div>
            </div>

            {/* Permissions Section */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl mr-3">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    Permissions
                </h3>
                {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading permissions...</p>}

                {!isLoading && !error && (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {Object.entries(groupedPermissions).map(([resource, perms]) => (
                            <div key={resource} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                                <h4 className="font-semibold capitalize text-gray-900 dark:text-white mb-3">{resource.replace(/_/g, ' ')}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {perms.map(permission => (
                                        <div key={permission._id} className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id={permission._id}
                                                checked={selectedPermissions[resource]?.[permission.action] || false}
                                                onChange={() => handlePermissionChange(permission.resource, permission.action)}
                                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500"
                                            />
                                            <label htmlFor={permission._id} className="ml-2 block text-sm text-gray-900 dark:text-gray-300 capitalize">
                                                {permission.action}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
                    {isLoading ? 'Saving...' : (isEditing ? 'Update Role' : 'Create Role')}
                </button>
            </div>
        </form>
    );
};

export default RoleForm;











// import React, { useState, useEffect, FormEvent } from 'react';
// import Cookies from 'js-cookie';
// import { Role, Permission } from '../types';

// // --- Helper Types ---
// interface GroupedPermissions {
//     [resource: string]: Permission[];
// }

// interface SelectedPermissions {
//     [resource: string]: {
//         [action: string]: boolean;
//     };
// }

// // --- Component Props ---
// interface RoleFormProps {
//     initialData?: Role | null;
//     onClose: () => void;
//     onRoleUpdate: (role: Role) => void;
// }

// const RoleForm: React.FC<RoleFormProps> = ({ initialData, onClose, onRoleUpdate }) => {
//     // --- State Management ---
//     const [roleName, setRoleName] = useState('');
//     const [description, setDescription] = useState('');
//     const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({});
//     const [selectedPermissions, setSelectedPermissions] = useState<SelectedPermissions>({});

//     const [isLoading, setIsLoading] = useState(true); // Start with loading true
//     const [error, setError] = useState<string | null>(null);

//     const isEditing = !!initialData;

//     // --- Data Fetching & State Initialization ---
//     useEffect(() => {
//         const fetchAndSetPermissions = async () => {
//             setIsLoading(true);
//             setError(null);
//             const token = Cookies.get('auth_token');

//             if (!token) {
//                 setError("Authentication token not found. Please log in.");
//                 setIsLoading(false);
//                 return;
//             }

//             try {
//                 const response = await fetch('http://localhost:5000/api/permissions/all', {
//                     headers: { 'Authorization': `Bearer ${token}` }
//                 });

//                 if (!response.ok) {
//                     throw new Error('Failed to fetch permissions.');
//                 }

//                 const result = await response.json();
//                 const allPermissions: Permission[] = result.data || [];

//                 // Group permissions by resource for the UI
//                 const grouped = allPermissions.reduce((acc, permission) => {
//                     const { resource } = permission;
//                     if (!acc[resource]) acc[resource] = [];
//                     acc[resource].push(permission);
//                     return acc;
//                 }, {} as GroupedPermissions);
//                 setGroupedPermissions(grouped);

//                 // --- Initialize Checkboxes ---
//                 // 1. Create a base state with all available permissions set to false
//                 const baseSelection = allPermissions.reduce((acc, p) => {
//                     if (!acc[p.resource]) acc[p.resource] = {};
//                     acc[p.resource][p.action] = false;
//                     return acc;
//                 }, {} as SelectedPermissions);

//                 // 2. If editing, overlay the role's existing permissions
//                 if (initialData?.permissions) {
//                     for (const resource in initialData.permissions) {
//                         if (baseSelection[resource]) {
//                             for (const action in initialData.permissions[resource]) {
//                                 if (baseSelection[resource].hasOwnProperty(action)) {
//                                     baseSelection[resource][action] = true;
//                                 }
//                             }
//                         }
//                     }
//                 }
//                 setSelectedPermissions(baseSelection);

//                 // 3. Set other form fields if editing
//                 if (initialData) {
//                     setRoleName(initialData.role_name);
//                     setDescription(initialData.description || '');
//                 } else {
//                     // Reset for "Add New"
//                     setRoleName('');
//                     setDescription('');
//                 }

//             } catch (err: any) {
//                 setError(err.message || 'An unexpected error occurred.');
//             } finally {
//                 setIsLoading(false);
//             }
//         };

//         fetchAndSetPermissions();
//     }, [initialData]);

//     // --- Event Handlers ---
//     const handlePermissionChange = (resource: string, action: string) => {
//         setSelectedPermissions(prev => ({
//             ...prev,
//             [resource]: {
//                 ...prev[resource],
//                 [action]: !prev[resource][action]
//             }
//         }));
//     };

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

//         // Filter permissions to only include true values
//         const finalPermissions: SelectedPermissions = {};
//         for (const resource in selectedPermissions) {
//             const actions = selectedPermissions[resource];
//             const enabledActions: { [action: string]: boolean } = {};
//             for (const action in actions) {
//                 if (actions[action] === true) {
//                     enabledActions[action] = true;
//                 }
//             }
//             if (Object.keys(enabledActions).length > 0) {
//                 finalPermissions[resource] = enabledActions;
//             }
//         }

//         const payload = {
//             role_name: roleName,
//             description: description,
//             permissions: finalPermissions
//         };

//         const url = isEditing
//             ? `http://localhost:5000/api/roles/update/${initialData?._id}`
//             : 'http://localhost:5000/api/roles/create';
//         const method = isEditing ? 'PUT' : 'POST';

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
//                 throw new Error(result.message || `Failed to ${isEditing ? 'update' : 'create'} role.`);
//             }

//             alert(`Role ${isEditing ? 'updated' : 'created'} successfully!`);
//             onRoleUpdate(result.role || result.data); // Pass back the created/updated role
//             onClose();

//         } catch (err: any) {
//             setError(err.message || 'An unexpected error occurred during submission.');
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     // --- JSX Rendering ---
//     return (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
//             <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
//                 <div className="flex justify-between items-center border-b pb-3 mb-4">
//                     <h2 className="text-xl font-semibold text-gray-800">{isEditing ? 'Edit Role' : 'Add New Role'}</h2>
//                     <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
//                 </div>

//                 <form onSubmit={handleSubmit}>
//                     {/* Role Name and Description */}
//                     <div className="mb-4">
//                         <label htmlFor="roleName" className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
//                         <input
//                             id="roleName"
//                             type="text"
//                             value={roleName}
//                             onChange={(e) => setRoleName(e.target.value)}
//                             className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
//                             required
//                         />
//                     </div>
//                     <div className="mb-6">
//                         <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
//                         <textarea
//                             id="description"
//                             value={description}
//                             onChange={(e) => setDescription(e.target.value)}
//                             rows={3}
//                             className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
//                         />
//                     </div>

//                     {/* Permissions Section */}
//                     <div className="mb-6">
//                         <h3 className="text-lg font-medium text-gray-800 border-b pb-2 mb-3">Permissions</h3>
//                         {isLoading && <p>Loading permissions...</p>}

//                         {!isLoading && !error && (
//                             <div className="space-y-4">
//                                 {Object.entries(groupedPermissions).map(([resource, perms]) => (
//                                     <div key={resource} className="border rounded-md p-3">
//                                         <h4 className="font-semibold capitalize text-gray-700">{resource.replace(/_/g, ' ')}</h4>
//                                         <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
//                                             {perms.map(permission => (
//                                                 <div key={permission._id} className="flex items-center">
//                                                     <input
//                                                         type="checkbox"
//                                                         id={permission._id}
//                                                         checked={selectedPermissions[resource]?.[permission.action] || false}
//                                                         onChange={() => handlePermissionChange(permission.resource, permission.action)}
//                                                         className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
//                                                     />
//                                                     <label htmlFor={permission._id} className="ml-2 block text-sm text-gray-900 capitalize">
//                                                         {permission.action}
//                                                     </label>
//                                                 </div>
//                                             ))}
//                                         </div>
//                                     </div>
//                                 ))}
//                             </div>
//                         )}
//                     </div>

//                     {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4 text-sm">{error}</div>}

//                     {/* Form Actions */}
//                     <div className="flex justify-end gap-3 pt-4 border-t">
//                         <button
//                             type="button"
//                             onClick={onClose}
//                             className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
//                             disabled={isLoading}
//                         >
//                             Cancel
//                         </button>
//                         <button
//                             type="submit"
//                             className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
//                             disabled={isLoading}
//                         >
//                             {isLoading ? 'Saving...' : (isEditing ? 'Update Role' : 'Create Role')}
//                         </button>
//                     </div>
//                 </form>
//             </div>
//         </div>
//     );
// };

// export default RoleForm;
