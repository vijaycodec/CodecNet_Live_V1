import Permission from '../../models/permission.model.js';
import mongoose from 'mongoose';

// Basic CRUD operations
export const createPermission = async (permissionData) => {
  return await Permission.create(permissionData);
};

export const findPermissionById = async (id) => {
  return await Permission.findById(id);
};

export const updatePermissionById = async (id, updatedFields, userId = null) => {
  if (userId) {
    updatedFields.updated_by = userId;
  }
  return await Permission.findByIdAndUpdate(id, updatedFields, { 
    new: true,
    runValidators: true 
  });
};

export const deletePermissionById = async (id) => {
  return await Permission.findByIdAndDelete(id);
};

// Query operations
export const findAllPermissions = async () => {
  return await Permission.findActive().sort({ permission_category: 1, permission_name: 1 });
};

export const findPermissionsByCategory = async (category) => {
  return await Permission.findByCategory(category);
};

export const findPermissionsByResource = async (resource) => {
  return await Permission.findByResource(resource);
};

export const findPermissionByKey = async (resource, action, scope = 'own') => {
  return await Permission.findByKey(resource, action, scope);
};

export const findPermissionByName = async (permissionName) => {
  return await Permission.findOne({ 
    permission_name: permissionName,
    status: true 
  });
};

// Permission creation helpers
export const createCRUDPermissions = async (resource, category = 'general', scopes = ['own', 'organisation']) => {
  return await Permission.createCRUDPermissions(resource, category, scopes);
};

