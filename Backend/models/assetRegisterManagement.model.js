import mongoose from "mongoose";

const assetRegisterManagementSchema = new mongoose.Schema({
  organisation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organisation',
    required: true
  },

  // Asset Identification
  asset_tag: {
    type: String,
    required: true,
    trim: true
  },
  asset_name: {
    type: String,
    required: true,
    minlength: 3,
    trim: true
  },

  // Asset Classification
  asset_type: {
    type: String,
    enum: [
      'endpoint', 'server', 'network_device', 'mobile_device', 'iot_device',
      'virtual_machine', 'cloud_instance', 'container', 'application',
      'database', 'security_device', 'storage_device', 'printer', 'other'
    ],
    default: 'endpoint'
  },
  asset_category: {
    type: String,
    maxlength: 50,
    trim: true
  },

  // Network Configuration
  ip_address: {
    type: String,
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
  mac_address: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null
        return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(v);
      },
      message: 'Invalid MAC address format'
    },
    trim: true
  },
  network_zone: {
    type: String,
    enum: ['internal', 'dmz', 'external', 'management', 'guest'],
    default: 'internal'
  },

  // System Information
  operating_system: {
    type: String,
    maxlength: 100,
    trim: true
  },
  os_version: {
    type: String,
    maxlength: 50,
    trim: true
  },
  os_architecture: {
    type: String,
    enum: ['x86', 'x64', 'x86_64', 'i386', 'i686', 'arm', 'arm64', 'aarch64'],
    trim: true
  },
  kernel_version: {
    type: String,
    maxlength: 200,
    trim: true
  },

  // Wazuh Integration
  wazuh_agent_id: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null
        return /^[0-9]+$/.test(v);
      },
      message: 'Wazuh agent ID must be numeric'
    },
    trim: true
  },
  wazuh_agent_name: {
    type: String,
    maxlength: 255,
    trim: true
  },
  wazuh_agent_status: {
    type: String,
    enum: ['pending', 'active', 'disconnected', 'never_connected', 'disabled', 'removed'],
    default: 'pending'
  },
  last_keepalive: {
    type: Date,
    default: null
  },

  // Asset Status and Classification
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'quarantined', 'retired'],
    default: 'active'
  },
  previous_status: {
    type: String,
    default: null
  },
  status_changed_at: {
    type: Date,
    default: Date.now
  },
  status_changed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Risk and Security Classification
  asset_criticality: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  data_classification: {
    type: String,
    enum: ['public', 'internal', 'confidential', 'restricted'],
    default: 'internal'
  },

  // Environment Information
  environment: {
    type: String,
    enum: ['development', 'testing', 'staging', 'production', 'disaster_recovery'],
    default: 'production'
  },

  // Hardware/Infrastructure Details
  manufacturer: {
    type: String,
    maxlength: 100,
    trim: true
  },
  model: {
    type: String,
    maxlength: 100,
    trim: true
  },
  serial_number: {
    type: String,
    maxlength: 100,
    trim: true
  },
  location: {
    type: String,
    maxlength: 200,
    trim: true
  },
  physical_location: {
    building: { type: String, trim: true },
    floor: { type: String, trim: true },
    room: { type: String, trim: true },
    rack: { type: String, trim: true }
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
    trim: true,
    default: null
  },

  // Additional Fields
  notes: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
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
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Compound unique index for asset_tag per organisation
assetRegisterManagementSchema.index({ organisation_id: 1, asset_tag: 1 }, { unique: true });

// Other indexes for better performance
assetRegisterManagementSchema.index({ organisation_id: 1 });
assetRegisterManagementSchema.index({ asset_type: 1 });
assetRegisterManagementSchema.index({ status: 1 });
assetRegisterManagementSchema.index({ wazuh_agent_id: 1 });
assetRegisterManagementSchema.index({ wazuh_agent_status: 1 });
assetRegisterManagementSchema.index({ asset_criticality: 1 });
assetRegisterManagementSchema.index({ ip_address: 1 });
assetRegisterManagementSchema.index({ is_deleted: 1 });
assetRegisterManagementSchema.index({ last_keepalive: -1 });

// Compound indexes
assetRegisterManagementSchema.index({ organisation_id: 1, status: 1 });
assetRegisterManagementSchema.index({ organisation_id: 1, asset_type: 1 });
assetRegisterManagementSchema.index({ organisation_id: 1, wazuh_agent_status: 1 });
assetRegisterManagementSchema.index({ organisation_id: 1, wazuh_agent_id: 1 }, { unique: true, sparse: true });
assetRegisterManagementSchema.index({ status: 1, asset_criticality: 1 });

