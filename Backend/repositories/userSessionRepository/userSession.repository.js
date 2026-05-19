import UserSession from '../../models/userSession.model.js';
import mongoose from 'mongoose';

// Basic CRUD operations
export const createUserSession = async (sessionData) => {
  return await UserSession.create(sessionData);
};

export const findSessionById = async (id) => {
  return await UserSession.findById(id).populate('user_id', 'username full_name email');
};

export const findSessionByToken = async (sessionToken) => {
  return await UserSession.findOne({ 
    session_token: sessionToken,
    is_active: true,
    expires_at: { $gt: new Date() }
  }).populate('user_id', 'username full_name email organisation_id');
};

export const findSessionByRefreshToken = async (refreshToken) => {
  return await UserSession.findOne({ 
    refresh_token: refreshToken,
    is_active: true,
    expires_at: { $gt: new Date() }
  }).populate('user_id');
};

// Session management
export const findActiveSessionsForUser = async (userId) => {
  return await UserSession.findActiveSessions(userId);
};

export const terminateSession = async (sessionId, reason = 'admin') => {
  const session = await UserSession.findById(sessionId);
  if (!session) return null;
  
  return await session.terminate(reason);
};

export const terminateAllUserSessions = async (userId, reason = 'admin') => {
  return await UserSession.updateMany(
    { user_id: userId, is_active: true },
    {
      is_active: false,
      terminated_at: new Date(),
      termination_reason: reason
    }
  );
};

export const extendSession = async (sessionId, minutes = 60) => {
  const session = await UserSession.findById(sessionId);
  if (!session) return null;
  
  return await session.extend(minutes);
};

export const updateSessionActivity = async (sessionId, ipAddress = null) => {
  const updateData = { last_activity_at: new Date() };
  
  if (ipAddress) {
    updateData.ip_address = ipAddress;
  }
  
  return await UserSession.findByIdAndUpdate(sessionId, updateData, { new: true });
};

// Token refresh
export const refreshSessionTokens = async (sessionId, newSessionToken, newRefreshToken = null) => {
  const session = await UserSession.findById(sessionId);
  if (!session) return null;
  
  return await session.refreshTokens(newSessionToken, newRefreshToken);
};

// Security operations
export const markSessionSuspicious = async (sessionId, reason = null) => {
  const session = await UserSession.findById(sessionId);
  if (!session) return null;
  
  return await session.markSuspicious(reason);
};

export const findSuspiciousSessions = async () => {
  return await UserSession.findSuspiciousSessions();
};

// Query operations
export const findSessionsByUser = async (userId, includeTerminated = false) => {
  const query = { user_id: userId };
  
  if (!includeTerminated) {
    query.is_active = true;
  }
  
  return await UserSession.find(query)
    .sort({ last_activity_at: -1 })
    .limit(10);
};

export const findSessionsByIpAddress = async (ipAddress, limit = 20) => {
  return await UserSession.find({ ip_address: ipAddress })
    .populate('user_id', 'username full_name email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

export const findExpiredSessions = async () => {
  return await UserSession.findExpiredSessions();
};

// Cleanup operations
export const cleanupExpiredSessions = async () => {
  return await UserSession.cleanupExpiredSessions();
};

export const cleanupOldSessions = async (daysOld = 30) => {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return await UserSession.deleteMany({
    is_active: false,
    terminated_at: { $lt: cutoffDate }
  });
};

// Statistics
export const getSessionStatistics = async () => {
  const totalActive = await UserSession.countDocuments({ is_active: true });
  const totalSuspicious = await UserSession.countDocuments({ is_suspicious: true, is_active: true });
  const expiringSoon = await UserSession.countDocuments({
    is_active: true,
    expires_at: { $lt: new Date(Date.now() + 30 * 60 * 1000) } // 30 minutes
  });
  
  return {
    totalActiveSessions: totalActive,
    suspiciousSessions: totalSuspicious,
    expiringSoon
  };
};

export const getUserSessionCount = async (userId) => {
  return await UserSession.countDocuments({
    user_id: userId,
    is_active: true
  });
};

// Device tracking
export const findSessionsByDevice = async (deviceFingerprint) => {
  return await UserSession.find({
    'device_info.fingerprint': deviceFingerprint
  }).populate('user_id', 'username full_name email');
};

export const updateDeviceInfo = async (sessionId, deviceInfo) => {
  return await UserSession.findByIdAndUpdate(sessionId, {
    device_info: deviceInfo
  }, { new: true });
};

// Validation functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validateSessionExists = async (sessionId) => {
  const session = await UserSession.findById(sessionId);
  return !!session;
};

export const validateActiveSession = async (sessionId) => {
  const session = await UserSession.findById(sessionId);
  return !!session && session.is_valid;
};

// PATCH 54: Delete operations for concurrent session prevention
export const deleteSessionById = async (sessionId) => {
  return await UserSession.deleteOne({ _id: sessionId });
};

export const deleteAllUserSessions = async (userId) => {
  return await UserSession.deleteMany({ user_id: userId, is_active: true });
};

// Export aliases
export const getUserSessions = findActiveSessionsForUser;
export const getSessionById = findSessionById;