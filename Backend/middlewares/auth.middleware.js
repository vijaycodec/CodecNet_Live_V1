import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import * as userRepository from "../repositories/userRepository/user.repository.js";
import * as sessionRepository from "../repositories/userSessionRepository/userSession.repository.js";

/**
 * Extract client IP address from request
 */
const getClientIP = (req) => {
  return (
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    "127.0.0.1"
  );
};

/**
 * Extract device information from request headers
 */
const getDeviceInfo = (req) => {
  return {
    user_agent: req.headers["user-agent"] || "Unknown",
    ip_address: getClientIP(req),
    accept_language: req.headers["accept-language"] || null,
    device_fingerprint: req.headers["x-device-fingerprint"] || null,
  };
};

/**
 * Middleware to authenticate JWT token and attach user info to request
 */
// export const authenticateToken = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res
//         .status(401)
//         .json(new ApiResponse(401, null, "Access token required"));
//     }

//     const token = authHeader.split(" ")[1];

//     let decoded;
//     try {
//       decoded = jwt.verify(token, process.env.JWT_SECRET);
//     } catch (error) {
//       if (error.name === "TokenExpiredError") {
//         return res
//           .status(401)
//           .json(new ApiResponse(401, null, "Token has expired"));
//       }
//       if (error.name === "JsonWebTokenError") {
//         return res
//           .status(401)
//           .json(new ApiResponse(401, null, "Invalid token"));
//       }
//       throw error;
//     }

//     // Verify user still exists and is active
//     // const user = await userRepository.findUserById(decoded.id);
//     const user = await userRepository.findUserById(decoded.id, ["role_id"]);
//     if (!user) {
//       return res
//         .status(401)
//         .json(new ApiResponse(401, null, "User no longer exists"));
//     }

//     if (user.status !== "active" || user.is_deleted) {
//       return res
//         .status(401)
//         .json(new ApiResponse(401, null, "Account has been deactivated"));
//     }

//     // Check if session is still valid (for session-based auth)
//     if (decoded.session_id) {
//       const session = await sessionRepository.findSessionById(
//         decoded.session_id
//       );
//       if (!session || !session.is_active || session.expires_at < new Date()) {
//         return res
//           .status(401)
//           .json(
//             new ApiResponse(401, null, "Session has expired or been revoked")
//           );
//       }

//       // Update session last activity
//       await sessionRepository.updateSessionActivity(
//         decoded.session_id,
//         getClientIP(req)
//       );

//       req.session = session;
//     }

//     // Attach user and device info to request
//     req.user = user;
//     req.device_info = getDeviceInfo(req);

//     next();
//   } catch (error) {
//     console.error("Authentication error:", error);
//     return res
//       .status(500)
//       .json(new ApiResponse(500, null, "Authentication service error"));
//   }
// };

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json(new ApiResponse(401, null, "Access token required"));
    }

    const token = authHeader.split(" ")[1];

    // Declare `decoded` here, outside the try block
    let decoded;

    try {
      // Assign the value inside the try block
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res
          .status(401)
          .json(new ApiResponse(401, null, "Token has expired"));
      }
      if (error.name === "JsonWebTokenError") {
        return res
          .status(401)
          .json(new ApiResponse(401, null, "Invalid token"));
      }
      throw error;
    }

    // Now `decoded` is accessible here
    const user = await userRepository.findUserById(decoded.id, ["role_id", "organisation_id"]);
    // console.log("User object from database in auth middleware:", user);

    if (!user) {
      return res
        .status(401)
        .json(new ApiResponse(401, null, "User no longer exists"));
    }

    if (user.status !== "active" || user.is_deleted) {
      return res
        .status(401)
        .json(new ApiResponse(401, null, "Account has been deactivated"));
    }

    // SECURITY FIX (PATCH 38): Make session validation MANDATORY
    // Prevents authentication bypass by enforcing server-side session tracking
    if (!decoded.session_id) {
      return res
        .status(401)
        .json(new ApiResponse(401, null, "Invalid token: session ID required"));
    }

    const session = await sessionRepository.findSessionById(
      decoded.session_id
    );

    // Validate session is active and not expired
    if (!session || !session.is_active || session.expires_at < new Date()) {
      return res
        .status(401)
        .json(
          new ApiResponse(401, null, "Session has expired or been revoked")
        );
    }

    // SECURITY FIX (PATCH 40): Check for inactivity timeout (CWE-613)
    const inactivityTimeoutMinutes = parseInt(process.env.SESSION_INACTIVITY_TIMEOUT || '15');
    const inactivityThreshold = new Date(Date.now() - inactivityTimeoutMinutes * 60 * 1000);

    if (session.last_activity_at < inactivityThreshold) {
      // Terminate session due to inactivity
      await sessionRepository.terminateSession(decoded.session_id, 'timeout');

      return res
        .status(401)
        .json(
          new ApiResponse(401, null, `Session expired due to ${inactivityTimeoutMinutes} minutes of inactivity`)
        );
    }

    // Update session last activity
    await sessionRepository.updateSessionActivity(
      decoded.session_id,
      getClientIP(req)
    );

    req.session = session;
    req.user = user;
    req.device_info = getDeviceInfo(req);

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Authentication service error"));
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    // Use the same logic as authenticateToken but don't fail
    await authenticateToken(req, res, (error) => {
      if (error) {
        req.user = null;
      }
      next();
    });
  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Middleware to require specific authentication method
 */
export const requireAuthMethod = (methods = ["password", "2fa"]) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json(new ApiResponse(401, null, "Authentication required"));
    }

    if (req.user.two_factor_enabled && !methods.includes("2fa")) {
      return res
        .status(403)
        .json(new ApiResponse(403, null, "Two-factor authentication required"));
    }

    next();
  };
};

/**
 * Middleware to check if user's email is verified
 */
export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json(new ApiResponse(401, null, "Authentication required"));
  }

  if (!req.user.email_verified) {
    return res
      .status(403)
      .json(new ApiResponse(403, null, "Email verification required"));
  }

  next();
};

/**
 * Legacy middleware for backward compatibility
 */
export const protect = authenticateToken;

/**
 * Utility functions
 */
export { getClientIP, getDeviceInfo };
