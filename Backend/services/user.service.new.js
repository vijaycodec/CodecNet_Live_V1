import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import {
  createUser as createUserRepo,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  updateUserById,
  updateUserRole,
  updateUserEmail,
  updateUserUsername,
  updateUserOrganisation,
  softDeleteUser,
  deleteUserById,
  restoreUser,
  findAllUsers,
  findActiveUsers,
  findUsersByRole,
  findUsersByOrganisation,
  updateLoginInfo,
  incrementFailedLoginAttempts,
  unlockUser,
  updatePassword,
  forcePasswordChange,
  enableTwoFactor,
  disableTwoFactor,
  searchUsers,
  checkEmailExists,
  checkUsernameExists,
  validateUserExists,
  getUserCountByOrganisation,
  isValidObjectId,
} from "../repositories/userRepository/user.repository.js";
import { findRoleById } from "../repositories/roleRepository/role.repository.js";
import {
  findOrganisationById,
  checkUserLimit,
  updateOrganisationById,
} from "../repositories/organisationRepository/organisation.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Helper function to validate and normalize phone number format
const formatPhoneNumber = (phone) => {
  if (!phone) return phone;

  // Trim whitespace
  phone = phone.trim();

  // Expected format: +<country code> <mobile number> (e.g., "+91 9876543210")
  const phoneRegex = /^\+[1-9]\d{0,3}\s\d{4,14}$/;

  if (!phoneRegex.test(phone)) {
    throw new ApiError(400, 'Invalid phone number format. Expected: +<country code> <mobile number> (e.g., +91 9876543210)');
  }

  // Return as-is since frontend already sends in correct format
  return phone;
};

// User Creation Service
export const createUser = async (userData, createdBy = null) => {
  const {
    organisation_id,
    organisation_ids,
    username,
    full_name,
    email,
    phone_number,
    password,
    role_id,
    user_type = "internal",
    status = "active",
    timezone = "UTC",
    locale = "en-IN",
    notification_preferences = { email: true, sms: false, push: true },
  } = userData;

  // Validate required fields
  if (
    !username ||
    !full_name ||
    !email ||
    !password ||
    !role_id
  ) {
    throw new ApiError(400, "All required fields must be provided");
  }

  // Validate organization assignment based on user type
  if (user_type === "internal") {
    // Internal users can optionally have organisation_id (can be null)
    // No validation needed - they can exist without an organisation
  } else if (user_type === "external") {
    // External users must have organisation_ids
    if (!organisation_ids || !Array.isArray(organisation_ids) || organisation_ids.length === 0) {
      throw new ApiError(400, "External users must be assigned to at least one organisation");
    }
  }

  // Determine the primary organisation_id for database operations
  // Convert empty string to null for internal users
  let primaryOrganisationId = organisation_id || null;
  if (user_type === "external" && organisation_ids && organisation_ids.length > 0) {
    primaryOrganisationId = organisation_ids[0]; // Use first organisation as primary
  }

  // Validate organisation exists and check user limit (only if we have a primary organisation)
  let organisation = null;
  if (primaryOrganisationId) {
    organisation = await findOrganisationById(primaryOrganisationId);
    if (!organisation) {
      throw new ApiError(404, "Organisation not found");
    }

    if (organisation.status !== "active") {
      throw new ApiError(403, "Cannot create users for inactive organisation");
    }

    // Check user limit for organisation
    const userLimitCheck = await checkUserLimit(primaryOrganisationId);
    if (!userLimitCheck.canAdd) {
      throw new ApiError(
        403,
        `User limit reached. Current: ${userLimitCheck.currentCount}, Max: ${userLimitCheck.maxAllowed}`
      );
    }
  }

  // Check if email already exists
  const emailExists = await checkEmailExists(email);
  if (emailExists) {
    throw new ApiError(409, "User already exists with this email");
  }

  // Check if username already exists
  const usernameExists = await checkUsernameExists(username);
  if (usernameExists) {
    throw new ApiError(409, "Username is already taken");
  }

  // Validate role exists
  const role = await findRoleById(role_id);
  if (!role || !role.is_active) {
    throw new ApiError(404, "Invalid or inactive role");
  }

  // Hash password
  const password_hash = await bcrypt.hash(password, 12);

  // Format phone number
  const formattedPhoneNumber = phone_number ? formatPhoneNumber(phone_number) : undefined;

  // Create user data
  const newUserData = {
    organisation_id: primaryOrganisationId,
    organisation_ids: user_type === "external" ? organisation_ids : undefined,
    username: username.toLowerCase(),
    full_name,
    email: email.toLowerCase(),
    phone_number: formattedPhoneNumber,
    password_hash,
    role_id,
    user_type,
    status,
    timezone,
    locale,
    notification_preferences,
    created_by: createdBy,
    updated_by: createdBy,
  };

  let newUser;
  try {
    newUser = await createUserRepo(newUserData);
  } catch (error) {
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const value = error.keyValue?.[field];

      if (field === 'username') {
        throw new ApiError(409, `Username "${value}" is already taken`);
      } else if (field === 'email') {
        throw new ApiError(409, `Email "${value}" is already registered`);
      } else {
        throw new ApiError(409, `Duplicate value for field: ${field}`);
      }
    }
    // Re-throw other errors
    throw error;
  }

  // Update organisation user count with full recount (only if we have a primary organisation)
  if (primaryOrganisationId) {
    const currentCount = await getUserCountByOrganisation(primaryOrganisationId);
    await updateOrganisationById(primaryOrganisationId, {
      current_user_count: currentCount,
    });
  }

  return {
    id: newUser._id,
    username: newUser.username,
    full_name: newUser.full_name,
    email: newUser.email,
    phone_number: newUser.phone_number,
    role: role.role_name,
    user_type: newUser.user_type,
    status: newUser.status,
    organisation: organisation?.organisation_name || null,
    created_at: newUser.createdAt,
  };
};

