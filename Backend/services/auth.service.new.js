import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import crypto from "crypto";
import {
  findUserForAuth,
  updateLoginInfo,
  incrementFailedLoginAttempts,
  findUserById,
  updateLastActivity
} from "../repositories/userRepository/user.repository.js";
import {
  createUserSession,
  findSessionByToken,
  findSessionByRefreshToken,
  terminateSession,
  terminateAllUserSessions,
  getUserSessionCount,        // PATCH 54: Count active sessions
  findActiveSessionsForUser,  // PATCH 54: Find all active sessions
  deleteSessionById,          // PATCH 54: Delete specific session
  deleteAllUserSessions       // PATCH 54: Delete all user sessions
} from "../repositories/userSessionRepository/userSession.repository.js";
import UserSession from "../models/userSession.model.js";
import { 
  createResetRequest,
  findValidToken,
  useResetToken,
  checkRateLimitByUser,
  checkRateLimitByIp
} from "../repositories/passwordResetRepository/passwordReset.repository.js";
import { findOrganisationById } from "../repositories/organisationRepository/organisation.repository.js";
import { updatePassword } from "../repositories/userRepository/user.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Login Service with Enhanced Security
export const loginService = async (identifier, password, ipAddress, userAgent, deviceInfo = {}) => {
  if (!identifier || !password) {
    throw new ApiError(400, "Email/username and password are required");
  }

  if (!ipAddress) {
    throw new ApiError(400, "IP address is required for security tracking");
  }

  // Find user by email or username
  const user = await findUserForAuth(identifier);
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Check if user account is locked
  if (user.is_locked) {
    throw new ApiError(423, "Account is temporarily locked due to multiple failed login attempts");
  }

  // Check user status
  if (user.status !== 'active') {
    throw new ApiError(403, "Account is not active. Please contact administrator");
  }

  // Check if user is deleted
  if (user.is_deleted) {
    throw new ApiError(403, "Account not found");
  }

  // Check organisation status (skip for internal users)
  if (user.user_type === 'external') {
    if (!user.organisation_id || user.organisation_id.status !== 'active') {
      throw new ApiError(403, "Organisation is not active");
    }

    // Check subscription status
    if (user.organisation_id.subscription_status !== 'active') {
      throw new ApiError(403, "Organisation subscription is not active");
    }
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    // Increment failed login attempts
    await incrementFailedLoginAttempts(user._id);
    throw new ApiError(401, "Invalid credentials");
  }

  // Check if password change is required
  if (user.must_change_password) {
    return {
      requires_password_change: true,
      user_id: user._id,
      message: "Password change required before login"
    };
  }

  // Check if 2FA is enabled
  if (user.two_factor_enabled) {
    return {
      requires_2fa: true,
      user_id: user._id,
      message: "Two-factor authentication required"
    };
  }

  // SECURITY FIX (PATCH 54): Concurrent Session Prevention (CWE-1018)
  const allowConcurrentSessions = process.env.ALLOW_CONCURRENT_SESSIONS !== 'false';
  const maxConcurrentSessions = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '0');

  if (!allowConcurrentSessions) {
    // MODE 1: Single Session - Terminate ALL existing sessions
    const activeSessions = await findActiveSessionsForUser(user._id);
    if (activeSessions.length > 0) {
      console.log(`🔒 [PATCH 54] Terminating ${activeSessions.length} existing session(s) for user ${user.email} (concurrent sessions disabled)`);
      await deleteAllUserSessions(user._id);
    }
  } else if (maxConcurrentSessions > 0) {
    // MODE 2: Limited Sessions - Terminate oldest sessions when limit exceeded
    const activeSessionCount = await getUserSessionCount(user._id);
    if (activeSessionCount >= maxConcurrentSessions) {
      // Calculate how many sessions need to be terminated
      const sessionsToTerminate = activeSessionCount - maxConcurrentSessions + 1;
      const activeSessions = await findActiveSessionsForUser(user._id);

      // Sort by last activity (oldest first) and select oldest sessions
      const oldestSessions = activeSessions
        .sort((a, b) => a.last_activity_at - b.last_activity_at)
        .slice(0, sessionsToTerminate);

      console.log(`🔒 [PATCH 54] Terminating ${sessionsToTerminate} oldest session(s) for user ${user.email} (max: ${maxConcurrentSessions})`);

      for (const session of oldestSessions) {
        await deleteSessionById(session._id);
      }
    }
  }
  // If ALLOW_CONCURRENT_SESSIONS=true and MAX=0, no session termination occurs

  // SECURITY FIX (PATCH 38): Create session first to get session_id for JWT
  // SECURITY FIX (PATCH 40): Use configurable absolute timeout (CWE-613)
  const absoluteTimeoutHours = parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT || '1');

  const sessionData = {
    user_id: user._id,
    session_token: 'placeholder', // Will be updated after token generation
    refresh_token: null,
    device_info: deviceInfo,
    ip_address: ipAddress,
    user_agent: userAgent,
    expires_at: new Date(Date.now() + absoluteTimeoutHours * 60 * 60 * 1000) // Configurable hours
  };

  const session = await createUserSession(sessionData);

  // Generate JWT tokens with session_id embedded
  const { accessToken, refreshToken } = generateTokens(user, session._id.toString());

  // Update session with actual token hashes
  session.session_token = hashToken(accessToken);
  session.refresh_token = refreshToken ? hashToken(refreshToken) : null;
  await session.save();

  // Update login information
  await updateLoginInfo(user._id, { ip_address: ipAddress });

  // Prepare response
  const userResponse = {
    id: user._id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    user_type: user.user_type, // Add user_type for frontend checks
    role: user.role_id ? {
      id: user.role_id._id,
      name: user.role_id.role_name,
      permissions: user.role_id.permissions
    } : null,
    permissions: user.role_id?.permissions || {}, // Top-level permissions for easier frontend access
    organisation: user.organisation_id ? {
      id: user.organisation_id._id,
      name: user.organisation_id.organisation_name,
      client_name: user.organisation_id.client_name,
      subscription_status: user.organisation_id.subscription_status
    } : null,
    organisation_id: user.organisation_id?._id || null, // Add flat organisation_id for easier access
    timezone: user.timezone,
    locale: user.locale,
    notification_preferences: user.notification_preferences,
    two_factor_enabled: user.two_factor_enabled,
    must_change_password: user.must_change_password
  };

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 86400, // 24 hours in seconds
    user: userResponse
  };
};

