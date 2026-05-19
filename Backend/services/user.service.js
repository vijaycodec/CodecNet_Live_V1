import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import {
  createUser as createUserRepo,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  updateUserById,
  softDeleteUser,
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
import { findOrganisationById, checkUserLimit } from "../repositories/organisationRepository/organisation.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createUser = async (userData, createdBy = null) => {
  const {
    organisation_id,
    username,
    full_name,
    email,
    phone_number,
    password,
    role_id,
    user_type = 'internal',
    status = 'active',
    timezone = 'UTC',
    locale = 'en-IN',
    notification_preferences = { email: true, sms: false, push: true }
  } = userData;

  // Validate required fields
  if (!organisation_id || !username || !full_name || !email || !password || !role_id) {
    throw new ApiError(400, "All required fields must be provided");
  }

  // Validate organisation exists and check user limit
  const organisation = await findOrganisationById(organisation_id);
  if (!organisation) {
    throw new ApiError(404, "Organisation not found");
  }

  if (organisation.status !== 'active') {
    throw new ApiError(403, "Cannot create users for inactive organisation");
  }

  // Check user limit for organisation
  const userLimitCheck = await checkUserLimit(organisation_id);
  if (!userLimitCheck.canAdd) {
    throw new ApiError(403, 
      `User limit reached. Current: ${userLimitCheck.currentCount}, Max: ${userLimitCheck.maxAllowed}`);
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

  // Create user data
  const newUserData = {
    organisation_id,
    username: username.toLowerCase(),
    full_name,
    email: email.toLowerCase(),
    phone_number,
    password_hash,
    role_id,
    user_type,
    status,
    timezone,
    locale,
    notification_preferences,
    created_by: createdBy,
    updated_by: createdBy
  };

  const newUser = await createUserRepo(newUserData);

  // Update organisation user count
  const currentCount = await getUserCountByOrganisation(organisation_id);
  await updateOrganisationById(organisation_id, { current_user_count: currentCount });

  return {
    id: newUser._id,
    username: newUser.username,
    full_name: newUser.full_name,
    email: newUser.email,
    phone_number: newUser.phone_number,
    role: role.role_name,
    user_type: newUser.user_type,
    status: newUser.status,
    organisation: organisation.organisation_name,
    created_at: newUser.createdAt
  };
};

export const getAllUsersService = async () => {
  return await findAllUsers();
};

export const updateUserService = async (id, data) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return {
      status: 400,
      body: { success: false, message: "Invalid user ID" },
    };
  }

  const user = await getUserById(id);
  if (!user) {
    return { status: 404, body: { success: false, message: "User not found" } };
  }

  const roleDoc = await getRoleById(data.role);
  if (!roleDoc) {
    return {
      status: 400,
      body: { success: false, message: "Invalid role ID" },
    };
  }

  if (roleDoc.name === "Client") {
    if (!data.level) {
      return {
        status: 400,
        body: { success: false, message: "Level is required for Client role." },
      };
    }
    if (!["L1", "L2", "L3"].includes(data.level)) {
      return {
        status: 400,
        body: { success: false, message: "Invalid level. Must be L1–L3." },
      };
    }
  }

  const updatedUser = {
    firstName: data.firstName ?? user.firstName,
    lastName: data.lastName ?? user.lastName,
    clientName: data.clientName ?? user.clientName,
    orgName: data.orgName ?? user.orgName,
    industryType: data.industryType ?? user.industryType,
    email: data.email ?? user.email,
    phoneNumber: data.phoneNumber ?? user.phoneNumber,
    role: data.role,
    level: roleDoc.name === "Client" ? data.level : undefined,
    is_active:
      typeof data.is_active === "boolean" ? data.is_active : user.is_active,
  };

  if (data.password) {
    const salt = await bcrypt.genSalt(10);
    updatedUser.password = await bcrypt.hash(data.password, salt);
  }

  const savedUser = await updateUserById(id, updatedUser);

  return {
    status: 200,
    body: {
      success: true,
      message: "User updated successfully",
      user: savedUser,
    },
  };
};

export const toggleUserStatusService = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    return { success: false, message: "User not found", statusCode: 404 };
  }

  user.is_active = !user.is_active;
  const updatedUser = await saveUserStatus(user);

  return {
    success: true,
    statusCode: 200,
    message: `User has been ${
      updatedUser.is_active ? "activated" : "deactivated"
    } successfully`,
    user: {
      id: updatedUser._id,
      email: updatedUser.email,
      is_active: updatedUser.is_active,
    },
  };
};

export const updateProfileService = async (tokenUserId, routeUserId, data) => {
  if (!mongoose.Types.ObjectId.isValid(routeUserId)) {
    return {
      status: 400,
      body: { success: false, message: "Invalid user ID" },
    };
  }

  if (routeUserId !== tokenUserId) {
    return {
      status: 403,
      body: {
        success: false,
        message: "Access denied. Cannot update other profiles.",
      },
    };
  }

  const user = await getUserById(tokenUserId);
  if (!user) {
    return { status: 404, body: { success: false, message: "User not found" } };
  }

  const updatedFields = {
    firstName: data.firstName ?? user.firstName,
    lastName: data.lastName ?? user.lastName,
    phoneNumber: data.phoneNumber ?? user.phoneNumber,
    clientName: data.clientName ?? user.clientName,
  };

  const updatedUser = await updateUserById(tokenUserId, updatedFields);

  return {
    status: 200,
    body: {
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phoneNumber: updatedUser.phoneNumber,
        clientName: updatedUser.clientName,
        orgName: updatedUser.orgName,
        industryType: updatedUser.industryType,
      },
    },
  };
};

export const fetchUserByIdServices = async (id) => {
  const user = await getUserById(id);
  return user;
};

export const deleteUserService = async (id) => {
  if (!isValidObjectId(id)) {
    throw { status: 400, message: "Invalid user ID" };
  }

  const user = await getUserById(id);
  if (!user) {
    throw { status: 404, message: "User not found" };
  }

  await deleteUserById(id);
  return { message: "User deleted successfully" };
};
