import mongoose from "mongoose";
import crypto from "crypto";

const passwordResetSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Reset Token
  reset_token: {
    type: String,
    required: true,
    unique: true
  },
  token_hash: {
    type: String,
    required: true
  },

  // Request Details
  requested_ip: {
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
  requested_user_agent: {
    type: String,
    trim: true
  },

  // Lifecycle
  expires_at: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  },

  // Usage
  is_used: {
    type: Boolean,
    default: false
  },
  used_at: {
    type: Date,
    default: null
  },
  used_ip: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null
        // Basic IP validation (IPv4 and IPv6)
        return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(v) ||
               /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/.test(v);
      },
      message: 'Invalid IP address format'
    }
  },

  // Security
  attempt_count: {
    type: Number,
    default: 0,
    min: 0
  },
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
passwordResetSchema.index({ user_id: 1 });
passwordResetSchema.index({ token_hash: 1 });
passwordResetSchema.index({ is_used: 1 });
passwordResetSchema.index({ requested_ip: 1 });
passwordResetSchema.index({ is_suspicious: 1 });

// Compound indexes
passwordResetSchema.index({ user_id: 1, is_used: 1 });
passwordResetSchema.index({ user_id: 1, createdAt: -1 });

// Virtual for checking if token is expired
passwordResetSchema.virtual('is_expired').get(function() {
  return this.expires_at < new Date();
});

// Virtual for checking if token is valid
passwordResetSchema.virtual('is_valid').get(function() {
  return !this.is_used && !this.is_expired && !this.is_suspicious;
});

// Virtual for time until expiry
passwordResetSchema.virtual('time_until_expiry_minutes').get(function() {
  if (this.is_expired) {
    return 0;
  }
  return Math.round((this.expires_at - new Date()) / (1000 * 60));
});

// Virtual for time since creation
passwordResetSchema.virtual('age_minutes').get(function() {
  return Math.round((new Date() - this.createdAt) / (1000 * 60));
});

// Pre-save middleware for usage validation
passwordResetSchema.pre('save', function(next) {
  // Ensure used tokens have usage data
  if (this.is_used && !this.used_at) {
    this.used_at = new Date();
  }
  
  // Clear usage data if token becomes unused
  if (!this.is_used && this.used_at) {
    this.used_at = null;
    this.used_ip = null;
  }
  
  // Ensure used tokens have used_ip if not set
  if (this.is_used && !this.used_ip && this.requested_ip) {
    this.used_ip = this.requested_ip; // Default to request IP
  }
  
  next();
});

// Pre-save middleware to generate token hash
passwordResetSchema.pre('save', function(next) {
  if (this.isModified('reset_token') && this.reset_token) {
    this.token_hash = crypto.createHash('sha256').update(this.reset_token).digest('hex');
  }
  next();
});

// Static method to generate secure token
passwordResetSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Static method to create password reset request
passwordResetSchema.statics.createResetRequest = async function(userId, requestIp, userAgent, expiryMinutes = 60) {
  // Invalidate any existing unused reset tokens for this user
  await this.updateMany(
    { user_id: userId, is_used: false },
    { is_used: true, used_at: new Date(), used_ip: requestIp }
  );

  const resetToken = this.generateToken();
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  const resetRequest = new this({
    user_id: userId,
    reset_token: resetToken,
    token_hash: tokenHash,
    requested_ip: requestIp,
    requested_user_agent: userAgent,
    expires_at: new Date(Date.now() + expiryMinutes * 60 * 1000)
  });

  await resetRequest.save();
  return { resetRequest, plainToken: resetToken };
};

// Static method to find valid token
passwordResetSchema.statics.findValidToken = function(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return this.findOne({
    token_hash: tokenHash,
    is_used: false,
    is_suspicious: false,
    expires_at: { $gt: new Date() }
  }).populate('user_id');
};

// Static method to find reset requests by user
passwordResetSchema.statics.findByUser = function(userId, includeUsed = false) {
  const query = { user_id: userId };
  if (!includeUsed) {
    query.is_used = false;
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find suspicious requests
passwordResetSchema.statics.findSuspiciousRequests = function() {
  return this.find({ is_suspicious: true }).populate('user_id');
};

// Static method to cleanup expired tokens
passwordResetSchema.statics.cleanupExpiredTokens = function() {
  return this.deleteMany({
    $or: [
      { expires_at: { $lt: new Date() } },
      { 
        is_used: true, 
        used_at: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days old
      }
    ]
  });
};

// Instance method to use token
passwordResetSchema.methods.useToken = function(usedIp) {
  if (this.is_used) {
    throw new Error('Token has already been used');
  }
  if (this.is_expired) {
    throw new Error('Token has expired');
  }
  if (this.is_suspicious) {
    throw new Error('Token is marked as suspicious');
  }

  this.is_used = true;
  this.used_at = new Date();
  this.used_ip = usedIp;
  return this.save();
};

// Instance method to mark as suspicious
passwordResetSchema.methods.markSuspicious = function() {
  this.is_suspicious = true;
  return this.save();
};

// Instance method to increment attempt count
passwordResetSchema.methods.incrementAttempts = function() {
  this.attempt_count += 1;
  
  // Mark as suspicious after too many attempts
  if (this.attempt_count >= 5) {
    this.is_suspicious = true;
  }
  
  return this.save();
};

// Instance method to verify token
passwordResetSchema.methods.verifyToken = function(providedToken) {
  const providedHash = crypto.createHash('sha256').update(providedToken).digest('hex');
  return this.token_hash === providedHash;
};

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);
export default PasswordReset;