import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const userSessionSchema = new mongoose.Schema({
  session_id: {
    type: String,
    default: uuidv4,
    unique: true,
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Session Details
  session_token: {
    type: String,
    required: true,
    unique: true
  },
  refresh_token: {
    type: String,
    // SECURITY FIX (PATCH 48): Removed unique/sparse constraints
    // Partial unique index created at database level: { refresh_token: { $exists: true, $type: 'string' } }
    // This allows multiple null values while maintaining uniqueness for actual tokens
    // Run: node scripts/fix-refresh-token-index.js to create the proper index
    default: null
  },
  device_info: {
    type: Object,
    default: {}
  },

  // Network Information
  ip_address: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Basic IP validation (IPv4 and IPv6)
        return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(v) ||
               /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/.test(v);
      },
      message: 'Invalid IP address format'
    }
  },
  user_agent: {
    type: String,
    trim: true
  },

  // Session Lifecycle
  last_activity_at: {
    type: Date,
    default: Date.now
  },
  expires_at: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  },

  // Session Status
  is_active: {
    type: Boolean,
    default: true
  },
  terminated_at: {
    type: Date,
    default: null
  },
  termination_reason: {
    type: String,
    enum: ['logout', 'timeout', 'security', 'admin', 'expired', 'replaced'],
    default: null
  },

  // Security Flags
  is_suspicious: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
userSessionSchema.index({ user_id: 1 });
userSessionSchema.index({ ip_address: 1 });
userSessionSchema.index({ is_active: 1 });
userSessionSchema.index({ last_activity_at: -1 });
userSessionSchema.index({ is_suspicious: 1 });

// Compound indexes
userSessionSchema.index({ user_id: 1, is_active: 1 });
userSessionSchema.index({ user_id: 1, last_activity_at: -1 });

// Virtual for session duration
userSessionSchema.virtual('session_duration_minutes').get(function() {
  const endTime = this.terminated_at || new Date();
  return Math.round((endTime - this.createdAt) / (1000 * 60));
});

// Virtual for time until expiry
userSessionSchema.virtual('time_until_expiry_minutes').get(function() {
  if (this.expires_at < new Date()) {
    return 0; // Already expired
  }
  return Math.round((this.expires_at - new Date()) / (1000 * 60));
});

// Virtual for checking if session is expired
userSessionSchema.virtual('is_expired').get(function() {
  return this.expires_at < new Date();
});

// Virtual for checking if session is valid
userSessionSchema.virtual('is_valid').get(function() {
  return this.is_active && !this.is_expired && !this.terminated_at;
});

// Pre-save middleware for session validation
userSessionSchema.pre('save', function(next) {
  // Ensure terminated sessions are not active
  if (this.terminated_at && this.is_active) {
    this.is_active = false;
  }
  
  // Set termination_reason if terminated but no reason given
  if (this.terminated_at && !this.termination_reason) {
    this.termination_reason = 'admin';
  }
  
  // Clear termination data if session becomes active again
  if (this.is_active && this.terminated_at) {
    this.terminated_at = null;
    this.termination_reason = null;
  }
  
  next();
});

// Pre-save middleware to update last activity
userSessionSchema.pre('save', function(next) {
  if (this.isModified() && !this.isModified('last_activity_at') && this.is_active) {
    this.last_activity_at = new Date();
  }
  next();
});

// Static method to find active sessions for user
userSessionSchema.statics.findActiveSessions = function(userId) {
  return this.find({
    user_id: userId,
    is_active: true,
    expires_at: { $gt: new Date() }
  }).sort({ last_activity_at: -1 });
};

// Static method to find suspicious sessions
userSessionSchema.statics.findSuspiciousSessions = function() {
  return this.find({ is_suspicious: true, is_active: true });
};

// Static method to find expired sessions
userSessionSchema.statics.findExpiredSessions = function() {
  return this.find({
    $or: [
      { expires_at: { $lt: new Date() } },
      { is_active: false, terminated_at: { $exists: true } }
    ]
  });
};

// Static method to clean up expired sessions
userSessionSchema.statics.cleanupExpiredSessions = function() {
  return this.deleteMany({
    $or: [
      { expires_at: { $lt: new Date() } },
      { 
        is_active: false, 
        terminated_at: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days old
      }
    ]
  });
};

// Instance method to terminate session
userSessionSchema.methods.terminate = function(reason = 'admin') {
  this.is_active = false;
  this.terminated_at = new Date();
  this.termination_reason = reason;
  return this.save();
};

// Instance method to extend session
userSessionSchema.methods.extend = function(minutes = 60) {
  if (this.is_active && !this.is_expired) {
    this.expires_at = new Date(Date.now() + minutes * 60 * 1000);
    this.last_activity_at = new Date();
    return this.save();
  }
  throw new Error('Cannot extend inactive or expired session');
};

// Instance method to refresh session tokens
userSessionSchema.methods.refreshTokens = function(newSessionToken, newRefreshToken = null) {
  if (!this.is_active || this.is_expired) {
    throw new Error('Cannot refresh tokens for inactive or expired session');
  }
  
  this.session_token = newSessionToken;
  if (newRefreshToken) {
    this.refresh_token = newRefreshToken;
  }
  this.last_activity_at = new Date();
  return this.save();
};

// Instance method to mark as suspicious
userSessionSchema.methods.markSuspicious = function(reason = null) {
  this.is_suspicious = true;
  if (reason && this.device_info) {
    this.device_info.suspicious_reason = reason;
    this.device_info.marked_suspicious_at = new Date();
  }
  return this.save();
};

// Instance method to check if session needs renewal
userSessionSchema.methods.needsRenewal = function(thresholdMinutes = 30) {
  return this.time_until_expiry_minutes <= thresholdMinutes;
};

const UserSession = mongoose.model('UserSession', userSessionSchema);
export default UserSession;