// Get All Users Service
// export const getAllUsersService = async (
//   organisationId = null,
//   includeDeleted = false
// ) => {
//   console.log("STEP 2: Calling the database via findAllUsers...");
//   const users = await findAllUsers(organisationId, includeDeleted);
//   console.log("STEP 3: Database query finished.");

//   return users.map((user) => ({
//     id: user._id,
//     username: user.username,
//     full_name: user.full_name,
//     email: user.email,
//     phone_number: user.phone_number,
//     status: user.status,
//     user_type: user.user_type,
//     role: user.role_id?.role_name,
//     organisation: user.organisation_id?.organisation_name,
//     last_login_at: user.last_login_at,
//     is_locked: user.is_locked,
//     created_at: user.createdAt,
//     updated_at: user.updatedAt,
//   }));
// };

export const getAllUsersService = async (
  organisationId = null,
  includeDeleted = false
) => {
  console.log("STEP 2: Calling the database via findAllUsers...");
  const users = await findAllUsers(organisationId, includeDeleted);
  console.log("STEP 3: Database query finished.");

  return users.map((user) => ({
    id: user._id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    phone_number: user.phone_number,
    status: user.status,
    user_type: user.user_type,
    role: user.role_id?.role_name,
    role_id: user.role_id?._id,
    organisation: user.organisation_id?.organisation_name,
    organisation_id: user.organisation_id?._id,
    organisation_ids: user.organisation_ids,
    last_login_at: user.last_login_at,
    is_locked: user.is_locked,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  }));
};

// Get Active Users Service
export const getActiveUsersService = async (organisationId = null) => {
  const users = await findActiveUsers(organisationId);

  return users.map((user) => ({
    id: user._id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    status: user.status,
    role: user.role_id?.role_name,
    organisation: user.organisation_id?.organisation_name,
    last_activity_at: user.last_activity_at,
  }));
};

