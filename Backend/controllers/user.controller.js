// import {
//   createUser as createUserService,
//   getAllUsersService,
//   getActiveUsersService,
//   updateUserService,
//   updateUserProfileService,
//   changePasswordService,
//   forcePasswordChangeService,
//   toggleUserStatusService,
//   unlockUserService,
//   deleteUserService,
//   restoreUserService,
//   getUserByIdService,
//   searchUsersService,
//   getUsersByRoleService,
//   getUsersByOrganisationService,
//   getUserStatisticsService,
// } from "../services/user.service.new.js";
// import { ApiError } from "../utils/ApiError.js";
// import { ApiResponse } from "../utils/ApiResponse.js";

import {
  createUser as createUserService,
  getAllUsersService, // I've reverted the name here for clarity
  getActiveUsersService,
  updateUserService,
  updateUserProfileService,
  changePasswordService,
  forcePasswordChangeService,
  toggleUserStatusService,
  unlockUserService,
  deleteUserService,
  restoreUserService,
  getUserByIdService,
  searchUsersService,
  getUsersByRoleService,
  getUsersByOrganisationService,
  getUserStatisticsService,
} from "../services/user.service.new.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// export const createUser = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       clientName,
//       email,
//       phoneNumber,
//       password,
//       role,
//       level,
//       is_active,
//     } = req.body;

//     // Basic field validation
//     if (!firstName || !email || !password || !phoneNumber || !role || !clientName) {
//       return res.status(400).json({
//         message: "All required fields must be provided",
//         success: false,
//       });
//     }