// Two-Factor Authentication Login
export const verify2FAService = async (userId, totpCode, ipAddress, userAgent, deviceInfo = {}) => {
  if (!userId || !totpCode) {
    throw new ApiError(400, "User ID and TOTP code are required");
  }

  const user = await findUserById(userId, ['organisation_id', 'role_id']);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.two_factor_enabled || !user.two_factor_secret) {
    throw new ApiError(400, "Two-factor authentication is not enabled for this user");
  }

  // Verify TOTP code
  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token: totpCode,
    window: 2 // Allow 2 time steps before/after
  });

  if (!verified) {
    throw new ApiError(401, "Invalid two-factor authentication code");
  }

  // SECURITY FIX (PATCH 38): Create session first to get session_id for JWT
  // SECURITY FIX (PATCH 40): Use configurable absolute timeout (CWE-613)
  const absoluteTimeoutHours = parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT || '1');

  const sessionData = {
    user_id: user._id,
    session_token: 'placeholder', // Will be updated after token generation
    refresh_token: null,
    device_info: deviceInfo,
    ip_address: ipAddress,
    user_agent: userAgent,
    expires_at: new Date(Date.now() + absoluteTimeoutHours * 60 * 60 * 1000) // Configurable hours
  };

  const session = await createUserSession(sessionData);

  // Generate JWT tokens with session_id embedded
  const { accessToken, refreshToken } = generateTokens(user, session._id.toString());

  // Update session with actual token hashes
  session.session_token = hashToken(accessToken);
  session.refresh_token = refreshToken ? hashToken(refreshToken) : null;
  await session.save();

  // Update login information
  await updateLoginInfo(user._id, { ip_address: ipAddress });

  const userResponse = {
    id: user._id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    user_type: user.user_type, // Add user_type for frontend checks
    role: user.role_id ? {
      id: user.role_id._id,
      name: user.role_id.role_name,
      permissions: user.role_id.permissions
    } : null,
    permissions: user.role_id?.permissions || {}, // Top-level permissions for easier frontend access
    organisation: user.organisation_id ? {
      id: user.organisation_id._id,
      name: user.organisation_id.organisation_name,
      client_name: user.organisation_id.client_name,
      subscription_status: user.organisation_id.subscription_status
    } : null,
    organisation_id: user.organisation_id?._id || null, // Add flat organisation_id for easier access
    timezone: user.timezone,
    locale: user.locale,
    notification_preferences: user.notification_preferences,
    two_factor_enabled: user.two_factor_enabled,
    must_change_password: user.must_change_password
  };

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 86400,
    user: userResponse
  };
};

