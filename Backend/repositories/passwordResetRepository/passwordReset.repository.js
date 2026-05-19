import PasswordReset from '../../models/passwordReset.model.js';
import mongoose from 'mongoose';

// Basic operations
export const createResetRequest = async (userId, requestIp, userAgent, expiryMinutes = 60) => {
  return await PasswordReset.createResetRequest(userId, requestIp, userAgent, expiryMinutes);
};

export const findValidToken = async (token) => {
  return await PasswordReset.findValidToken(token);
};

export const findResetRequestById = async (id) => {
  return await PasswordReset.findById(id).populate('user_id', 'username email full_name');
};

// Token management
export const useResetToken = async (tokenId, usedIp) => {
  const resetRequest = await PasswordReset.findById(tokenId);
  if (!resetRequest) return null;
  
  return await resetRequest.useToken(usedIp);
};

export const markTokenSuspicious = async (tokenId) => {
  const resetRequest = await PasswordReset.findById(tokenId);
  if (!resetRequest) return null;
  
  return await resetRequest.markSuspicious();
};

export const incrementTokenAttempts = async (tokenId) => {
  const resetRequest = await PasswordReset.findById(tokenId);
  if (!resetRequest) return null;
  
  return await resetRequest.incrementAttempts();
};

// Query operations
export const findResetRequestsByUser = async (userId, includeUsed = false) => {
  return await PasswordReset.findByUser(userId, includeUsed);
};

export const findSuspiciousRequests = async () => {
  return await PasswordReset.findSuspiciousRequests();
};

export const findRecentRequests = async (hours = 24) => {
  const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await PasswordReset.find({
    createdAt: { $gte: cutoffDate }
  }).populate('user_id', 'username email full_name');
};

export const findRequestsByIp = async (ipAddress, hours = 24) => {
  const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await PasswordReset.find({
    requested_ip: ipAddress,
    createdAt: { $gte: cutoffDate }
  }).populate('user_id', 'username email');
};

// Cleanup operations
export const cleanupExpiredTokens = async () => {
  return await PasswordReset.cleanupExpiredTokens();
};

export const deleteOldRequests = async (daysOld = 7) => {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return await PasswordReset.deleteMany({
    createdAt: { $lt: cutoffDate }
  });
};

// Security checks
export const checkRateLimitByUser = async (userId, timeWindowMinutes = 60, maxRequests = 3) => {
  const cutoffDate = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  const recentRequests = await PasswordReset.countDocuments({
    user_id: userId,
    createdAt: { $gte: cutoffDate }
  });
  
  return {
    canRequest: recentRequests < maxRequests,
    requestCount: recentRequests,
    maxRequests,
    timeWindowMinutes
  };
};

export const checkRateLimitByIp = async (ipAddress, timeWindowMinutes = 60, maxRequests = 5) => {
  const cutoffDate = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  const recentRequests = await PasswordReset.countDocuments({
    requested_ip: ipAddress,
    createdAt: { $gte: cutoffDate }
  });
  
  return {
    canRequest: recentRequests < maxRequests,
    requestCount: recentRequests,
    maxRequests,
    timeWindowMinutes
  };
};

// Statistics
export const getResetStatistics = async (days = 7) => {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const totalRequests = await PasswordReset.countDocuments({
    createdAt: { $gte: cutoffDate }
  });
  
  const usedTokens = await PasswordReset.countDocuments({
    createdAt: { $gte: cutoffDate },
    is_used: true
  });
  
  const suspiciousRequests = await PasswordReset.countDocuments({
    createdAt: { $gte: cutoffDate },
    is_suspicious: true
  });
  
  const expiredTokens = await PasswordReset.countDocuments({
    createdAt: { $gte: cutoffDate },
    expires_at: { $lt: new Date() },
    is_used: false
  });
  
  return {
    totalRequests,
    usedTokens,
    suspiciousRequests,
    expiredTokens,
    unusedTokens: totalRequests - usedTokens - expiredTokens,
    successRate: totalRequests > 0 ? Math.round((usedTokens / totalRequests) * 100) : 0
  };
};

// Token validation
export const validateToken = async (token) => {
  const resetRequest = await PasswordReset.findValidToken(token);
  if (!resetRequest) {
    return {
      valid: false,
      reason: 'Token not found or expired'
    };
  }
  
  if (resetRequest.is_used) {
    return {
      valid: false,
      reason: 'Token already used'
    };
  }
  
  if (resetRequest.is_suspicious) {
    return {
      valid: false,
      reason: 'Token marked as suspicious'
    };
  }
  
  if (resetRequest.is_expired) {
    return {
      valid: false,
      reason: 'Token expired'
    };
  }
  
  return {
    valid: true,
    resetRequest,
    user: resetRequest.user_id
  };
};

// Bulk operations
export const invalidateUserTokens = async (userId) => {
  return await PasswordReset.updateMany(
    { user_id: userId, is_used: false },
    { 
      is_used: true, 
      used_at: new Date(),
      termination_reason: 'user_request'
    }
  );
};

export const markTokensByIpSuspicious = async (ipAddress) => {
  return await PasswordReset.updateMany(
    { requested_ip: ipAddress, is_used: false },
    { is_suspicious: true }
  );
};

// Utility functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const generateSecureToken = () => {
  return PasswordReset.generateToken();
};

// Export aliases
export const createPasswordResetRequest = createResetRequest;
export const findPasswordResetById = findResetRequestById;
export const getResetRequestsByUser = findResetRequestsByUser;