export const createResourcePermissions = async (resource, actions, category = 'general', scopes = ['own', 'organisation']) => {
  const permissions = [];
  
  for (const action of actions) {
    for (const scope of scopes) {
      try {
        const permission = await Permission.create({
          resource: resource,
          action: action,
          scope: scope,
          permission_category: category,
          description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource} with ${scope} scope`
        });
        permissions.push(permission);
      } catch (error) {
        // Skip if permission already exists
        if (error.code !== 11000) {
          throw error;
        }
      }
    }
  }
  
  return permissions;
};

// Category management
export const getPermissionCategories = async () => {
  return await Permission.distinct('permission_category', { status: true });
};

export const getPermissionsByCategories = async () => {
  const permissions = await Permission.find({ status: true })
    .sort({ permission_category: 1, permission_name: 1 });
    
  const grouped = {};
  permissions.forEach(permission => {
    if (!grouped[permission.permission_category]) {
      grouped[permission.permission_category] = [];
    }
    grouped[permission.permission_category].push(permission);
  });
  
  return grouped;
};

// Resource and action management
export const getPermissionResources = async () => {
  return await Permission.distinct('resource', { status: true });
};

export const getActionsForResource = async (resource) => {
  return await Permission.distinct('action', { 
    resource: resource,
    status: true 
  });
};

export const getScopesForResourceAction = async (resource, action) => {
  return await Permission.distinct('scope', { 
    resource: resource,
    action: action,
    status: true 
  });
};

// Permission validation
export const validatePermissionKey = async (resource, action, scope) => {
  const permission = await Permission.findByKey(resource, action, scope);
  return !!permission;
};

export const checkPermissionCompatibility = async (permissionId, requiredScope) => {
  const permission = await Permission.findById(permissionId);
  if (!permission) return false;
  
  return permission.isCompatibleWithScope(requiredScope);
};

// Search operations
export const searchPermissions = async (searchTerm, category = null, limit = 20) => {
  const query = {
    $or: [
      { permission_name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { resource: { $regex: searchTerm, $options: 'i' } },
      { action: { $regex: searchTerm, $options: 'i' } }
    ],
    status: true
  };
  
  if (category) {
    query.permission_category = category;
  }
  
  return await Permission.find(query)
    .limit(limit)
    .sort({ permission_category: 1, permission_name: 1 });
};

// Bulk operations
export const createMultiplePermissions = async (permissionsData) => {
  return await Permission.insertMany(permissionsData);
};

export const updatePermissionStatus = async (permissionIds, status, userId = null) => {
  const updateData = { status };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Permission.updateMany(
    { _id: { $in: permissionIds } },
    updateData
  );
};

// Permission templates and presets
export const getStandardPermissionTemplates = () => {
  return {
    admin: {
      users: { create: true, read: true, update: true, delete: true },
      organisations: { create: true, read: true, update: true, delete: true },
      roles: { create: true, read: true, update: true, delete: true },
      permissions: { create: true, read: true, update: true, delete: true },
      tickets: { create: true, read: true, update: true, delete: true },
      assets: { create: true, read: true, update: true, delete: true },
      dashboard: { access: true },
      system: { manage: true }
    },
    manager: {
      users: { create: { organisation: true }, read: { organisation: true }, update: { organisation: true } },
      tickets: { create: true, read: { organisation: true }, update: { organisation: true } },
      assets: { read: { organisation: true }, update: { organisation: true } },
      dashboard: { access: true },
      reports: { read: { organisation: true } }
    },
    analyst: {
      tickets: { create: true, read: { own: true, organisation: true }, update: { own: true } },
      assets: { read: { organisation: true } },
      dashboard: { access: true }
    },
    viewer: {
      tickets: { read: { own: true } },
      assets: { read: { own: true } },
      dashboard: { access: true }
    }
  };
};

export const createPermissionsFromTemplate = async (templateName, customizations = {}) => {
  const templates = getStandardPermissionTemplates();
  const template = templates[templateName];
  
  if (!template) {
    throw new Error(`Template ${templateName} not found`);
  }
  
  // Merge with customizations
  const finalTemplate = { ...template, ...customizations };
  
  const permissions = [];
  for (const [resource, actions] of Object.entries(finalTemplate)) {
    for (const [action, scopes] of Object.entries(actions)) {
      if (typeof scopes === 'boolean' && scopes) {
        // Simple boolean permission
        permissions.push({
          resource,
          action,
          scope: 'own',
          permission_category: getCategoryForResource(resource)
        });
      } else if (typeof scopes === 'object') {
        // Scope-based permissions
        for (const [scope, value] of Object.entries(scopes)) {
          if (value) {
            permissions.push({
              resource,
              action,
              scope,
              permission_category: getCategoryForResource(resource)
            });
          }
        }
      }
    }
  }
  
  return await createMultiplePermissions(permissions);
};

// Helper function to get category for resource
const getCategoryForResource = (resource) => {
  const categoryMap = {
    'users': 'user_management',
    'organisations': 'organisation_management', 
    'roles': 'user_management',
    'permissions': 'system_administration',
    'tickets': 'ticket_management',
    'assets': 'asset_management',
    'dashboard': 'dashboard',
    'reports': 'reporting',
    'system': 'system_administration',
    'api': 'api_access'
  };
  
  return categoryMap[resource] || 'general';
};

// Statistics and reporting
export const getPermissionStatistics = async () => {
  const totalPermissions = await Permission.countDocuments({ status: true });
  const byCategory = await Permission.aggregate([
    { $match: { status: true } },
    { $group: { _id: '$permission_category', count: { $sum: 1 } } }
  ]);
  const byResource = await Permission.aggregate([
    { $match: { status: true } },
    { $group: { _id: '$resource', count: { $sum: 1 } } }
  ]);
  
  return {
    totalPermissions,
    byCategory,
    byResource
  };
};

export const getUnusedPermissions = async () => {
  // This would require checking against Role model to see which permissions are actually used
  const Role = mongoose.model('Role');
  
  const rolesWithPermissions = await Role.find({ status: true }).select('permissions');
  const usedPermissionKeys = new Set();
  
  rolesWithPermissions.forEach(role => {
    if (role.permissions && typeof role.permissions === 'object') {
      extractPermissionKeys(role.permissions, usedPermissionKeys);
    }
  });
  
  const allPermissions = await Permission.find({ status: true });
  const unusedPermissions = allPermissions.filter(permission => {
    const key = `${permission.resource}:${permission.action}:${permission.scope}`;
    return !usedPermissionKeys.has(key);
  });
  
  return unusedPermissions;
};

// Helper function to extract permission keys from role permissions object
const extractPermissionKeys = (permissions, keySet, resourcePrefix = '') => {
  for (const [key, value] of Object.entries(permissions)) {
    const fullKey = resourcePrefix ? `${resourcePrefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      extractPermissionKeys(value, keySet, fullKey);
    } else if (value === true) {
      keySet.add(fullKey);
    }
  }
};

// Validation functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validatePermissionExists = async (id) => {
  const permission = await Permission.findById(id);
  return !!permission && permission.status;
};

export const checkPermissionNameExists = async (permissionName, excludeId = null) => {
  const query = { 
    permission_name: permissionName,
    status: true 
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const permission = await Permission.findOne(query);
  return !!permission;
};

export const checkResourceActionScopeExists = async (resource, action, scope, excludeId = null) => {
  const query = { 
    resource,
    action,
    scope,
    status: true 
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const permission = await Permission.findOne(query);
  return !!permission;
};

// Export aliases for compatibility
export const getPermissionById = findPermissionById;
export const findActivePermissions = findAllPermissions;