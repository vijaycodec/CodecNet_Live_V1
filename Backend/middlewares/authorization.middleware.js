import { ApiResponse } from "../utils/ApiResponse.js";
import * as roleRepository from "../repositories/roleRepository/role.repository.js";
import * as userRepository from "../repositories/userRepository/user.repository.js";

/**
 * Permission format: "resource:action:scope"
 * Examples:
 * - "user:read:own" - read own user data
 * - "user:read:organisation" - read users in same organisation
 * - "user:create:all" - create users anywhere
 * - "ticket:assign:organisation" - assign tickets within organisation
 */

/**
 * Parse permission string into components
 * @param {string} permission - Permission string in format "resource:action:scope"
 * @returns {Object} - Parsed permission components
 */
const parsePermission = (permission) => {
  const parts = permission.split(":");
  return {
    resource: parts[0] || null,
    action: parts[1] || null,
    scope: parts[2] || "own",
  };
};

/**
 * Check if user has specific permission
 * @param {Object} userPermissions - User's permissions from role/direct assignments
 * @param {string} requiredPermission - Required permission string
 * @param {Object} context - Additional context for permission checking
 * @returns {boolean} - Whether user has permission
 */
const hasPermission = (userPermissions, requiredPermission, context = {}) => {
  const required = parsePermission(requiredPermission);

  // Check nested object format: { resource: { action: true } }
  if (userPermissions[required.resource]) {
    if (userPermissions[required.resource][required.action] === true) {
      return true;
    }
    // Check for wildcard action
    if (userPermissions[required.resource]['*'] === true) {
      return true;
    }
  }

  // Check for wildcard resource
  if (userPermissions['*']) {
    if (userPermissions['*'][required.action] === true) {
      return true;
    }
    if (userPermissions['*']['*'] === true) {
      return true;
    }
  }

  // Check flat string format for backward compatibility: 'resource:action:scope'
  if (userPermissions[requiredPermission]) {
    return true;
  }

  // Check wildcard permissions in flat format
  const wildcardPatterns = [
    `${required.resource}:*:${required.scope}`,
    `${required.resource}:${required.action}:*`,
    `*:${required.action}:${required.scope}`,
    `${required.resource}:*:*`,
    `*:*:${required.scope}`,
    `*:${required.action}:*`,
    "*:*:*",
  ];

  for (const pattern of wildcardPatterns) {
    if (userPermissions[pattern]) {
      return true;
    }
  }

  // Check scope hierarchy in flat format (all > organisation > own)
  if (
    required.scope === "own" &&
    userPermissions[`${required.resource}:${required.action}:organisation`]
  ) {
    return true;
  }

  if (
    (required.scope === "own" || required.scope === "organisation") &&
    userPermissions[`${required.resource}:${required.action}:all`]
  ) {
    return true;
  }

  return false;
};

/**
 * Get user's effective permissions (role + direct permissions)
 * @param {Object} user - User object
 * @returns {Object} - Combined permissions object
 */
const getUserPermissions = async (user) => {
  let permissions = {};

  // Get role-based permissions
  if (user.role_id) {
    const role = await roleRepository.findRoleById(user.role_id);
    if (role && role.permissions) {
      permissions = { ...permissions, ...role.permissions };
    }
  }

  // Add direct user permissions (if any)
  if (user.direct_permissions) {
    permissions = { ...permissions, ...user.direct_permissions };
  }

  return permissions;
};

/**
 * Main authorization middleware
 * @param {string|Array} requiredPermissions - Single permission or array of permissions (OR logic)
 * @param {Object} options - Additional options
 * @returns {Function} - Express middleware function
 */
// export const authorizePermissions = (requiredPermissions, options = {}) => {
//   const {
//     requireAll = false, // If true, user needs ALL permissions (AND logic)
//     allowSelf = false, // Allow access to own resources
//     resourceParam = "id", // Parameter name for resource ID
//   } = options;

//   // return async (req, res, next) => {
//   //   try {
//   //     if (!req.user) {
//   //       return res
//   //         .status(401)
//   //         .json(new ApiResponse(401, null, "Authentication required"));
//   //     }

//   //     // console.log("this a test for superadmin1 . ", req.user);

