import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  role_name: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },

  // Permissions (structured JSON object)
  permissions: {
    type: Object,
    default: {},
    validate: {
      validator: function(v) {
        // Basic validation to ensure it's a valid permissions object
        return v && typeof v === 'object';
      },
      message: 'Permissions must be a valid object'
    }
  },

  // Status and Lifecycle
  status: {
    type: Boolean,
    default: true
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
roleSchema.index({ status: 1 });
roleSchema.index({ is_deleted: 1 });

// Virtual for checking if role is active
roleSchema.virtual('is_active').get(function() {
  return this.status && !this.is_deleted;
});

// Virtual for display name
roleSchema.virtual('display_name').get(function() {
  return this.role_name;
});

// Pre-save middleware for soft delete validation
roleSchema.pre('save', function(next) {
  if (this.is_deleted && !this.deleted_at) {
    this.deleted_at = new Date();
  }
  if (!this.is_deleted && this.deleted_at) {
    this.deleted_at = null;
    this.deleted_by = null;
  }
  next();
});

// Instance method to check if role has specific permission
roleSchema.methods.hasPermission = function(resource, action, scope = null) {
  if (!this.permissions || typeof this.permissions !== 'object') {
    return false;
  }

  // Check if resource exists in permissions
  if (!this.permissions[resource]) {
    return false;
  }

  const resourcePerms = this.permissions[resource];
  
  // If it's a boolean, return that value
  if (typeof resourcePerms === 'boolean') {
    return resourcePerms;
  }

  // If it's an object, check for the specific action
  if (typeof resourcePerms === 'object' && resourcePerms[action]) {
    const actionPerm = resourcePerms[action];
    
    // If no scope specified, return the action permission
    if (!scope) {
      return typeof actionPerm === 'boolean' ? actionPerm : true;
    }
    
    // Check scope-specific permission
    if (typeof actionPerm === 'object' && actionPerm[scope] !== undefined) {
      return actionPerm[scope];
    }
    
    // Default to true if action exists but no scope specified
    return typeof actionPerm === 'boolean' ? actionPerm : true;
  }

  return false;
};

// Instance method to add permission
roleSchema.methods.addPermission = function(resource, action = null, scope = null, value = true) {
  if (!this.permissions) {
    this.permissions = {};
  }

  if (!action) {
    // Setting resource-level permission
    this.permissions[resource] = value;
  } else if (!scope) {
    // Setting action-level permission
    if (typeof this.permissions[resource] !== 'object' || Array.isArray(this.permissions[resource])) {
      this.permissions[resource] = {};
    }
    this.permissions[resource][action] = value;
  } else {
    // Setting scope-level permission
    if (typeof this.permissions[resource] !== 'object' || Array.isArray(this.permissions[resource])) {
      this.permissions[resource] = {};
    }
    if (typeof this.permissions[resource][action] !== 'object' || Array.isArray(this.permissions[resource][action])) {
      this.permissions[resource][action] = {};
    }
    this.permissions[resource][action][scope] = value;
  }

  this.markModified('permissions');
};

// Instance method to remove permission
roleSchema.methods.removePermission = function(resource, action = null, scope = null) {
  if (!this.permissions || !this.permissions[resource]) {
    return;
  }

  if (!action) {
    // Remove entire resource
    delete this.permissions[resource];
  } else if (!scope) {
    // Remove action from resource
    if (typeof this.permissions[resource] === 'object' && !Array.isArray(this.permissions[resource])) {
      delete this.permissions[resource][action];
    }
  } else {
    // Remove scope from action
    if (typeof this.permissions[resource] === 'object' && 
        typeof this.permissions[resource][action] === 'object' &&
        !Array.isArray(this.permissions[resource][action])) {
      delete this.permissions[resource][action][scope];
    }
  }

  this.markModified('permissions');
};

// Static method to find active roles
roleSchema.statics.findActive = function() {
  return this.find({ status: true, is_deleted: false });
};

// Static method to find roles with specific permission
roleSchema.statics.findWithPermission = function(resource, action = null, scope = null) {
  const query = { status: true, is_deleted: false };
  
  if (!action) {
    query[`permissions.${resource}`] = { $exists: true };
  } else if (!scope) {
    query[`permissions.${resource}.${action}`] = { $exists: true };
  } else {
    query[`permissions.${resource}.${action}.${scope}`] = { $exists: true };
  }

  return this.find(query);
};

const Role = mongoose.model('Role', roleSchema);
export default Role;