// Refresh Token Service
export const refreshTokenService = async (refreshToken, ipAddress) => {
  if (!refreshToken) {
    throw new ApiError(400, "Refresh token is required");
  }

  const session = await findSessionByRefreshToken(hashToken(refreshToken));
  if (!session) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (!session.is_active || session.expires_at < new Date()) {
    throw new ApiError(401, "Refresh token has expired");
  }

  const user = session.user_id;
  if (!user || user.status !== 'active' || user.is_deleted) {
    throw new ApiError(401, "User account is not active");
  }

  // SECURITY FIX (PATCH 38): Generate new tokens with session_id
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user, session._id.toString());

  // Update session with new tokens
  await session.refreshTokens(hashToken(accessToken), hashToken(newRefreshToken));

  return {
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: "Bearer",
    expires_in: 86400
  };
};

// SECURITY FIX (PATCH 49): Logout Service - DELETE session from database
/**
 * Secure logout service
 * PATCH 49: DELETE session from database (not just terminate)
 * SECURITY: Permanently removes session to prevent any token replay
 */
export const logoutService = async (sessionToken) => {
  if (!sessionToken) {
    throw new ApiError(400, "Session token is required");
  }

  try {
    const hashedToken = hashToken(sessionToken);
    const session = await findSessionByToken(hashedToken);

    if (session) {
      // PATCH 49: Delete the session entirely from database
      await UserSession.deleteOne({ _id: session._id });
      console.log(`🗑️  Session deleted on logout: ${session._id} (user: ${session.user_id})`);
    }

    return { message: "Logged out successfully" };
  } catch (error) {
    console.error('Logout error:', error);
    // Don't throw error - logout should always succeed
    return { message: "Logged out successfully" };
  }
};

// SECURITY FIX (PATCH 49): Logout All Sessions Service
/**
 * Logout All Sessions Service
 * PATCH 49: DELETE all user sessions from database
 * SECURITY: Removes all active sessions for security/password change scenarios
 */
export const logoutAllSessionsService = async (userId) => {
  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }

  try {
    // PATCH 49: Delete ALL sessions for this user from database
    const result = await UserSession.deleteMany({ user_id: userId });
    console.log(`🗑️  All sessions deleted for user ${userId}: ${result.deletedCount} sessions removed`);

    return {
      message: "All sessions terminated successfully",
      deletedCount: result.deletedCount
    };
  } catch (error) {
    console.error('Logout all sessions error:', error);
    // Don't throw error - logout should always succeed
    return { message: "All sessions terminated successfully" };
  }
};

// Password Reset Request Service
export const requestPasswordResetService = async (email, ipAddress, userAgent) => {
  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  // Check rate limiting by email/user
  const user = await findUserForAuth(email);
  if (user) {
    const userRateLimit = await checkRateLimitByUser(user._id, 60, 3);
    if (!userRateLimit.canRequest) {
      throw new ApiError(429, "Too many password reset requests. Please try again later");
    }
  }

  // Check rate limiting by IP
  const ipRateLimit = await checkRateLimitByIp(ipAddress, 60, 5);
  if (!ipRateLimit.canRequest) {
    throw new ApiError(429, "Too many password reset requests from this IP. Please try again later");
  }

  if (!user) {
    // Don't reveal that the email doesn't exist
    return { message: "If the email exists, a password reset link has been sent" };
  }

  if (user.status !== 'active' || user.is_deleted) {
    return { message: "If the email exists, a password reset link has been sent" };
  }

  // Create password reset request
  const { resetRequest, plainToken } = await createResetRequest(
    user._id,
    ipAddress,
    userAgent,
    60 // 1 hour expiry
  );

  // In production, send email with resetToken
  // await sendPasswordResetEmail(user.email, plainToken);

  return { 
    message: "If the email exists, a password reset link has been sent",
    // Remove this in production:
    reset_token: plainToken
  };
};

