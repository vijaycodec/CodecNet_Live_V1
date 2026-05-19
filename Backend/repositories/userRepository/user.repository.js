import User from "../../models/user.model.js";
import Role from "../../models/role.model.js";
import Organisation from "../../models/organisation.model.js";
import mongoose from "mongoose";

// Basic CRUD operations
export const createUser = async (userData) => {
  return await User.create(userData);
};

export const findUserById = async (id, populateFields = []) => {
  let query = User.findById(id);

  // Handle population
  if (populateFields.length > 0) {
    populateFields.forEach((field) => {
      query = query.populate(field);
    });
  }

  return await query;
};

export const findUserByEmail = async (email) => {
  return await User.findOne({ email: email.toLowerCase() });
};

export const findUserByUsername = async (username) => {
  return await User.findOne({ username: username.toLowerCase() });
};

export const updateUserById = async (id, updatedFields, userId = null) => {
  // SECURITY: Whitelist allowed fields
  const allowedFields = [
    'full_name', 'phone_number', 'timezone', 'locale',
    'notification_preferences', 'avatar_url', 'status',
    'updated_by', 'last_login_at', 'last_activity_at',
    'last_login_ip', 'failed_login_attempts', 'locked_until',
    'must_change_password', 'two_factor_enabled', 'two_factor_secret',
    'backup_codes', 'is_deleted', 'deleted_at', 'deleted_by', 'deletion_reason'
  ];

  // SECURITY: Restricted fields (handled by dedicated functions)
  const restrictedFields = ['role_id', 'organisation_id', 'username', 'email', 'password_hash', 'user_type'];

  // Filter out fields not in whitelist
  const filteredFields = {};
  for (const key in updatedFields) {
    if (allowedFields.includes(key)) {
      filteredFields[key] = updatedFields[key];
    } else if (restrictedFields.includes(key)) {
      console.warn(`[SECURITY] Attempted to update restricted field '${key}' via updateUserById`);
    }
  }

  if (userId) {
    filteredFields.updated_by = userId;
  }

  return await User.findByIdAndUpdate(id, filteredFields, {
    new: true,
    runValidators: true,
  });
};

// SECURITY: Dedicated function for updating user role (requires user:update:all permission)
export const updateUserRole = async (id, role_id, updatedBy) => {
  return await User.findByIdAndUpdate(
    id,
    { role_id, updated_by: updatedBy },
    { new: true, runValidators: true }
  );
};

// SECURITY: Dedicated function for updating user email (requires user:update:all permission)
export const updateUserEmail = async (id, email, updatedBy) => {
  return await User.findByIdAndUpdate(
    id,
    { email: email.toLowerCase(), updated_by: updatedBy },
    { new: true, runValidators: true }
  );
};

// SECURITY: Dedicated function for updating username (requires user:update:all permission)
export const updateUserUsername = async (id, username, updatedBy) => {
  return await User.findByIdAndUpdate(
    id,
    { username: username.toLowerCase(), updated_by: updatedBy },
    { new: true, runValidators: true }
  );
};

// SECURITY: Dedicated function for updating organisation (requires user:update:all permission)
export const updateUserOrganisation = async (id, organisation_id, updatedBy) => {
  return await User.findByIdAndUpdate(
    id,
    { organisation_id, updated_by: updatedBy },
    { new: true, runValidators: true }
  );
};

export const deleteUserById = async (id) => {
  return await User.findByIdAndDelete(id);
};

// Soft delete operations
export const softDeleteUser = async (id, deletedBy, reason = null) => {
  return await User.findByIdAndUpdate(
    id,
    {
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: deletedBy,
      deletion_reason: reason,
      status: "deleted",
    },
    { new: true }
  );
};

export const restoreUser = async (id, restoredBy) => {
  return await User.findByIdAndUpdate(
    id,
    {
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
      status: "active",
      updated_by: restoredBy,
    },
    { new: true }
  );
};

// Query operations
// export const findAllUsers = async (
//   organisationId = null,
//   includeDeleted = false
// ) => {
//   const query = {};

//   if (organisationId) {
//     query.organisation_id = organisationId;
//   }

//   if (!includeDeleted) {
//     query.is_deleted = false;
//   }

//   return await User.find(query)
//     // .populate('organisation_id', 'organisation_name client_name')
//     // .populate('role_id', 'role_name permissions')
//     .sort({ createdAt: -1 });
// };

export const findAllUsers = async (
  organisationId = null,
  includeDeleted = false
) => {
  const query = {};

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  if (!includeDeleted) {
    query.is_deleted = false;
  }

  return await User.find(query)
    .populate("organisation_id", "organisation_name client_name")
    .populate("role_id", "role_name permissions")
    .sort({ createdAt: -1 })
    .lean();
};

export const findActiveUsers = async (organisationId = null) => {
  const query = {
    status: "active",
    is_deleted: false,
  };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await User.find(query)
    .populate("organisation_id", "organisation_name client_name")
    .populate("role_id", "role_name permissions");
};