//   //     // Super admin bypass
//   //     // if (req.user.username == "superadmin") {
//   //     console.log(req.user.role_id, req.user.role_id.role_name, req.user);
//   //     if (req.user.role_id && req.user.role_id.role_name === "SuperAdmin") {
//   //       // console.log("this a test for superadmin2");
//   //       return next();
//   //     }

//   //     // Convert single permission to array
//   //     const permissions = Array.isArray(requiredPermissions)
//   //       ? requiredPermissions
//   //       : [requiredPermissions];

//   //     // Get user's effective permissions
//   //     const userPermissions = await getUserPermissions(req.user);

//   //     // Check permissions
//   //     let hasAccess = false;

//   //     if (requireAll) {
//   //       // User needs ALL permissions (AND logic)
//   //       hasAccess = permissions.every((permission) =>
//   //         hasPermission(userPermissions, permission, req)
//   //       );
//   //     } else {
//   //       // User needs ANY permission (OR logic)
//   //       hasAccess = permissions.some((permission) =>
//   //         hasPermission(userPermissions, permission, req)
//   //       );
//   //     }

//   //     // Check self-access for own resources
//   //     if (!hasAccess && allowSelf && req.params[resourceParam]) {
//   //       const resourceId = req.params[resourceParam];
//   //       if (resourceId === req.user.id) {
//   //         hasAccess = true;
//   //       }
//   //     }

//   //     if (!hasAccess) {
//   //       return res
//   //         .status(403)
//   //         .json(new ApiResponse(403, null, "Insufficient permissions"));
//   //     }

//   //     next();
//   //   } catch (error) {
//   //     console.error("Authorization error:", error);
//   //     return res
//   //       .status(500)
//   //       .json(new ApiResponse(500, null, "Authorization service error"));
//   //   }
//   // };
//   return async (req, res, next) => {
//     try {
//       if (!req.user) {
//         return res
//           .status(401)
//           .json(new ApiResponse(401, null, "Authentication required"));
//       }

//       // Super admin bypass
//       if (req.user.role_id && req.user.role_id.role_name === "SuperAdmin") {
//         return next();
//       }

//       // ... (rest of the function remains the same)
//     } catch (error) {
//       console.error("Authorization error:", error);
//       return res
//         .status(500)
//         .json(new ApiResponse(500, null, "Authorization service error"));
//     }
//   };
// };

export const authorizePermissions = (requiredPermissions, options = {}) => {
  const {
    requireAll = false,
    allowSelf = false,
    resourceParam = "id",
  } = options;

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json(new ApiResponse(401, null, "Authentication required"));
      }

      // SECURITY: No hardcoded role checks - permission-based only

      // Convert single permission to array
      const permissions = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      // Get user's effective permissions
      const userPermissions = await getUserPermissions(req.user);

      // Check permissions
      let hasAccess = false;

      if (requireAll) {
        // User needs ALL permissions (AND logic)
        hasAccess = permissions.every((permission) =>
          hasPermission(userPermissions, permission, req)
        );
      } else {
        // User needs ANY permission (OR logic)
        hasAccess = permissions.some((permission) =>
          hasPermission(userPermissions, permission, req)
        );
      }

      // Check self-access for own resources
      if (!hasAccess && allowSelf && req.params[resourceParam]) {
        const resourceId = req.params[resourceParam];
        if (resourceId === req.user.id || resourceId === req.user._id.toString()) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        console.log('Permission denied for user:', req.user.username);
        console.log('Required permissions:', permissions);
        console.log('User permissions:', userPermissions);
        return res
          .status(403)
          .json(new ApiResponse(403, null, "Insufficient permissions"));
      }

      next();
    } catch (error) {
      console.error("Authorization error:", error);
      return res
        .status(500)
        .json(new ApiResponse(500, null, "Authorization service error"));
    }
  };
};

/**
 * Check if user can access resources within their organisation scope
 */
export const organisationScope = async (req, res, next) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(new ApiResponse(401, null, "Authentication required"));
    }

    // SECURITY: Check permission-based access instead of hardcoded role
    const hasOrgAccessAll = req.user.role_id?.permissions &&
      (req.user.role_id.permissions['organisation:access:all'] === true);

    const hasOverviewRead = req.user.user_type === 'internal' &&
      req.user.role_id?.permissions &&
      (req.user.role_id.permissions['overview:read'] === true);

    if (hasOrgAccessAll || hasOverviewRead) {
      return next();
    }

    // Attach organisation filter to request for use in controllers
    req.organisationFilter = { organisation_id: req.user.organisation_id };

    next();
  } catch (error) {
    console.error("Organisation scope error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Organisation scope service error"));
  }
};