//     // Check for duplicate email
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(409).json({
//         message: "User already exists with this email",
//         success: false,
//       });
//     }

//     // Validate level only if role is Client
//     const validLevels = User.schema.path('level').enumValues;
//     const roleObj = await Role.findById(role);

//     if (!roleObj) {
//       return res.status(400).json({
//         message: "Invalid role ID provided",
//         success: false
//       });
//     }

//     if (roleObj.name === 'Client') {
//       if (!level || !validLevels.includes(level)) {
//         return res.status(400).json({
//           message: `Invalid or missing level for Client. Allowed: ${validLevels.join(', ')}`,
//           success: false
//         });
//       }
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Create user
//     const newUser = await User.create({
//       firstName,
//       lastName,
//       clientName,
//       email,
//       phoneNumber,
//       password: hashedPassword,
//       role,
//       level: roleObj.name === 'Client' ? level : undefined,
//       is_active: typeof is_active === 'boolean' ? is_active : false,
//     });

//     return res.status(201).json({
//       message: "User created successfully",
//       success: true,
//       user: {
//         id: newUser._id,
//         firstName: newUser.firstName,
//         email: newUser.email,
//         role: roleObj.name,
//         level: newUser.level,
//         clientName: newUser.clientName,
//         is_active: newUser.is_active,
//       },
//     });

//   } catch (error) {
//     console.error("Create User Error:", error);
//     return res.status(500).json({
//       message: error.message || "Failed to create user",
//       success: false
//     });
//   }
// };

export const createUser = async (req, res) => {
  try {
    const userData = req.body;
    const createdBy = req.user?.id;
    console.log("This is a test console in create user controller");
    const newUser = await createUserService(userData, createdBy);

    res
      .status(201)
      .json(new ApiResponse(201, newUser, "User created successfully"));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Create user error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

// export const getAllUsers = async (req, res) => {
//   console.log("STEP 1: Entered getAllUsers controller.");
//   try {
//     const { organisation_id, include_deleted } = req.query;
//     const includeDeleted = include_deleted === "true";
//     const organisationId = organisation_id || req.user?.organisation_id;

//     const users = await getAllUsersService(organisationId, includeDeleted);

//     res
//       .status(200)
//       .json(new ApiResponse(200, users, "Users retrieved successfully"));
//   } catch (error) {
//     if (error instanceof ApiError) {
//       return res
//         .status(error.statusCode)
//         .json(new ApiResponse(error.statusCode, null, error.message));
//     }
//     console.error("Get all users error:", error);
//     res.status(500).json(new ApiResponse(500, null, "Internal server error"));
//   }
// };

export const getAllUsers = async (req, res) => {
  console.log("STEP 1: Entered getAllUsers controller.");
  console.log("Entered getAllUsers controller.");
  try {
    const { organisation_id, include_deleted } = req.query;
    const includeDeleted = include_deleted === "true";
    const organisationId = organisation_id || req.user?.organisation_id;

    // Use the aliased service function here
    const users = await getAllUsersService(organisationId, includeDeleted);

    res
      .status(200)
      .json(new ApiResponse(200, users, "Users retrieved successfully"));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Get all users error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getActiveUsers = async (req, res) => {
  try {
    const { organisation_id } = req.query;
    const organisationId = organisation_id || req.user?.organisation_id;

    const users = await getActiveUsersService(organisationId);

    res
      .status(200)
      .json(new ApiResponse(200, users, "Active users retrieved successfully"));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Get active users error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

// export const getAllUsers = async (req, res) => {
//   try {
//     const users = await getAllUsersService();

//     return res.status(200).json({
//       message: 'Users fetched successfully',
//       success: true,
//       data: users,
//     });
//   } catch (error) {
//     console.error('Get All Users Error:', error);

//     return res.status(500).json({
//       message: 'Failed to fetch users',
//       success: false,
//       error: error.message,
//     });
//   }
// };

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await getUserByIdService(id);

    res
      .status(200)
      .json(new ApiResponse(200, user, "User retrieved successfully"));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Get user by ID error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user?.id;

    const updatedUser = await updateUserService(id, updateData, updatedBy);

    res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "User updated successfully"));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Update user error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const profileData = req.body;

    const updatedProfile = await updateUserProfileService(
      userId,
      profileData,
      userId
    );

    res
      .status(200)
      .json(
        new ApiResponse(200, updatedProfile, "Profile updated successfully")
      );
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Update profile error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { current_password, new_password } = req.body;

    const result = await changePasswordService(
      userId,
      current_password,
      new_password
    );

    res.status(200).json(new ApiResponse(200, null, result.message));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Change password error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const forcePasswordChange = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    const result = await forcePasswordChangeService(id, adminId);

    res.status(200).json(new ApiResponse(200, null, result.message));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Force password change error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBy = req.user?.id;

    const result = await toggleUserStatusService(id, updatedBy);

    res.status(200).json(new ApiResponse(200, result, result.message));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Toggle user status error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const unlockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const unlockedBy = req.user?.id;

    const result = await unlockUserService(id, unlockedBy);

    res.status(200).json(new ApiResponse(200, result, result.message));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Unlock user error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const deletedBy = req.user?.id;

    const result = await deleteUserService(id, deletedBy, reason);

    res.status(200).json(new ApiResponse(200, null, result.message));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Delete user error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const restoreUser = async (req, res) => {
  try {
    const { id } = req.params;
    const restoredBy = req.user?.id;

    const result = await restoreUserService(id, restoredBy);

    res.status(200).json(new ApiResponse(200, result, result.message));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Restore user error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { q, organisation_id, limit } = req.query;
    const searchTerm = q;
    const organisationId = organisation_id || req.user?.organisation_id;
    const searchLimit = parseInt(limit) || 20;

    const users = await searchUsersService(
      searchTerm,
      organisationId,
      searchLimit
    );

    res.status(200).json(new ApiResponse(200, users, "Users search completed"));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Search users error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getUsersByRole = async (req, res) => {
  try {
    const { role_id } = req.params;
    const { organisation_id } = req.query;
    const organisationId = organisation_id || req.user?.organisation_id;

    const users = await getUsersByRoleService(role_id, organisationId);

    res
      .status(200)
      .json(
        new ApiResponse(200, users, "Users by role retrieved successfully")
      );
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Get users by role error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getUsersByOrganisation = async (req, res) => {
  try {
    const { organisation_id } = req.params;
    const { include_deleted } = req.query;
    const includeDeleted = include_deleted === "true";

    const users = await getUsersByOrganisationService(
      organisation_id,
      includeDeleted
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          users,
          "Users by organisation retrieved successfully"
        )
      );
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Get users by organisation error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getUserStatistics = async (req, res) => {
  try {
    const { organisation_id } = req.query;
    const organisationId = organisation_id || req.user?.organisation_id;

    const statistics = await getUserStatisticsService(organisationId);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          statistics,
          "User statistics retrieved successfully"
        )
      );
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Get user statistics error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;

    const user = await getUserByIdService(userId);

    res
      .status(200)
      .json(new ApiResponse(200, user, "Current user retrieved successfully"));
  } catch (error) {
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error("Get current user error:", error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};