export const findUsersByRole = async (roleId, organisationId = null) => {
  const query = {
    role_id: roleId,
    is_deleted: false,
  };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await User.find(query).populate(
    "organisation_id",
    "organisation_name client_name"
  );
};

export const findUsersByOrganisation = async (
  organisationId,
  includeDeleted = false
) => {
  const query = { organisation_id: organisationId };

  if (!includeDeleted) {
    query.is_deleted = false;
  }

  return await User.find(query)
    .populate("role_id", "role_name permissions")
    .sort({ createdAt: -1 });
};

// Authentication related operations
export const findUserForAuth = async (identifier) => {
  // Find by email or username
  const query = {
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier.toLowerCase() },
    ],
    is_deleted: false,
    status: { $in: ["active", "inactive"] },
  };

  // PATCH 28: Explicitly select password_hash for authentication
  return await User.findOne(query)
    .select('+password_hash')
    .populate(
      "organisation_id",
      "organisation_name client_name status subscription_status"
    )
    .populate("role_id", "role_name permissions status");
};

export const updateLoginInfo = async (userId, loginInfo) => {
  const updateData = {
    last_login_at: new Date(),
    last_activity_at: new Date(),
    failed_login_attempts: 0,
  };

  if (loginInfo.ip_address) {
    updateData.last_login_ip = loginInfo.ip_address;
  }

  return await User.findByIdAndUpdate(userId, updateData, { new: true });
};

export const incrementFailedLoginAttempts = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  user.failed_login_attempts += 1;
  user.last_activity_at = new Date();

  // Lock account after 5 failed attempts
  if (user.failed_login_attempts >= 5) {
    user.locked_until = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    user.status = "locked";
  }

  return await user.save();
};

export const unlockUser = async (userId, unlockedBy) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      locked_until: null,
      failed_login_attempts: 0,
      status: "active",
      updated_by: unlockedBy,
    },
    { new: true }
  );
};

// Password related operations
export const updatePassword = async (
  userId,
  passwordHash,
  updatedBy = null
) => {
  const updateData = {
    password_hash: passwordHash,
    password_changed_at: new Date(),
    must_change_password: false,
  };

  if (userId) {
    updateData.updated_by = userId;
  }

  return await User.findByIdAndUpdate(userId, updateData, { new: true });
};

export const forcePasswordChange = async (userId, adminId) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      must_change_password: true,
      updated_by: adminId,
    },
    { new: true }
  );
};

// Activity tracking
export const updateLastActivity = async (userId) => {
  return await User.findByIdAndUpdate(userId, {
    last_activity_at: new Date(),
  });
};

// Two-factor authentication operations
export const enableTwoFactor = async (userId, secret, backupCodes) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      two_factor_enabled: true,
      two_factor_secret: secret,
      backup_codes: backupCodes,
    },
    { new: true }
  );
};

export const disableTwoFactor = async (userId) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      two_factor_enabled: false,
      two_factor_secret: null,
      backup_codes: [],
    },
    { new: true }
  );
};

// Statistics and counts
export const getUserCountByOrganisation = async (organisationId) => {
  return await User.countDocuments({
    organisation_id: organisationId,
    is_deleted: false,
  });
};

export const getUserCountByStatus = async (status, organisationId = null) => {
  const query = { status, is_deleted: false };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await User.countDocuments(query);
};

// Search operations
export const searchUsers = async (
  searchTerm,
  organisationId = null,
  limit = 20
) => {
  const query = {
    $or: [
      { full_name: { $regex: searchTerm, $options: "i" } },
      { username: { $regex: searchTerm, $options: "i" } },
      { email: { $regex: searchTerm, $options: "i" } },
    ],
    is_deleted: false,
  };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await User.find(query)
    .populate("organisation_id", "organisation_name client_name")
    .populate("role_id", "role_name")
    .limit(limit)
    .sort({ full_name: 1 });
};

// Utility functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validateUserExists = async (id) => {
  const user = await User.findById(id);
  return !!user && !user.is_deleted;
};

export const checkEmailExists = async (email, excludeUserId = null) => {
  const query = { email: email.toLowerCase(), is_deleted: false };

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const user = await User.findOne(query);
  return !!user;
};

export const checkUsernameExists = async (username, excludeUserId = null) => {
  const query = { username: username.toLowerCase(), is_deleted: false };

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const user = await User.findOne(query);
  return !!user;
};

// Legacy compatibility (for gradual migration)
export const saveUser = async (userData) => {
  return await createUser(userData);
};

export const getUserById = async (id) => {
  return await findUserById(id, ["organisation_id", "role_id"]);
};

export const saveUserStatus = async (user) => {
  return await user.save();
};

export const findRoleById = async (roleId) => {
  return await Role.findById(roleId);
};
