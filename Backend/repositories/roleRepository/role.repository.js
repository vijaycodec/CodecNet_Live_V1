import Role from "../../models/role.model.js";
import mongoose from "mongoose";

// Basic CRUD operations
export const createRole = async (roleData) => {
  return await Role.create(roleData);
};

export const getRoleById = async (id) => {
  return await Role.findById(id);
};

// export const findRoleById = async (id) => {
//   return await Role.findById(id);
// };
export const findRoleById = async (id) => {
  return await Role.findById(id);
};

export const updateRoleById = async (id, updatedFields, userId = null) => {
  if (userId) {
    updatedFields.updated_by = userId;
  }
  return await Role.findByIdAndUpdate(id, updatedFields, {
    new: true,
    runValidators: true,
  });
};

export const deleteRoleById = async (id) => {
  return await Role.findByIdAndDelete(id);
};

// Soft delete operations
export const softDeleteRole = async (id, deletedBy) => {
  return await Role.findByIdAndUpdate(
    id,
    {
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: deletedBy,
      status: false,
    },
    { new: true }
  );
};

export const restoreRole = async (id, restoredBy) => {
  return await Role.findByIdAndUpdate(
    id,
    {
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      status: true,
      updated_by: restoredBy,
    },
    { new: true }
  );
};

// Query operations
export const findAllRoles = async (includeDeleted = false) => {
  const query = {};

  if (!includeDeleted) {
    query.is_deleted = false;
  }

  return await Role.find(query).sort({ role_name: 1 });
};

export const findActiveRoles = async () => {
  return await Role.findActive();
};

export const findRoleByName = async (roleName) => {
  return await Role.findOne({
    role_name: roleName,
    is_deleted: false,
  });
};

// Permission-related operations
export const findRolesWithPermission = async (
  resource,
  action = null,
  scope = null
) => {
  return await Role.findWithPermission(resource, action, scope);
};

export const addPermissionToRole = async (
  roleId,
  resource,
  action = null,
  scope = null,
  value = true,
  userId = null
) => {
  const role = await Role.findById(roleId);
  if (!role) {
    throw new Error("Role not found");
  }

  role.addPermission(resource, action, scope, value);

  if (userId) {
    role.updated_by = userId;
  }

  return await role.save();
};

export const removePermissionFromRole = async (
  roleId,
  resource,
  action = null,
  scope = null,
  userId = null
) => {
  const role = await Role.findById(roleId);
  if (!role) {
    throw new Error("Role not found");
  }

  role.removePermission(resource, action, scope);

  if (userId) {
    role.updated_by = userId;
  }

  return await role.save();
};

export const updateRolePermissions = async (
  roleId,
  permissions,
  userId = null
) => {
  const updateData = { permissions };

  if (userId) {
    updateData.updated_by = userId;
  }

  return await Role.findByIdAndUpdate(roleId, updateData, {
    new: true,
    runValidators: true,
  });
};

export const checkRoleHasPermission = async (
  roleId,
  resource,
  action,
  scope = null
) => {
  const role = await Role.findById(roleId);
  if (!role) {
    return false;
  }

  return role.hasPermission(resource, action, scope);
};

// Role assignment operations
export const getRoleUsageCount = async (roleId) => {
  const User = mongoose.model("User");
  return await User.countDocuments({
    role_id: roleId,
    is_deleted: false,
  });
};

export const findRolesInUse = async () => {
  const User = mongoose.model("User");

  const rolesInUse = await User.aggregate([
    {
      $match: { is_deleted: false },
    },
    {
      $group: {
        _id: "$role_id",
        userCount: { $sum: 1 },
      },
    },
  ]);

  const roleIds = rolesInUse.map((r) => r._id).filter(Boolean);

  const roles = await Role.find({
    _id: { $in: roleIds },
    is_deleted: false,
  });

  return roles.map((role) => ({
    ...role.toObject(),
    userCount:
      rolesInUse.find((r) => r._id.toString() === role._id.toString())
        ?.userCount || 0,
  }));
};

// Search operations
export const searchRoles = async (searchTerm, limit = 20) => {
  const query = {
    $or: [
      { role_name: { $regex: searchTerm, $options: "i" } },
      { description: { $regex: searchTerm, $options: "i" } },
    ],
    is_deleted: false,
  };

  return await Role.find(query).limit(limit).sort({ role_name: 1 });
};

// Utility functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validateRoleExists = async (id) => {
  const role = await Role.findById(id);
  return !!role && !role.is_deleted;
};

export const checkRoleNameExists = async (roleName, excludeRoleId = null) => {
  const query = {
    role_name: roleName,
    is_deleted: false,
  };

  if (excludeRoleId) {
    query._id = { $ne: excludeRoleId };
  }

  const role = await Role.findOne(query);
  return !!role;
};

// Bulk operations
export const createMultipleRoles = async (rolesData) => {
  return await Role.insertMany(rolesData);
};

export const updateMultipleRoles = async (updates) => {
  const bulkOps = updates.map((update) => ({
    updateOne: {
      filter: { _id: update.id },
      update: update.data,
    },
  }));

  return await Role.bulkWrite(bulkOps);
};

// Permission template operations
export const createRoleWithPermissionTemplate = async (
  roleData,
  permissionTemplate
) => {
  const role = new Role(roleData);

  // Apply permission template
  if (permissionTemplate && typeof permissionTemplate === "object") {
    role.permissions = permissionTemplate;
  }

  return await role.save();
};

export const applyPermissionTemplate = async (
  roleId,
  permissionTemplate,
  userId = null
) => {
  const updateData = { permissions: permissionTemplate };

  if (userId) {
    updateData.updated_by = userId;
  }

  return await Role.findByIdAndUpdate(roleId, updateData, {
    new: true,
    runValidators: true,
  });
};

// Statistics
export const getRoleStatistics = async () => {
  const totalRoles = await Role.countDocuments({ is_deleted: false });
  const activeRoles = await Role.countDocuments({
    is_deleted: false,
    status: true,
  });
  const inactiveRoles = await Role.countDocuments({
    is_deleted: false,
    status: false,
  });

  return {
    totalRoles,
    activeRoles,
    inactiveRoles,
  };
};
