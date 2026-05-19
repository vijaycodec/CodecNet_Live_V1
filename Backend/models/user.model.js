import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  organisation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organisation',
    required: function() {
      return this.user_type === 'external' && (!this.organisation_ids || this.organisation_ids.length === 0);
    }
  },
  
  // Multiple organizations for external users who can access multiple orgs
  organisation_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organisation'
  }],
  
  // Basic Information
  username: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-zA-Z][a-zA-Z0-9_]{2,49}$/,
    trim: true
  },
  full_name: {
    type: String,
    required: true,
    minlength: 2,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
    lowercase: true,
    trim: true
  },
  phone_number: {
    type: String,
    match: /^\+[1-9]\d{0,3}\s\d{4,14}$/,  // Format: +<country code> <mobile number>
    trim: true
  },
  avatar_url: {
    type: String,
    match: /^https?:\/\/[^\s\/$.?#].[^\s]*$/
  },

  // Authentication
  password_hash: {
    type: String,
    required: true,
    select: false  // SECURITY: Never include password hash in queries
  },
  password_changed_at: {
    type: Date,
    default: Date.now
  },
  password_expires_at: {
    type: Date,
    default: null
  },
  must_change_password: {
    type: Boolean,
    default: false
  },

  // Role Assignment
  role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null
  },
  user_type: {
    type: String,
    enum: ['internal', 'external'],
    default: 'internal'
  },

  // Account Security
  status: {
    type: String,
    enum: ['active', 'inactive', 'locked', 'disabled', 'deleted'],
    default: 'active'
  },

  // Login Security
  failed_login_attempts: {
    type: Number,
    default: 0,
    min: 0
  },
  locked_until: {
    type: Date,
    default: null
  },
  last_login_at: {
    type: Date,
    default: null
  },
  last_login_ip: {
    type: String,
    default: null
  },
  last_activity_at: {
    type: Date,
    default: Date.now
  },

  // Two-Factor Authentication
  two_factor_enabled: {
    type: Boolean,
    default: false
  },
  two_factor_secret: {
    type: String,
    default: null
  },
  backup_codes: [{
    type: String
  }],

  // User Preferences
  timezone: {
    type: String,
    default: 'UTC'
  },
  locale: {
    type: String,
    default: 'en-IN'
  },
  notification_preferences: {
    type: Object,
    default: {
      email: true,
      sms: false,
      push: true
    }
  },

  // Soft Delete
  is_deleted: {
    type: Boolean,
    default: false
  },
  deleted_at: {
    type: Date,
    default: null
  },
  deleted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deletion_reason: {
    type: String,
    default: null
  },

  // Metadata
  other_attributes: {
    type: Object,
    default: {}
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // SECURITY: Remove sensitive fields from JSON output
      delete ret.password_hash;
      delete ret.two_factor_secret;
      delete ret.backup_codes;
      delete ret.reset_token;
      delete ret.reset_token_expires;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for better performance
userSchema.index({ organisation_id: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role_id: 1 });
userSchema.index({ is_deleted: 1 });
userSchema.index({ last_activity_at: -1 });

// Virtual for checking if account is locked
userSchema.virtual('is_locked').get(function() {
  return this.locked_until && this.locked_until > new Date();
});

// Virtual for full display name
userSchema.virtual('display_name').get(function() {
  return this.full_name || this.username;
});

// Pre-save middleware for soft delete validation
userSchema.pre('save', function(next) {
  if (this.is_deleted && !this.deleted_at) {
    this.deleted_at = new Date();
  }
  if (!this.is_deleted && this.deleted_at) {
    this.deleted_at = null;
    this.deleted_by = null;
    this.deletion_reason = null;
  }
  next();
});

// Pre-save middleware for updated_by tracking
userSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

const User = mongoose.model('User', userSchema);
export default User;