/**
 * Resource ownership middleware
 * Checks if user owns or has permission to access a specific resource
 */
export const checkResourceOwnership = (
  resourceModel,
  ownerField = "created_by"
) => {
  return async (req, res, next) => {
    try {
      console.log(req.user);
      if (!req.user) {
        return res
          .status(401)
          .json(new ApiResponse(401, null, "Authentication required"));
      }

      // SECURITY: No hardcoded role checks - permission-based authorization only

      const resourceId = req.params.id;
      if (!resourceId) {
        return res
          .status(400)
          .json(new ApiResponse(400, null, "Resource ID required"));
      }

      // This would need to be implemented based on your repository pattern
      // For now, just pass through and let controllers handle the logic
      next();
    } catch (error) {
      console.error("Resource ownership check error:", error);
      return res
        .status(500)
        .json(new ApiResponse(500, null, "Resource ownership check failed"));
    }
  };
};

/**
 * Role-based access control middleware
 * @param {Array} allowedRoles - Array of allowed role codes
 */
export const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json(new ApiResponse(401, null, "Authentication required"));
      }

      // SECURITY: No hardcoded role checks - use permission-based authorization

      // Get user's role
      const role = await roleRepository.findRoleById(req.user.role_id);
      if (!role) {
        return res
          .status(403)
          .json(new ApiResponse(403, null, "No role assigned"));
      }

      if (!allowedRoles.includes(role.role_code)) {
        return res
          .status(403)
          .json(new ApiResponse(403, null, "Insufficient role permissions"));
      }

      next();
    } catch (error) {
      console.error("Role check error:", error);
      return res
        .status(500)
        .json(new ApiResponse(500, null, "Role check service error"));
    }
  };
};

/**
 * Subscription plan feature access middleware
 */
export const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json(new ApiResponse(401, null, "Authentication required"));
      }

      // SECURITY: No hardcoded role checks - use permission-based authorization

      // Get user's organisation and subscription plan
      const user = await userRepository.findUserById(req.user.id, [
        "organisation_id",
      ]);
      if (!user || !user.organisation || !user.organisation.subscription_plan) {
        return res
          .status(403)
          .json(new ApiResponse(403, null, "No subscription plan found"));
      }

      const plan = user.organisation.subscription_plan;
      if (!plan.features || !plan.features[featureName]) {
        return res
          .status(403)
          .json(
            new ApiResponse(
              403,
              null,
              `Feature '${featureName}' not available in your subscription plan`
            )
          );
      }

      next();
    } catch (error) {
      console.error("Feature check error:", error);
      return res
        .status(500)
        .json(new ApiResponse(500, null, "Feature check service error"));
    }
  };
};

/**
 * Check subscription limits middleware
 */
export const checkSubscriptionLimits = (limitType, currentCountCallback) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json(new ApiResponse(401, null, "Authentication required"));
      }

      // SECURITY: No hardcoded role checks - use permission-based authorization

      // Get user's organisation and subscription plan
      const user = await userRepository.findUserById(req.user.id, [
        "organisation_id",
      ]);
      if (!user || !user.organisation || !user.organisation.subscription_plan) {
        return next(); // Allow if no plan restrictions
      }

      const plan = user.organisation.subscription_plan;
      const limit = plan[limitType];

      if (limit && limit > 0) {
        const currentCount = await currentCountCallback(user.organisation.id);

        if (currentCount >= limit) {
          return res
            .status(403)
            .json(
              new ApiResponse(
                403,
                null,
                `Subscription limit reached for ${limitType} (${currentCount}/${limit})`
              )
            );
        }
      }

      next();
    } catch (error) {
      console.error("Subscription limit check error:", error);
      return res
        .status(500)
        .json(new ApiResponse(500, null, "Subscription limit check failed"));
    }
  };
};

// Named exports
export { hasPermission, getUserPermissions };

export default {
  authorizePermissions,
  organisationScope,
  checkResourceOwnership,
  requireRole,
  requireFeature,
  checkSubscriptionLimits,
  hasPermission,
  getUserPermissions,
};