// Update User Service
export const updateUserService = async (
  userId,
  updateData,
  updatedBy = null
) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await findUserById(userId, ["organisation_id", "role_id"]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.is_deleted) {
    throw new ApiError(400, "Cannot update deleted user");
  }

  // SECURITY: Handle restricted fields separately with dedicated functions
  let updatedUser = user;

  // Validate and update email if provided (requires user:update:all)
  if (updateData.email && updateData.email !== user.email) {
    const emailExists = await checkEmailExists(updateData.email, userId);
    if (emailExists) {
      throw new ApiError(409, "Email is already in use");
    }
    updatedUser = await updateUserEmail(userId, updateData.email, updatedBy);
    delete updateData.email;
  }

  // Validate and update username if provided (requires user:update:all)
  if (updateData.username && updateData.username !== user.username) {
    const usernameExists = await checkUsernameExists(updateData.username, userId);
    if (usernameExists) {
      throw new ApiError(409, "Username is already taken");
    }
    updatedUser = await updateUserUsername(userId, updateData.username, updatedBy);
    delete updateData.username;
  }

  // SECURITY: Prevent self-role modification
  if (updateData.role_id) {
    if (userId === updatedBy) {
      throw new ApiError(403, "You cannot modify your own role. Contact another administrator.");
    }
    const role = await findRoleById(updateData.role_id);
    if (!role || !role.is_active) {
      throw new ApiError(404, "Invalid or inactive role");
    }
    updatedUser = await updateUserRole(userId, updateData.role_id, updatedBy);
    delete updateData.role_id;
  }

  // Handle organisation_ids for external users first
  // This sets the primary organisation_id from the array
  if (updateData.organisation_ids !== undefined) {
    if (Array.isArray(updateData.organisation_ids) && updateData.organisation_ids.length > 0) {
      updateData.organisation_id = updateData.organisation_ids[0];
    } else {
      updateData.organisation_id = null;
    }
    // organisation_ids will be updated via updateUserById below
  }

  // Update organisation if provided (requires user:update:all)
  // This is skipped if we already processed organisation_ids above
  if (updateData.organisation_id !== undefined) {
    updatedUser = await updateUserOrganisation(userId, updateData.organisation_id, updatedBy);
    delete updateData.organisation_id;
  }

  // Format phone number if provided
  if (updateData.phone_number) {
    updateData.phone_number = formatPhoneNumber(updateData.phone_number);
  }

  // Update remaining allowed fields (profile fields only)
  if (Object.keys(updateData).length > 0) {
    updatedUser = await updateUserById(userId, updateData, updatedBy);
  }

  // Update organisation user counts if organisation changed
  // Handle both populated object and ObjectId
  const oldOrgId = user.organisation_id?._id?.toString() || user.organisation_id?.toString();
  const newOrgId = updatedUser.organisation_id?._id?.toString() || updatedUser.organisation_id?.toString();

  if (oldOrgId !== newOrgId) {
    // Update count for old organisation (if exists)
    if (oldOrgId) {
      const oldCount = await getUserCountByOrganisation(oldOrgId);
      await updateOrganisationById(oldOrgId, { current_user_count: oldCount });
    }

    // Update count for new organisation (if exists)
    if (newOrgId) {
      const newCount = await getUserCountByOrganisation(newOrgId);
      await updateOrganisationById(newOrgId, { current_user_count: newCount });
    }
  }

  return {
    id: updatedUser._id,
    username: updatedUser.username,
    full_name: updatedUser.full_name,
    email: updatedUser.email,
    phone_number: updatedUser.phone_number,
    status: updatedUser.status,
    user_type: updatedUser.user_type,
    updated_at: updatedUser.updatedAt,
  };
};

// User Profile Update Service
export const updateUserProfileService = async (
  userId,
  profileData,
  updatedBy = null
) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Format phone number if provided
  if (profileData.phone_number) {
    profileData.phone_number = formatPhoneNumber(profileData.phone_number);
  }

  // Only allow updating profile fields
  const allowedFields = {
    full_name: profileData.full_name,
    phone_number: profileData.phone_number,
    timezone: profileData.timezone,
    locale: profileData.locale,
    notification_preferences: profileData.notification_preferences,
    avatar_url: profileData.avatar_url,
  };

  // Remove undefined values
  Object.keys(allowedFields).forEach((key) => {
    if (allowedFields[key] === undefined) {
      delete allowedFields[key];
    }
  });

  const updatedUser = await updateUserById(userId, allowedFields, updatedBy);

  return {
    id: updatedUser._id,
    username: updatedUser.username,
    full_name: updatedUser.full_name,
    email: updatedUser.email,
    phone_number: updatedUser.phone_number,
    timezone: updatedUser.timezone,
    locale: updatedUser.locale,
    notification_preferences: updatedUser.notification_preferences,
    avatar_url: updatedUser.avatar_url,
    updated_at: updatedUser.updatedAt,
  };
};

// Password Change Service
export const changePasswordService = async (
  userId,
  currentPassword,
  newPassword
) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password_hash
  );
  if (!isCurrentPasswordValid) {
    throw new ApiError(400, "Current password is incorrect");
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await updatePassword(userId, newPasswordHash, userId);

  return { message: "Password changed successfully" };
};

// Force Password Change Service (Admin)
export const forcePasswordChangeService = async (userId, adminId) => {
  if (!isValidObjectId(userId) || !isValidObjectId(adminId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await forcePasswordChange(userId, adminId);

  return { message: "User will be required to change password on next login" };
};

// User Status Management
export const toggleUserStatusService = async (userId, updatedBy = null) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const newStatus = user.status === "active" ? "inactive" : "active";
  const updatedUser = await updateUserById(
    userId,
    { status: newStatus },
    updatedBy
  );

  return {
    id: updatedUser._id,
    username: updatedUser.username,
    status: updatedUser.status,
    message: `User has been ${
      newStatus === "active" ? "activated" : "deactivated"
    }`,
  };
};

// Unlock User Service
export const unlockUserService = async (userId, unlockedBy) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await unlockUser(userId, unlockedBy);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return {
    id: user._id,
    username: user.username,
    status: user.status,
    message: "User has been unlocked successfully",
  };
};

