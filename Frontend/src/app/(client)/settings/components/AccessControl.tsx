'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  LockClosedIcon,
  KeyIcon,
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { Role, Permission } from '../types';

import RoleForm from '../modal/RoleForm';
import PermissionForm from '../modal/PermissionForm';

interface AccessControlProps {
  roles: Role[];
  permissions: Permission[];
  onRolesChange: (roles: Role[]) => void;
  onPermissionsChange: (permissions: Permission[]) => void;
}

export default function AccessControl({
  roles,
  permissions,
  onRolesChange,
  onPermissionsChange
}: AccessControlProps) {
  const [activeTab, setActiveTab] = useState('roles');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Tab configuration
  const tabs = [
    { id: 'roles', name: 'Roles', icon: UserGroupIcon },
    { id: 'permissions', name: 'Permissions', icon: KeyIcon }
  ];

  const handleAdd = (type: string) => {
    setEditingItem(null);
    setShowModal(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleDelete = async (type: string, id: string | number) => {
    if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
      try {
        if (type === 'role') {
          // Call API to delete role
          const api = await import('@/lib/api');
          await api.rolesApi.deleteRole(id as string);
          // Update local state after successful deletion
          onRolesChange(roles.filter(role => role._id !== id));
        } else if (type === 'permission') {
          // Call API to delete permission
          const api = await import('@/lib/api');
          await api.permissionsApi.deletePermission(id as string);
          // Update local state after successful deletion
          onPermissionsChange(permissions.filter(permission => permission._id !== id));
        }
      } catch (error) {
        console.error(`Error deleting ${type}:`, error);
        alert(`Failed to delete ${type}. Please try again.`);
      }
    }
  };

  const renderRoles = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">Roles</h4>
        <button
          onClick={() => handleAdd('role')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Role
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div key={role._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <UserGroupIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {role.role_name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {role.description || 'No description'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(role)}
                  className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete('role', role._id)}
                  className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <span className={clsx(
                  'px-2 py-1 rounded-full text-xs font-medium',
                  role.status
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                )}>
                  {role.status ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">Permissions:</span>
                <div className="mt-1 max-h-20 overflow-y-auto">
                  <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {Object.keys(role.permissions).length > 0
                      ? Object.keys(role.permissions).join(', ')
                      : 'No permissions assigned'
                    }
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPermissions = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">Permissions</h4>
        <button
          onClick={() => handleAdd('permission')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Permission
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {permissions.map((permission) => (
          <div key={permission._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <KeyIcon className="h-6 w-6 text-purple-600" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {permission.resource}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Resource: {permission.resource}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(permission)}
                  className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete('permission', permission._id)}
                  className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {permission.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {permission.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                <span
                  key={permission.action}
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                >
                  {permission.action}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'roles':
        return renderRoles();
      case 'permissions':
        return renderPermissions();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Access Control
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage roles, and permissions for system resources
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
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
      <div>
        {renderActiveTab()}
      </div>

      {/* Generic Modal */}
      {showModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header with Gradient */}
            <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    {activeTab === 'roles' ? (
                      <UserGroupIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <KeyIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {editingItem ? 'Edit' : 'Add'} {activeTab === 'roles' ? 'Role' : 'Permission'}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {editingItem ? 'Update' : 'Create a new'} {activeTab === 'roles' ? 'role with permissions' : 'permission'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-200"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-800/30">
            {activeTab === 'roles' && (
              <RoleForm
                initialData={editingItem}
                onClose={() => setShowModal(false)}
                onRoleUpdate={(updatedOrNewRole) => {
                  if (editingItem) {
                    onRolesChange(roles.map(r => r._id === updatedOrNewRole._id ? updatedOrNewRole : r));
                  } else {
                    onRolesChange([...roles, updatedOrNewRole]);
                  }
                  setShowModal(false);
                }}
              />
            )}
            {activeTab === 'permissions' && (
              <PermissionForm
                initialData={editingItem}
                onClose={() => setShowModal(false)}
                onPermissionUpdate={(updatedOrNewPermission) => {
                  if (editingItem) {
                    onPermissionsChange(permissions.map(p => p._id === updatedOrNewPermission._id ? updatedOrNewPermission : p));
                  } else {
                    onPermissionsChange([...permissions, updatedOrNewPermission]);
                  }
                  setShowModal(false);
                }}
              />
            )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}











// 'use client';

// import { useState, useEffect } from 'react';
// import {
//   LockClosedIcon,
//   KeyIcon,
//   UserGroupIcon,
//   PlusIcon,
//   TrashIcon,
//   PencilIcon,
//   EyeIcon,
//   XMarkIcon
// } from '@heroicons/react/24/outline';
// import { clsx } from 'clsx';
// import { AccessRule, Role, Permission } from '../types';

// import AccessRuleForm from '../modal/AccessRuleForm';
// import RoleForm from '../modal/RoleForm';
// import PermissionForm from '../modal/PermissionForm';

// interface AccessControlProps {
//   accessRules: AccessRule[];
//   roles: Role[];
//   permissions: Permission[];
//   onAccessRulesChange: (rules: AccessRule[]) => void;
//   onRolesChange: (roles: Role[]) => void;
//   onPermissionsChange: (permissions: Permission[]) => void;
// }

// export default function AccessControl({
//   accessRules,
//   roles,
//   permissions,
//   onAccessRulesChange,
//   onRolesChange,
//   onPermissionsChange
// }: AccessControlProps) {
//   const [activeTab, setActiveTab] = useState('access-rules');
//   const [showModal, setShowModal] = useState(false);
//   const [editingItem, setEditingItem] = useState<any>(null);

//   // Tab configuration
//   const tabs = [
//     { id: 'access-rules', name: 'Access Rules', icon: LockClosedIcon },
//     { id: 'roles', name: 'Roles', icon: UserGroupIcon },
//     { id: 'permissions', name: 'Permissions', icon: KeyIcon }
//   ];

//   const handleAdd = (type: string) => {
//     setEditingItem(null);
//     setShowModal(true);
//   };

//   const handleEdit = (item: any) => {
//     setEditingItem(item);
//     setShowModal(true);
//   };

//   const handleDelete = (type: string, id: string | number) => {
//     if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
//       if (type === 'rule') {
//         onAccessRulesChange(accessRules.filter(rule => rule._id !== id));
//       } else if (type === 'role') {
//         onRolesChange(roles.filter(role => role._id !== id));
//       } else if (type === 'permission') {
//         onPermissionsChange(permissions.filter(permission => permission._id !== id));
//       }
//     }
//   };

//   const renderAccessRules = () => (
//     <div className="space-y-4">
//       <div className="flex justify-between items-center">
//         <h4 className="text-lg font-medium text-gray-900 dark:text-white">Access Rules</h4>
//         <button
//           onClick={() => handleAdd('rule')}
//           className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
//         >
//           <PlusIcon className="h-4 w-4" />
//           Add Rule
//         </button>
//       </div>

//       <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
//             <thead className="bg-gray-50 dark:bg-gray-900">
//               <tr>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Rule Name
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Type
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Resource
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Status
//                 </th>
//                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
//                   Actions
//                 </th>
//               </tr>
//             </thead>
//             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
//               {accessRules.map((rule) => (
//                 <tr key={rule._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
//                   <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
//                     {rule.name}
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <span className={clsx(
//                       'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
//                       rule.type === 'allow'
//                         ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
//                         : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
//                     )}>
//                       {rule.type.toUpperCase()}
//                     </span>
//                   </td>
//                   <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
//                     {rule.resource}
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <div className="flex items-center gap-2">
//                       <div className={clsx(
//                         'h-2 w-2 rounded-full',
//                         rule.enabled ? 'bg-green-400' : 'bg-gray-400'
//                       )} />
//                       <span className="text-sm text-gray-900 dark:text-white">
//                         {rule.enabled ? 'Active' : 'Disabled'}
//                       </span>
//                     </div>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
//                     <div className="flex items-center justify-end gap-2">
//                       <button
//                         onClick={() => handleEdit(rule)}
//                         className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
//                       >
//                         <PencilIcon className="h-4 w-4" />
//                       </button>
//                       <button
//                         onClick={() => handleDelete('rule', rule._id)}
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
//     </div>
//   );

//   const renderRoles = () => (
//     <div className="space-y-4">
//       <div className="flex justify-between items-center">
//         <h4 className="text-lg font-medium text-gray-900 dark:text-white">Roles</h4>
//         <button
//           onClick={() => handleAdd('role')}
//           className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
//         >
//           <PlusIcon className="h-4 w-4" />
//           Add Role
//         </button>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//         {roles.map((role) => (
//           <div key={role._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
//             <div className="flex items-center justify-between mb-4">
//               <div className="flex items-center gap-3">
//                 <UserGroupIcon className="h-8 w-8 text-blue-600" />
//                 <div>
//                   <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
//                     {role.role_name}
//                   </h3>
//                   <p className="text-sm text-gray-500 dark:text-gray-400">
//                     {role.description || 'No description'}
//                   </p>
//                 </div>
//               </div>
//               <div className="flex gap-1">
//                 <button
//                   onClick={() => handleEdit(role)}
//                   className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
//                 >
//                   <PencilIcon className="h-4 w-4" />
//                 </button>
//                 <button
//                   onClick={() => handleDelete('role', role._id)}
//                   className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
//                 >
//                   <TrashIcon className="h-4 w-4" />
//                 </button>
//               </div>
//             </div>

//             <div className="space-y-2">
//               <div className="flex items-center justify-between text-sm">
//                 <span className="text-gray-500 dark:text-gray-400">Status:</span>
//                 <span className={clsx(
//                   'px-2 py-1 rounded-full text-xs font-medium',
//                   role.status
//                     ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
//                     : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
//                 )}>
//                   {role.status ? 'Active' : 'Inactive'}
//                 </span>
//               </div>
//               <div className="text-sm">
//                 <span className="text-gray-500 dark:text-gray-400">Permissions:</span>
//                 <div className="mt-1 max-h-20 overflow-y-auto">
//                   <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
//                     {Object.keys(role.permissions).length > 0
//                       ? Object.keys(role.permissions).join(', ')
//                       : 'No permissions assigned'
//                     }
//                   </pre>
//                 </div>
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
//   // console.log(permissions)
//   const renderPermissions = () => (
//     <div className="space-y-4">
//       <div className="flex justify-between items-center">
//         <h4 className="text-lg font-medium text-gray-900 dark:text-white">Permissions</h4>
//         <button
//           onClick={() => handleAdd('permission')}
//           className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
//         >
//           <PlusIcon className="h-4 w-4" />
//           Add Permission
//         </button>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         {permissions.map((permission) => (
//           <div key={permission._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
//             <div className="flex items-center justify-between mb-4">
//               <div className="flex items-center gap-3">
//                 <KeyIcon className="h-6 w-6 text-purple-600" />
//                 <div>
//                   <h3 className="text-base font-semibold text-gray-900 dark:text-white">
//                     {permission.resource}
//                   </h3>
//                   <p className="text-sm text-gray-500 dark:text-gray-400">
//                     Resource: {permission.resource}
//                   </p>
//                 </div>
//               </div>
//               <div className="flex gap-1">
//                 <button
//                   onClick={() => handleEdit(permission)}
//                   className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
//                 >
//                   <PencilIcon className="h-4 w-4" />
//                 </button>
//                 <button
//                   onClick={() => handleDelete('permission', permission._id)}
//                   className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
//                 >
//                   <TrashIcon className="h-4 w-4" />
//                 </button>
//               </div>
//             </div>

//             <div className="space-y-2">
//               {permission.description && (
//                 <p className="text-sm text-gray-600 dark:text-gray-400">
//                   {permission.description}
//                 </p>
//               )}
//               <div className="flex flex-wrap gap-1">
//                 {/* {(permission.action || []).map((action) => ( */}
//                 <span
//                   key={permission.action}
//                   className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
//                 >
//                   {permission.action}
//                 </span>
//                 {/* ))} */}
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );

//   const renderActiveTab = () => {
//     switch (activeTab) {
//       case 'access-rules':
//         return renderAccessRules();
//       case 'roles':
//         return renderRoles();
//       case 'permissions':
//         return renderPermissions();
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div>
//         <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
//           Access Control
//         </h3>
//         <p className="text-gray-600 dark:text-gray-400 mt-1">
//           Manage access rules, roles, and permissions for system resources
//         </p>
//       </div>

//       {/* Tab Navigation */}
//       <div className="border-b border-gray-200 dark:border-gray-700">
//         <nav className="-mb-px flex space-x-8">
//           {tabs.map((tab) => {
//             const Icon = tab.icon;
//             return (
//               <button
//                 key={tab.id}
//                 onClick={() => setActiveTab(tab.id)}
//                 className={clsx(
//                   'flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
//                   activeTab === tab.id
//                     ? 'border-blue-500 text-blue-600 dark:text-blue-400'
//                     : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
//                 )}
//               >
//                 <Icon className="h-5 w-5" />
//                 {tab.name}
//               </button>
//             );
//           })}
//         </nav>
//       </div>

//       {/* Active Tab Content */}
//       <div>
//         {renderActiveTab()}
//       </div>

//       {/* Generic Modal - You can customize this based on the active tab and editing state */}
//       {showModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
//             <div className="flex items-center justify-between mb-4">
//               <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
//                 {editingItem ? 'Edit' : 'Add'} {activeTab === 'access-rules' ? 'Rule' : activeTab === 'roles' ? 'Role' : 'Permission'}
//               </h2>
//               <button
//                 onClick={() => setShowModal(false)}
//                 className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
//               >
//                 <XMarkIcon className="h-6 w-6" />
//               </button>
//             </div>
//             {/* Render the correct form based on activeTab */}
//             {activeTab === 'access-rules' && (
//               <AccessRuleForm
//                 initialData={editingItem}
//                 onSubmit={(data: AccessRule) => {
//                   if (editingItem) {
//                     onAccessRulesChange(accessRules.map(rule => rule._id === data._id ? data : rule));
//                   } else {
//                     onAccessRulesChange([...accessRules, data]);
//                   }
//                   setShowModal(false);
//                 }}
//                 onCancel={() => setShowModal(false)}
//               />
//             )}
//             {activeTab === 'roles' && (
//               <RoleForm
//                 initialData={editingItem}
//                 onClose={() => setShowModal(false)}
//                 onRoleUpdate={(updatedOrNewRole) => {
//                   if (editingItem) {
//                     onRolesChange(roles.map(r => r._id === updatedOrNewRole._id ? updatedOrNewRole : r));
//                   } else {
//                     onRolesChange([...roles, updatedOrNewRole]);
//                   }
//                   setShowModal(false);
//                 }}
//               />
//             )}
//             {activeTab === 'permissions' && (
//               <PermissionForm
//                 initialData={editingItem}
//                 onSubmit={(data: Permission) => {
//                   if (editingItem) {
//                     onPermissionsChange(permissions.map(permission => permission._id === data._id ? data : permission));
//                   } else {
//                     onPermissionsChange([...permissions, data]);
//                   }
//                   setShowModal(false);
//                 }}
//                 onCancel={() => setShowModal(false)}
//               />
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }











// // 'use client';

// // import { useState, useEffect } from 'react';
// // import {
// //   LockClosedIcon,
// //   KeyIcon,
// //   UserGroupIcon,
// //   PlusIcon,
// //   TrashIcon,
// //   PencilIcon,
// //   EyeIcon,
// //   XMarkIcon
// // } from '@heroicons/react/24/outline';
// // import { clsx } from 'clsx';
// // import { AccessRule, Role, Permission } from '../types';

// // import AccessRuleForm from '../modal/AccessRuleForm';
// // import RoleForm from '../modal/RoleForm';
// // import PermissionForm from '../modal/PermissionForm';

// // interface AccessControlProps {
// //   accessRules: AccessRule[];
// //   roles: Role[];
// //   permissions: Permission[];
// //   onAccessRulesChange: (rules: AccessRule[]) => void;
// //   onRolesChange: (roles: Role[]) => void;
// //   onPermissionsChange: (permissions: Permission[]) => void;
// // }

// // export default function AccessControl({
// //   accessRules,
// //   roles,
// //   permissions,
// //   onAccessRulesChange,
// //   onRolesChange,
// //   onPermissionsChange
// // }: AccessControlProps) {
// //   const [activeTab, setActiveTab] = useState('access-rules');
// //   const [showModal, setShowModal] = useState(false);
// //   const [editingItem, setEditingItem] = useState<any>(null);

// //   // Tab configuration
// //   const tabs = [
// //     { id: 'access-rules', name: 'Access Rules', icon: LockClosedIcon },
// //     { id: 'roles', name: 'Roles', icon: UserGroupIcon },
// //     { id: 'permissions', name: 'Permissions', icon: KeyIcon }
// //   ];

// //   const handleAdd = (type: string) => {
// //     setEditingItem(null);
// //     setShowModal(true);
// //   };

// //   const handleEdit = (item: any) => {
// //     setEditingItem(item);
// //     setShowModal(true);
// //   };

// //   const handleDelete = (type: string, id: string | number) => {
// //     if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
// //       if (type === 'rule') {
// //         onAccessRulesChange(accessRules.filter(rule => rule._id !== id));
// //       } else if (type === 'role') {
// //         onRolesChange(roles.filter(role => role._id !== id));
// //       } else if (type === 'permission') {
// //         onPermissionsChange(permissions.filter(permission => permission._id !== id));
// //       }
// //     }
// //   };

// //   const renderAccessRules = () => (
// //     <div className="space-y-4">
// //       <div className="flex justify-between items-center">
// //         <h4 className="text-lg font-medium text-gray-900 dark:text-white">Access Rules</h4>
// //         <button
// //           onClick={() => handleAdd('rule')}
// //           className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
// //         >
// //           <PlusIcon className="h-4 w-4" />
// //           Add Rule
// //         </button>
// //       </div>

// //       <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
// //         <div className="overflow-x-auto">
// //           <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
// //             <thead className="bg-gray-50 dark:bg-gray-900">
// //               <tr>
// //                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
// //                   Rule Name
// //                 </th>
// //                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
// //                   Type
// //                 </th>
// //                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
// //                   Resource
// //                 </th>
// //                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
// //                   Status
// //                 </th>
// //                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
// //                   Actions
// //                 </th>
// //               </tr>
// //             </thead>
// //             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
// //               {accessRules.map((rule) => (
// //                 <tr key={rule._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
// //                   <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
// //                     {rule.name}
// //                   </td>
// //                   <td className="px-6 py-4 whitespace-nowrap">
// //                     <span className={clsx(
// //                       'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
// //                       rule.type === 'allow'
// //                         ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
// //                         : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
// //                     )}>
// //                       {rule.type.toUpperCase()}
// //                     </span>
// //                   </td>
// //                   <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
// //                     {rule.resource}
// //                   </td>
// //                   <td className="px-6 py-4 whitespace-nowrap">
// //                     <div className="flex items-center gap-2">
// //                       <div className={clsx(
// //                         'h-2 w-2 rounded-full',
// //                         rule.enabled ? 'bg-green-400' : 'bg-gray-400'
// //                       )} />
// //                       <span className="text-sm text-gray-900 dark:text-white">
// //                         {rule.enabled ? 'Active' : 'Disabled'}
// //                       </span>
// //                     </div>
// //                   </td>
// //                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
// //                     <div className="flex items-center justify-end gap-2">
// //                       <button
// //                         onClick={() => handleEdit(rule)}
// //                         className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
// //                       >
// //                         <PencilIcon className="h-4 w-4" />
// //                       </button>
// //                       <button
// //                         onClick={() => handleDelete('rule', rule._id)}
// //                         className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
// //                       >
// //                         <TrashIcon className="h-4 w-4" />
// //                       </button>
// //                     </div>
// //                   </td>
// //                 </tr>
// //               ))}
// //             </tbody>
// //           </table>
// //         </div>
// //       </div>
// //     </div>
// //   );

// //   const renderRoles = () => (
// //     <div className="space-y-4">
// //       <div className="flex justify-between items-center">
// //         <h4 className="text-lg font-medium text-gray-900 dark:text-white">Roles</h4>
// //         <button
// //           onClick={() => handleAdd('role')}
// //           className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
// //         >
// //           <PlusIcon className="h-4 w-4" />
// //           Add Role
// //         </button>
// //       </div>

// //       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
// //         {roles.map((role) => (
// //           <div key={role._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
// //             <div className="flex items-center justify-between mb-4">
// //               <div className="flex items-center gap-3">
// //                 <UserGroupIcon className="h-8 w-8 text-blue-600" />
// //                 <div>
// //                   <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
// //                     {role.role_name}
// //                   </h3>
// //                   <p className="text-sm text-gray-500 dark:text-gray-400">
// //                     {role.description || 'No description'}
// //                   </p>
// //                 </div>
// //               </div>
// //               <div className="flex gap-1">
// //                 <button
// //                   onClick={() => handleEdit(role)}
// //                   className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
// //                 >
// //                   <PencilIcon className="h-4 w-4" />
// //                 </button>
// //                 <button
// //                   onClick={() => handleDelete('role', role._id)}
// //                   className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
// //                 >
// //                   <TrashIcon className="h-4 w-4" />
// //                 </button>
// //               </div>
// //             </div>

// //             <div className="space-y-2">
// //               <div className="flex items-center justify-between text-sm">
// //                 <span className="text-gray-500 dark:text-gray-400">Status:</span>
// //                 <span className={clsx(
// //                   'px-2 py-1 rounded-full text-xs font-medium',
// //                   role.status
// //                     ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
// //                     : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
// //                 )}>
// //                   {role.status ? 'Active' : 'Inactive'}
// //                 </span>
// //               </div>
// //               <div className="text-sm">
// //                 <span className="text-gray-500 dark:text-gray-400">Permissions:</span>
// //                 <div className="mt-1 max-h-20 overflow-y-auto">
// //                   <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
// //                     {Object.keys(role.permissions).length > 0
// //                       ? Object.keys(role.permissions).join(', ')
// //                       : 'No permissions assigned'
// //                     }
// //                   </pre>
// //                 </div>
// //               </div>
// //             </div>
// //           </div>
// //         ))}
// //       </div>
// //     </div>
// //   );
// //   // console.log(permissions)
// //   const renderPermissions = () => (
// //     <div className="space-y-4">
// //       <div className="flex justify-between items-center">
// //         <h4 className="text-lg font-medium text-gray-900 dark:text-white">Permissions</h4>
// //         <button
// //           onClick={() => handleAdd('permission')}
// //           className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
// //         >
// //           <PlusIcon className="h-4 w-4" />
// //           Add Permission
// //         </button>
// //       </div>

// //       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
// //         {permissions.map((permission) => (
// //           <div key={permission._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
// //             <div className="flex items-center justify-between mb-4">
// //               <div className="flex items-center gap-3">
// //                 <KeyIcon className="h-6 w-6 text-purple-600" />
// //                 <div>
// //                   <h3 className="text-base font-semibold text-gray-900 dark:text-white">
// //                     {permission.resource}
// //                   </h3>
// //                   <p className="text-sm text-gray-500 dark:text-gray-400">
// //                     Resource: {permission.resource}
// //                   </p>
// //                 </div>
// //               </div>
// //               <div className="flex gap-1">
// //                 <button
// //                   onClick={() => handleEdit(permission)}
// //                   className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400"
// //                 >
// //                   <PencilIcon className="h-4 w-4" />
// //                 </button>
// //                 <button
// //                   onClick={() => handleDelete('permission', permission._id)}
// //                   className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
// //                 >
// //                   <TrashIcon className="h-4 w-4" />
// //                 </button>
// //               </div>
// //             </div>

// //             <div className="space-y-2">
// //               {permission.description && (
// //                 <p className="text-sm text-gray-600 dark:text-gray-400">
// //                   {permission.description}
// //                 </p>
// //               )}
// //               <div className="flex flex-wrap gap-1">
// //                 {/* {(permission.action || []).map((action) => ( */}
// //                 <span
// //                   key={permission.action}
// //                   className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
// //                 >
// //                   {permission.action}
// //                 </span>
// //                 {/* ))} */}
// //               </div>
// //             </div>
// //           </div>
// //         ))}
// //       </div>
// //     </div>
// //   );

// //   const renderActiveTab = () => {
// //     switch (activeTab) {
// //       case 'access-rules':
// //         return renderAccessRules();
// //       case 'roles':
// //         return renderRoles();
// //       case 'permissions':
// //         return renderPermissions();
// //       default:
// //         return null;
// //     }
// //   };

// //   return (
// //     <div className="space-y-6">
// //       {/* Header */}
// //       <div>
// //         <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
// //           Access Control
// //         </h3>
// //         <p className="text-gray-600 dark:text-gray-400 mt-1">
// //           Manage access rules, roles, and permissions for system resources
// //         </p>
// //       </div>

// //       {/* Tab Navigation */}
// //       <div className="border-b border-gray-200 dark:border-gray-700">
// //         <nav className="-mb-px flex space-x-8">
// //           {tabs.map((tab) => {
// //             const Icon = tab.icon;
// //             return (
// //               <button
// //                 key={tab.id}
// //                 onClick={() => setActiveTab(tab.id)}
// //                 className={clsx(
// //                   'flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
// //                   activeTab === tab.id
// //                     ? 'border-blue-500 text-blue-600 dark:text-blue-400'
// //                     : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
// //                 )}
// //               >
// //                 <Icon className="h-5 w-5" />
// //                 {tab.name}
// //               </button>
// //             );
// //           })}
// //         </nav>
// //       </div>

// //       {/* Active Tab Content */}
// //       <div>
// //         {renderActiveTab()}
// //       </div>

// //       {/* Generic Modal - You can customize this based on the active tab and editing state */}
// //       {showModal && (
// //         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
// //           <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
// //             <div className="flex items-center justify-between mb-4">
// //               <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
// //                 {editingItem ? 'Edit' : 'Add'} {activeTab === 'access-rules' ? 'Rule' : activeTab === 'roles' ? 'Role' : 'Permission'}
// //               </h2>
// //               <button
// //                 onClick={() => setShowModal(false)}
// //                 className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
// //               >
// //                 <XMarkIcon className="h-6 w-6" />
// //               </button>
// //             </div>
// //             {/* Render the correct form based on activeTab */}
// //             {activeTab === 'access-rules' && (
// //               <AccessRuleForm
// //                 initialData={editingItem}
// //                 onSubmit={(data: AccessRule) => {
// //                   if (editingItem) {
// //                     onAccessRulesChange(accessRules.map(rule => rule._id === data._id ? data : rule));
// //                   } else {
// //                     onAccessRulesChange([...accessRules, data]);
// //                   }
// //                   setShowModal(false);
// //                 }}
// //                 onCancel={() => setShowModal(false)}
// //               />
// //             )}
// //             {activeTab === 'roles' && (
// //               <RoleForm
// //                 role={editingItem}
// //                 onSave={data => {
// //                   if (editingItem) {
// //                     onRolesChange(roles.map(role => role._id === data._id ? data : role));
// //                   } else {
// //                     onRolesChange([...roles, data]);
// //                   }
// //                   setShowModal(false);
// //                 }}
// //                 onCancel={() => setShowModal(false)}
// //               />
// //             )}
// //             {activeTab === 'permissions' && (
// //               <PermissionForm
// //                 initialData={editingItem}
// //                 onSubmit={(data: Permission) => {
// //                   if (editingItem) {
// //                     onPermissionsChange(permissions.map(permission => permission._id === data._id ? data : permission));
// //                   } else {
// //                     onPermissionsChange([...permissions, data]);
// //                   }
// //                   setShowModal(false);
// //                 }}
// //                 onCancel={() => setShowModal(false)}
// //               />
// //             )}
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // }