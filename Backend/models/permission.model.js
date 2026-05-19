import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  permission_name: {
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

  // Permission Classification
  permission_category: {
    type: String,
    default: 'general',
    enum: [
      'general',
      'user_management',
      'organisation_management',
      'ticket_management',
      'asset_management',
      'security',
      'reporting',
      'system_administration',
      'api_access',
      'dashboard',
      'wazuh_integration'
    ]
  },

  // Resource-Action-Scope Structure
  resource: {
    type: String,
    required: true,
    trim: true
  },
  action: {
    type: String,
    required: true,
    enum: ['create', 'read', 'update', 'delete', 'manage', 'execute', 'access', 'download', 'analytics', 'quarantine', 'restore'],
    trim: true
  },
  scope: {
    type: String,
    enum: ['own', 'organisation', 'all', 'none'],
    default: 'own'
  },

  // Status
  status: {
    type: Boolean,
    default: true
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

// Compound unique index for resource-action-scope combination
permissionSchema.index({ resource: 1, action: 1, scope: 1 }, { unique: true });

// Other indexes for better performance
permissionSchema.index({ permission_category: 1 });
permissionSchema.index({ resource: 1 });
permissionSchema.index({ status: 1 });

// Virtual for full permission key
permissionSchema.virtual('permission_key').get(function() {
  return `${this.resource}:${this.action}:${this.scope}`;
});

// Virtual for display name
permissionSchema.virtual('display_name').get(function() {
  return `${this.permission_name} (${this.resource}:${this.action})`;
});

// Virtual for formatted description
permissionSchema.virtual('formatted_description').get(function() {
  const actionText = this.action.charAt(0).toUpperCase() + this.action.slice(1);
  const scopeText = this.scope === 'own' ? 'own' : 
                    this.scope === 'organisation' ? 'organisation-wide' : 
                    this.scope === 'all' ? 'all' : 'no';
  
  return this.description || `${actionText} ${this.resource} (${scopeText} scope)`;
});

// Static method to find active permissions
permissionSchema.statics.findActive = function() {
  return this.find({ status: true });
};

// Static method to find by category
permissionSchema.statics.findByCategory = function(category) {
  return this.find({ permission_category: category, status: true });
};

// Static method to find by resource
permissionSchema.statics.findByResource = function(resource) {
  return this.find({ resource: resource, status: true });
};

// Static method to find permission by key
permissionSchema.statics.findByKey = function(resource, action, scope = 'own') {
  return this.findOne({ resource, action, scope, status: true });
};

// Static method to create standard CRUD permissions for a resource
permissionSchema.statics.createCRUDPermissions = async function(resource, category = 'general', scopes = ['own', 'organisation']) {
  const actions = ['create', 'read', 'update', 'delete'];
  const permissions = [];

  for (const action of actions) {
    for (const scope of scopes) {
      try {
        const permission = new this({
          permission_name: `${resource}_${action}_${scope}`,
          resource: resource,
          action: action,
          scope: scope,
          permission_category: category,
          description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource} with ${scope} scope`
        });
        
        const saved = await permission.save();
        permissions.push(saved);
      } catch (error) {
        // Skip if permission already exists (unique constraint)
        if (error.code !== 11000) {
          throw error;
        }
      }
    }
  }

  return permissions;
};

// Instance method to check compatibility with scope
permissionSchema.methods.isCompatibleWithScope = function(requiredScope) {
  const scopeHierarchy = {
    'none': 0,
    'own': 1,
    'organisation': 2,
    'all': 3
  };

  const currentLevel = scopeHierarchy[this.scope] || 0;
  const requiredLevel = scopeHierarchy[requiredScope] || 0;

  return currentLevel >= requiredLevel;
};

// Pre-save middleware to ensure permission_name follows convention
permissionSchema.pre('save', function(next) {
  if (!this.permission_name || this.isModified('resource') || this.isModified('action') || this.isModified('scope')) {
    this.permission_name = `${this.resource}_${this.action}_${this.scope}`.toLowerCase();
  }
  next();
});

const Permission = mongoose.model('Permission', permissionSchema);
export default Permission;