// Reset Password Service
export const resetPasswordService = async (resetToken, newPassword, ipAddress) => {
  if (!resetToken || !newPassword) {
    throw new ApiError(400, "Reset token and new password are required");
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }

  const resetRequest = await findValidToken(resetToken);
  if (!resetRequest) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  const user = resetRequest.user_id;
  if (!user || user.status !== 'active' || user.is_deleted) {
    throw new ApiError(400, "Invalid reset token");
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update password
  await updatePassword(user._id, passwordHash, null);

  // Mark reset token as used
  await useResetToken(resetRequest._id, ipAddress);

  // Terminate all user sessions (force re-login)
  await terminateAllUserSessions(user._id, 'password_reset');

  return { message: "Password reset successfully" };
};

// Setup Two-Factor Authentication Service
export const setupTwoFactorService = async (userId) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.two_factor_enabled) {
    throw new ApiError(400, "Two-factor authentication is already enabled");
  }

  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `SOC Dashboard (${user.email})`,
    issuer: 'SOC Dashboard'
  });

  // Generate QR code
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    qr_code: qrCodeUrl,
    manual_entry_key: secret.base32,
    message: "Scan QR code with your authenticator app"
  };
};

// Verify and Enable Two-Factor Authentication
export const enableTwoFactorService = async (userId, secret, totpCode) => {
  if (!secret || !totpCode) {
    throw new ApiError(400, "Secret and TOTP code are required");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Verify TOTP code
  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: totpCode,
    window: 2
  });

  if (!verified) {
    throw new ApiError(400, "Invalid TOTP code");
  }

  // Generate backup codes
  const backupCodes = Array.from({ length: 8 }, () => 
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  // Enable 2FA for user
  await enableTwoFactor(userId, secret, backupCodes);

  return {
    message: "Two-factor authentication enabled successfully",
    backup_codes: backupCodes
  };
};

// Disable Two-Factor Authentication Service
export const disableTwoFactorService = async (userId, currentPassword) => {
  if (!currentPassword) {
    throw new ApiError(400, "Current password is required");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.two_factor_enabled) {
    throw new ApiError(400, "Two-factor authentication is not enabled");
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid current password");
  }

  await disableTwoFactor(userId);

  return { message: "Two-factor authentication disabled successfully" };
};

// Validate Session Service
export const validateSessionService = async (sessionToken) => {
  if (!sessionToken) {
    throw new ApiError(401, "Session token is required");
  }

  const session = await findSessionByToken(hashToken(sessionToken));
  if (!session) {
    throw new ApiError(401, "Invalid session token");
  }

  if (!session.is_active || session.expires_at < new Date()) {
    throw new ApiError(401, "Session has expired");
  }

  const user = session.user_id;
  if (!user || user.status !== 'active' || user.is_deleted) {
    throw new ApiError(401, "User account is not active");
  }

  // Update last activity
  await updateLastActivity(user._id);

  return {
    user: {
      id: user._id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role_id?.role_name,
      organisation_id: user.organisation_id
    },
    session: {
      id: session._id,
      expires_at: session.expires_at,
      ip_address: session.ip_address
    }
  };
};

// Helper Functions
// SECURITY FIX (PATCH 38): Include session_id in JWT payload to enable server-side session invalidation
const generateTokens = (user, session_id = null) => {
  const payload = {
    id: user._id,
    username: user.username,
    role: user.role_id?.role_name,
    // SECURITY FIX: Extract ObjectId from populated field (if populated) or use directly
    organisation_id: user.organisation_id?._id || user.organisation_id,
    organisation_ids: user.organisation_ids || [],
    user_type: user.user_type,
    permissions: user.role_id?.permissions || {},
    session_id: session_id  // SECURITY: Ties JWT to server-side session
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'soc-dashboard',
    audience: 'soc-dashboard-users'
  });

  const refreshToken = jwt.sign(
    { id: user._id, type: 'refresh', session_id: session_id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'soc-dashboard',
      audience: 'soc-dashboard-users'
    }
  );

  return { accessToken, refreshToken };
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};