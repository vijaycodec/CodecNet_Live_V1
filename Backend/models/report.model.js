import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  // Basic Information
  report_name: {
    type: String,
    required: [true, 'Report name is required'],
    trim: true,
    minlength: [3, 'Report name must be at least 3 characters'],
    maxlength: [200, 'Report name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  frequency: {
    type: String,
    enum: {
      values: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'on-demand'],
      message: '{VALUE} is not a valid frequency'
    },
    required: [true, 'Frequency is required']
  },
  template: {
    type: String,
    required: [true, 'Template is required'],
    trim: true,
    minlength: [1, 'Template cannot be empty'],
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },

  // File Information
  file_path: {
    type: String,
    required: [true, 'File path is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'File path cannot be empty'
    }
  },
  file_name: {
    type: String,
    required: [true, 'File name is required'],
    trim: true,
    minlength: [1, 'File name cannot be empty'],
    maxlength: [255, 'File name cannot exceed 255 characters']
  },
  file_size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative'],
    max: [524288000, 'File size cannot exceed 500MB'] // 500MB limit
  },
  file_extension: {
    type: String,
    default: 'pdf',
    lowercase: true,
    trim: true,
    enum: {
      values: ['pdf', 'html', 'csv', 'xlsx', 'json'],
      message: '{VALUE} is not a supported file extension'
    }
  },

  // Relationships
  organisation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organisation',
    required: [true, 'Organisation ID is required'],
    index: true,
    validate: {
      validator: function(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid organisation ID'
    }
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user ID is required'],
    validate: {
      validator: function(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid user ID'
    }
  },

  // Additional Metadata
  recipients: {
    type: String,
    trim: true,
    maxlength: [500, 'Recipients cannot exceed 500 characters'],
    default: ''
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'normal', 'high', 'critical'],
      message: '{VALUE} is not a valid priority'
    },
    default: 'normal'
  },
  report_period_start: {
    type: Date,
    validate: {
      validator: function(v) {
        // If both dates exist, start must be before end
        if (v && this.report_period_end) {
          return v <= this.report_period_end;
        }
        return true;
      },
      message: 'Report period start must be before or equal to end date'
    }
  },
  report_period_end: {
    type: Date,
    validate: {
      validator: function(v) {
        // If both dates exist, end must be after start
        if (v && this.report_period_start) {
          return v >= this.report_period_start;
        }
        return true;
      },
      message: 'Report period end must be after or equal to start date'
    }
  },

  // Soft Delete
  is_deleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deleted_at: {
    type: Date,
    default: null,
    validate: {
      validator: function(v) {
        // deleted_at should only be set if is_deleted is true
        if (v && !this.is_deleted) {
          return false;
        }
        return true;
      },
      message: 'Deleted date can only be set when is_deleted is true'
    }
  },
  deleted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    validate: {
      validator: function(v) {
        // If deleted_by is set, it must be a valid ObjectId
        if (v) {
          return mongoose.Types.ObjectId.isValid(v);
        }
        return true;
      },
      message: 'Invalid deleted by user ID'
    }
  },

  // Metadata
  metadata: {
    type: Object,
    default: {}
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    validate: {
      validator: function(v) {
        if (v) {
          return mongoose.Types.ObjectId.isValid(v);
        }
        return true;
      },
      message: 'Invalid updated by user ID'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
reportSchema.index({ organisation_id: 1, is_deleted: 1 });
reportSchema.index({ created_by: 1, is_deleted: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ frequency: 1 });

// Virtual for display name
reportSchema.virtual('display_name').get(function() {
  return this.report_name;
});

// Pre-save middleware for soft delete validation
reportSchema.pre('save', function(next) {
  if (this.is_deleted && !this.deleted_at) {
    this.deleted_at = new Date();
  }
  if (!this.is_deleted && this.deleted_at) {
    this.deleted_at = null;
    this.deleted_by = null;
  }
  next();
});

// Static method to find non-deleted reports
reportSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, is_deleted: false });
};

// Static method to find by organization
reportSchema.statics.findByOrganisation = function(organisationId, includeDeleted = false) {
  const filter = { organisation_id: organisationId };
  if (!includeDeleted) {
    filter.is_deleted = false;
  }
  return this.find(filter).sort({ createdAt: -1 });
};

// Instance method for soft delete
reportSchema.methods.softDelete = async function(deletedBy) {
  this.is_deleted = true;
  this.deleted_at = new Date();
  this.deleted_by = deletedBy;
  return await this.save();
};

// Instance method to restore
reportSchema.methods.restore = async function() {
  this.is_deleted = false;
  this.deleted_at = null;
  this.deleted_by = null;
  return await this.save();
};

const Report = mongoose.model('Report', reportSchema);
export default Report;
