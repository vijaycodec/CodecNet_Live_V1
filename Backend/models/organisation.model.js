import mongoose from "mongoose";

const organisationSchema = new mongoose.Schema({
  // Basic Information
  client_name: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    trim: true
  },
  organisation_name: {
    type: String,
    required: true,
    minlength: 3,
    trim: true
  },
  industry: {
    type: String,
    required: true,
    maxlength: 100
  },
  organisation_type: {
    type: String,
    enum: ['Client', 'SAAS', 'Internal'],
    default: 'Client'
  },

  // Subscription Management
  subscription_plan_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  subscription_start_date: {
    type: Date,
    default: Date.now
  },
  subscription_end_date: {
    type: Date,
    default: null
  },
  subscription_status: {
    type: String,
    enum: ['active', 'suspended', 'cancelled', 'expired'],
    default: 'active'
  },

  // Usage Tracking
  current_user_count: {
    type: Number,
    default: 0,
    min: 0
  },
  current_asset_count: {
    type: Number,
    default: 0,
    min: 0
  },

  // Overage Tracking for Assets
  assets_over_limit: {
    type: Number,
    default: 0,
    min: 0
  },
  overage_start_date: {
    type: Date,
    default: null
  },
  overage_notifications_sent: {
    type: Number,
    default: 0,
    min: 0
  },
  last_overage_notification: {
    type: Date,
    default: null
  },

  // Wazuh Integration Settings
  wazuh_manager_ip: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v);
      },
      message: 'Invalid IP address format'
    }
  },
  wazuh_manager_port: {
    type: Number,
    min: 1,
    max: 65535
  },
  wazuh_indexer_ip: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v);
      },
      message: 'Invalid IP address format'
    }
  },
  wazuh_indexer_port: {
    type: Number,
    min: 1,
    max: 65535
  },
  wazuh_dashboard_ip: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v);
      },
      message: 'Invalid IP address format'
    }
  },
  wazuh_dashboard_port: {
    type: Number,
    min: 1,
    max: 65535
  },

  // Wazuh Authentication Credentials
  // SECURITY: Credentials stored but NEVER exposed in API responses
  // PATCH 42 (CWE-256): Password fields support both String (legacy) and Object (encrypted)
  wazuh_manager_username: {
    type: String,
    trim: true,
    select: false  // SECURITY: Never include in default queries
  },
  wazuh_manager_password: {
    type: mongoose.Schema.Types.Mixed,  // ✅ Supports both String (legacy) and Object (encrypted)
    select: false  // SECURITY: Never include in default queries
  },
  wazuh_indexer_username: {
    type: String,
    trim: true,
    select: false  // SECURITY: Never include in default queries
  },
  wazuh_indexer_password: {
    type: mongoose.Schema.Types.Mixed,  // ✅ Supports both String (legacy) and Object (encrypted)
    select: false  // SECURITY: Never include in default queries
  },
  wazuh_dashboard_username: {
    type: String,
    trim: true,
    select: false  // SECURITY: Never include in default queries
  },
  wazuh_dashboard_password: {
    type: mongoose.Schema.Types.Mixed,  // ✅ Supports both String (legacy) and Object (encrypted)
    select: false  // SECURITY: Never include in default queries
  },

  // Legacy field for backward compatibility
  initial_assets: {
    type: Number,
    default: 0,
    min: 0
  },

  // Contact Information
  emails: [{
    type: String,
    match: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
  }],
  // Critical Alert Notification - dynamic CC list (scalable)
  cc_emails: [{
    type: String,
    match: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
  }],
  alert_email_notifications_enabled: {
    type: Boolean,
    default: true
  },
  phone_numbers: [{
    type: String,
    match: /^\+[1-9]\d{0,3}\s\d{4,14}$/  // Format: +<country code> <mobile number>
  }],

  // Organization Settings
  timezone: {
    type: String,
    default: 'UTC'
  },
  locale: {
    type: String,
    default: 'en-IN'
  },
  date_format: {
    type: String,
    default: 'YYYY-MM-DD'
  },

  // Status and Security
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'deleted'],
    default: 'active'
  },
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
      // SECURITY: Only remove credentials if they weren't explicitly selected
      const includeCredentials = doc._includeCredentials === true;

      if (!includeCredentials) {
        // Remove sensitive credentials from JSON output by default
        delete ret.wazuh_manager_password;
        delete ret.wazuh_indexer_password;
        delete ret.wazuh_dashboard_password;
        delete ret.wazuh_manager_username;
        delete ret.wazuh_indexer_username;
        delete ret.wazuh_dashboard_username;
      }
      // Note: IPs and ports are kept for internal use but never exposed in API responses
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for better performance
organisationSchema.index({ subscription_plan_id: 1 });
organisationSchema.index({ subscription_status: 1 });
organisationSchema.index({ status: 1 });
organisationSchema.index({ is_deleted: 1 });
organisationSchema.index({ organisation_type: 1 });

// Virtual for checking if subscription is active
organisationSchema.virtual('is_subscription_active').get(function() {
  return this.subscription_status === 'active' && 
         (!this.subscription_end_date || this.subscription_end_date > new Date());
});

// Virtual for checking asset limit status
organisationSchema.virtual('asset_limit_status').get(function() {
  if (!this.subscription_plan_id) return 'unknown';
  // This would need to be populated with subscription plan data
  return this.current_asset_count > (this.subscription_plan_id.max_assets || 0) ? 'over_limit' : 'within_limit';
});

// Virtual for display name
organisationSchema.virtual('display_name').get(function() {
  return this.organisation_name || this.client_name;
});

// Pre-save middleware for soft delete validation
organisationSchema.pre('save', function(next) {
  if (this.is_deleted && !this.deleted_at) {
    this.deleted_at = new Date();
  }
  if (!this.is_deleted && this.deleted_at) {
    this.deleted_at = null;
    this.deleted_by = null;
  }
  
  // Validate subscription dates
  if (this.subscription_end_date && this.subscription_start_date && 
      this.subscription_end_date <= this.subscription_start_date) {
    return next(new Error('Subscription end date must be after start date'));
  }
  
  next();
});

// Static method to find active organizations
organisationSchema.statics.findActive = function() {
  return this.find({ status: 'active', is_deleted: false });
};

// Static method to find by subscription status
organisationSchema.statics.findBySubscriptionStatus = function(status) {
  return this.find({ subscription_status: status, is_deleted: false });
};

// Instance method to check if over asset limit
organisationSchema.methods.isOverAssetLimit = async function() {
  await this.populate('subscription_plan_id');
  return this.current_asset_count > this.subscription_plan_id.max_assets;
};

// Instance method to check if over user limit
organisationSchema.methods.isOverUserLimit = async function() {
  await this.populate('subscription_plan_id');
  return this.current_user_count >= this.subscription_plan_id.max_users;
};

const Organisation = mongoose.model('Organisation', organisationSchema);
export default Organisation;