// Delete User Service (Hard Delete - Permanent)
export const deleteUserService = async (userId, deletedBy, reason = null) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Store organisation_id before deletion
  const userOrgId = user.organisation_id;

  // Permanently delete the user from database
  await deleteUserById(userId);

  // Update organisation user count (only if user was associated with an org)
  if (userOrgId) {
    const currentCount = await getUserCountByOrganisation(userOrgId);
    await updateOrganisationById(userOrgId, {
      current_user_count: currentCount,
    });
  }

  return { message: "User deleted permanently" };
};

// Restore User Service
export const restoreUserService = async (userId, restoredBy) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await restoreUser(userId, restoredBy);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Update organisation user count
  const currentCount = await getUserCountByOrganisation(user.organisation_id);
  await updateOrganisationById(user.organisation_id, {
    current_user_count: currentCount,
  });

  return {
    id: user._id,
    username: user.username,
    status: user.status,
    message: "User restored successfully",
  };
};

// Get User by ID Service
export const getUserByIdService = async (userId) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await findUserById(userId, ["organisation_id", "role_id"]);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return {
    id: user._id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    phone_number: user.phone_number,
    avatar_url: user.avatar_url,
    status: user.status,
    user_type: user.user_type,
    role: user.role_id
      ? {
          id: user.role_id._id,
          name: user.role_id.role_name,
          permissions: user.role_id.permissions,
        }
      : null,
    organisation: user.organisation_id
      ? {
          id: user.organisation_id._id,
          name: user.organisation_id.organisation_name,
          client_name: user.organisation_id.client_name,
        }
      : null,
    timezone: user.timezone,
    locale: user.locale,
    notification_preferences: user.notification_preferences,
    last_login_at: user.last_login_at,
    last_activity_at: user.last_activity_at,
    is_locked: user.is_locked,
    two_factor_enabled: user.two_factor_enabled,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
};

// Search Users Service
export const searchUsersService = async (
  searchTerm,
  organisationId = null,
  limit = 20
) => {
  if (!searchTerm || searchTerm.trim().length < 2) {
    throw new ApiError(400, "Search term must be at least 2 characters");
  }

  const users = await searchUsers(searchTerm.trim(), organisationId, limit);

  return users.map((user) => ({
    id: user._id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    status: user.status,
    role: user.role_id?.role_name,
    organisation: user.organisation_id?.organisation_name,
  }));
};

// Get Users by Role Service
export const getUsersByRoleService = async (roleId, organisationId = null) => {
  if (!isValidObjectId(roleId)) {
    throw new ApiError(400, "Invalid role ID");
  }

  const users = await findUsersByRole(roleId, organisationId);

  return users.map((user) => ({
    id: user._id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    status: user.status,
    user_type: user.user_type,
    organisation: user.organisation_id?.organisation_name,
    last_activity_at: user.last_activity_at,
  }));
};

// Get Users by Organisation Service
export const getUsersByOrganisationService = async (
  organisationId,
  includeDeleted = false
) => {
  if (!isValidObjectId(organisationId)) {
    throw new ApiError(400, "Invalid organisation ID");
  }

  const users = await findUsersByOrganisation(organisationId, includeDeleted);

  return users.map((user) => ({
    id: user._id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    status: user.status,
    user_type: user.user_type,
    role: user.role_id?.role_name,
    last_login_at: user.last_login_at,
    is_locked: user.is_locked,
    created_at: user.createdAt,
  }));
};

// Two-Factor Authentication Services
export const enableTwoFactorService = async (userId, secret, backupCodes) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await enableTwoFactor(userId, secret, backupCodes);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return {
    message: "Two-factor authentication enabled successfully",
    backup_codes: backupCodes,
  };
};

export const disableTwoFactorService = async (userId) => {
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await disableTwoFactor(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return { message: "Two-factor authentication disabled successfully" };
};

// User Statistics Service
export const getUserStatisticsService = async (organisationId = null) => {
  const totalUsers = await getUserCountByOrganisation(organisationId);

  // You would implement these queries based on your needs
  const activeUsers = await findActiveUsers(organisationId);

  return {
    total_users: totalUsers,
    active_users: activeUsers.length,
    inactive_users: totalUsers - activeUsers.length,
  };
};

// Legacy compatibility exports
export const fetchUserByIdServices = getUserByIdService;