// Virtual for checking if asset is online (based on Wazuh keepalive)
assetRegisterManagementSchema.virtual('is_online').get(function() {
  if (!this.last_keepalive || this.wazuh_agent_status !== 'active') {
    return false;
  }
  // Consider online if keepalive within last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.last_keepalive > fiveMinutesAgo;
});

// Virtual for asset age
assetRegisterManagementSchema.virtual('asset_age_days').get(function() {
  if (!this.installation_date && !this.acquisition_date) {
    return null;
  }
  const startDate = this.installation_date || this.acquisition_date;
  return Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for warranty status
assetRegisterManagementSchema.virtual('warranty_status').get(function() {
  if (!this.warranty_expiry_date) {
    return 'unknown';
  }
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  if (this.warranty_expiry_date < now) {
    return 'expired';
  } else if (this.warranty_expiry_date < thirtyDaysFromNow) {
    return 'expiring_soon';
  } else {
    return 'valid';
  }
});

// Virtual for display name
assetRegisterManagementSchema.virtual('display_name').get(function() {
  return `${this.asset_name} (${this.asset_tag})`;
});

// Virtual for full location
assetRegisterManagementSchema.virtual('full_location').get(function() {
  const parts = [];
  if (this.location) parts.push(this.location);
  if (this.physical_location) {
    const { building, floor, room, rack } = this.physical_location;
    const physicalParts = [building, floor, room, rack].filter(Boolean);
    if (physicalParts.length > 0) {
      parts.push(physicalParts.join(' / '));
    }
  }
  return parts.join(' - ') || 'Unknown';
});

// Pre-save middleware for status tracking
assetRegisterManagementSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.previous_status = this.constructor.findOne({ _id: this._id })?.status;
    this.status_changed_at = new Date();
  }
  next();
});

// Pre-save middleware for soft delete validation
assetRegisterManagementSchema.pre('save', function(next) {
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

// Static method to find active assets
assetRegisterManagementSchema.statics.findActive = function(organisationId = null) {
  const query = { status: 'active', is_deleted: false };
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  return this.find(query);
};

// Static method to find assets by type
assetRegisterManagementSchema.statics.findByType = function(assetType, organisationId = null) {
  const query = { asset_type: assetType, is_deleted: false };
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  return this.find(query);
};

// Static method to find assets by Wazuh status
assetRegisterManagementSchema.statics.findByWazuhStatus = function(status, organisationId = null) {
  const query = { wazuh_agent_status: status, is_deleted: false };
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  return this.find(query);
};

// Static method to find offline assets
assetRegisterManagementSchema.statics.findOffline = function(organisationId = null, minutesThreshold = 5) {
  const thresholdTime = new Date(Date.now() - minutesThreshold * 60 * 1000);
  const query = {
    is_deleted: false,
    $or: [
      { last_keepalive: { $lt: thresholdTime } },
      { last_keepalive: null },
      { wazuh_agent_status: { $ne: 'active' } }
    ]
  };
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  return this.find(query);
};

// Static method to find assets with expiring warranties
assetRegisterManagementSchema.statics.findExpiringWarranties = function(daysThreshold = 30, organisationId = null) {
  const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
  const query = {
    warranty_expiry_date: { 
      $gte: new Date(),
      $lte: thresholdDate 
    },
    is_deleted: false
  };
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  return this.find(query);
};

// Instance method to retire asset
assetRegisterManagementSchema.methods.retire = function(userId, reason = null) {
  this.status = 'retired';
  this.retirement_date = new Date();
  this.status_changed_by = userId;
  this.updated_by = userId;
  if (reason) {
    this.notes = (this.notes ? this.notes + '\n' : '') + `Retired: ${reason}`;
  }
  return this.save();
};

// Instance method to quarantine asset
assetRegisterManagementSchema.methods.quarantine = function(userId, reason = null) {
  this.status = 'quarantined';
  this.status_changed_by = userId;
  this.updated_by = userId;
  if (reason) {
    this.notes = (this.notes ? this.notes + '\n' : '') + `Quarantined: ${reason}`;
  }
  return this.save();
};

// Instance method to update Wazuh status
assetRegisterManagementSchema.methods.updateWazuhStatus = function(status, keepalive = null) {
  this.wazuh_agent_status = status;
  if (keepalive) {
    this.last_keepalive = keepalive;
  }
  return this.save();
};

// Instance method to assign to user
assetRegisterManagementSchema.methods.assignToUser = function(userId, assignmentType = 'technical_owner') {
  if (!['business_owner', 'technical_owner'].includes(assignmentType)) {
    throw new Error('Invalid assignment type');
  }
  this[assignmentType] = userId;
  this.updated_by = userId;
  return this.save();
};

const AssetRegister = mongoose.model('AssetRegister', assetRegisterManagementSchema);
export default AssetRegister;