import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  ticket_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assigned_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Assignment Type and Role
  assignment_type: {
    type: String,
    enum: ['primary', 'secondary', 'reviewer', 'observer', 'escalation'],
    default: 'primary'
  },
  assignment_role: {
    type: String,
    maxlength: 100,
    trim: true,
    default: null
  },

  // Assignment Status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'declined', 'cancelled', 'escalated'],
    default: 'pending'
  },
  previous_status: {
    type: String,
    default: null
  },
  status_changed_at: {
    type: Date,
    default: Date.now
  },

  // Priority and Timeline
  due_date: {
    type: Date,
    default: null
  },

  // Assignment Lifecycle
  accepted_at: {
    type: Date,
    default: null
  },
  started_at: {
    type: Date,
    default: null
  },
  completed_at: {
    type: Date,
    default: null
  },

  // Work Tracking
  estimated_hours: {
    type: mongoose.Schema.Types.Decimal128,
    min: 0,
    get: function(v) {
      return v ? parseFloat(v.toString()) : null;
    }
  },
  actual_hours: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: 0,
    get: function(v) {
      return v ? parseFloat(v.toString()) : 0;
    }
  },

  // Notes and Communication
  assignment_notes: {
    type: String,
    trim: true
  },
  completion_notes: {
    type: String,
    trim: true
  },
  work_log: {
    type: Array,
    default: [],
    validate: {
      validator: function(v) {
        // Validate that work_log is an array of objects with required fields
        return Array.isArray(v) && v.every(entry => 
          entry && 
          typeof entry === 'object' && 
          entry.timestamp && 
          entry.description
        );
      },
      message: 'Work log entries must have timestamp and description'
    }
  },

  // Escalation
  escalated_from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    default: null
  },
  escalation_reason: {
    type: String,
    trim: true,
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
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Indexes for better performance
assignmentSchema.index({ ticket_id: 1 });
assignmentSchema.index({ assigned_to: 1 });
assignmentSchema.index({ assigned_by: 1 });
assignmentSchema.index({ assignment_type: 1 });
assignmentSchema.index({ status: 1 });
assignmentSchema.index({ due_date: 1 });
assignmentSchema.index({ escalated_from: 1 });

// Compound indexes
assignmentSchema.index({ ticket_id: 1, assignment_type: 1 });
assignmentSchema.index({ assigned_to: 1, status: 1 });
assignmentSchema.index({ ticket_id: 1, status: 1 });
assignmentSchema.index({ status: 1, due_date: 1 });

// Virtual for checking if assignment is overdue
assignmentSchema.virtual('is_overdue').get(function() {
  return this.due_date && this.due_date < new Date() && !['completed', 'cancelled'].includes(this.status);
});

// Virtual for checking if assignment is active
assignmentSchema.virtual('is_active').get(function() {
  return ['pending', 'accepted', 'in_progress'].includes(this.status);
});

// Virtual for total time spent calculation
assignmentSchema.virtual('total_time_minutes').get(function() {
  if (this.completed_at && this.started_at) {
    return Math.round((this.completed_at - this.started_at) / (1000 * 60));
  }
  if (this.started_at && this.is_active) {
    return Math.round((new Date() - this.started_at) / (1000 * 60));
  }
  return null;
});

// Virtual for response time calculation
assignmentSchema.virtual('response_time_minutes').get(function() {
  if (this.accepted_at && this.createdAt) {
    return Math.round((this.accepted_at - this.createdAt) / (1000 * 60));
  }
  return null;
});

// Virtual for display status
assignmentSchema.virtual('display_status').get(function() {
  return this.status.charAt(0).toUpperCase() + this.status.slice(1).replace('_', ' ');
});

// Virtual for completion percentage
assignmentSchema.virtual('completion_percentage').get(function() {
  if (!this.estimated_hours || this.estimated_hours <= 0) {
    return this.status === 'completed' ? 100 : 0;
  }
  
  const estimatedHours = parseFloat(this.estimated_hours.toString());
  const actualHours = parseFloat(this.actual_hours.toString());
  
  if (this.status === 'completed') {
    return 100;
  }
  
  return Math.min(Math.round((actualHours / estimatedHours) * 100), 100);
});

// Pre-save middleware for timeline validation
assignmentSchema.pre('save', function(next) {
  const now = new Date();
  
  // Validate timeline consistency
  if (this.accepted_at && this.accepted_at < this.createdAt) {
    return next(new Error('Acceptance date cannot be before creation date'));
  }
  
  if (this.started_at && this.accepted_at && this.started_at < this.accepted_at) {
    return next(new Error('Start date cannot be before acceptance date'));
  }
  
  if (this.completed_at && this.started_at && this.completed_at < this.started_at) {
    return next(new Error('Completion date cannot be before start date'));
  }
  
  next();
});

// Pre-save middleware for status transitions
assignmentSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const oldStatus = this.constructor.findOne({ _id: this._id })?.status;
    this.previous_status = oldStatus;
    this.status_changed_at = new Date();

    // Set timestamps based on status changes
    switch (this.status) {
      case 'accepted':
        if (!this.accepted_at) {
          this.accepted_at = new Date();
        }
        break;
      case 'in_progress':
        if (!this.started_at) {
          this.started_at = new Date();
        }
        if (!this.accepted_at) {
          this.accepted_at = new Date();
        }
        break;
      case 'completed':
        if (!this.completed_at) {
          this.completed_at = new Date();
        }
        break;
      case 'cancelled':
      case 'declined':
        // Clear progression timestamps if assignment is cancelled/declined
        this.started_at = null;
        this.completed_at = null;
        break;
    }
  }
  
  next();
});

// Pre-save middleware to prevent self-escalation
assignmentSchema.pre('save', function(next) {
  if (this.escalated_from && this.escalated_from.toString() === this._id.toString()) {
    return next(new Error('Assignment cannot escalate from itself'));
  }
  next();
});

// Static method to find assignments by status
assignmentSchema.statics.findByStatus = function(status, userId = null) {
  const query = { status };
  if (userId) {
    query.assigned_to = userId;
  }
  return this.find(query).populate('ticket_id assigned_to assigned_by');
};

// Static method to find overdue assignments
assignmentSchema.statics.findOverdue = function(userId = null) {
  const query = {
    due_date: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled', 'declined'] }
  };
  if (userId) {
    query.assigned_to = userId;
  }
  return this.find(query).populate('ticket_id assigned_to assigned_by');
};

// Static method to find active assignments for user
assignmentSchema.statics.findActiveForUser = function(userId) {
  return this.find({
    assigned_to: userId,
    status: { $in: ['pending', 'accepted', 'in_progress'] }
  }).populate('ticket_id assigned_by');
};

// Static method to find assignments by ticket
assignmentSchema.statics.findByTicket = function(ticketId) {
  return this.find({ ticket_id: ticketId })
    .populate('assigned_to assigned_by escalated_from')
    .sort({ createdAt: -1 });
};

// Instance method to accept assignment
assignmentSchema.methods.accept = function(userId, notes = null) {
  if (this.status !== 'pending') {
    throw new Error('Only pending assignments can be accepted');
  }
  
  this.status = 'accepted';
  this.accepted_at = new Date();
  if (notes) {
    this.assignment_notes = notes;
  }
  this.updated_by = userId;
  return this.save();
};

// Instance method to start work
assignmentSchema.methods.startWork = function(userId, notes = null) {
  if (!['pending', 'accepted'].includes(this.status)) {
    throw new Error('Assignment must be pending or accepted to start work');
  }
  
  this.status = 'in_progress';
  this.started_at = new Date();
  if (!this.accepted_at) {
    this.accepted_at = new Date();
  }
  if (notes) {
    this.assignment_notes = notes;
  }
  this.updated_by = userId;
  return this.save();
};

// Instance method to complete assignment
assignmentSchema.methods.complete = function(userId, completionNotes = null) {
  if (this.status !== 'in_progress') {
    throw new Error('Only in-progress assignments can be completed');
  }
  
  this.status = 'completed';
  this.completed_at = new Date();
  if (completionNotes) {
    this.completion_notes = completionNotes;
  }
  this.updated_by = userId;
  return this.save();
};

// Instance method to decline assignment
assignmentSchema.methods.decline = function(userId, reason = null) {
  if (this.status !== 'pending') {
    throw new Error('Only pending assignments can be declined');
  }
  
  this.status = 'declined';
  if (reason) {
    this.assignment_notes = reason;
  }
  this.updated_by = userId;
  return this.save();
};

// Instance method to escalate assignment
assignmentSchema.methods.escalate = function(newAssignee, escalatedBy, reason = null) {
  const EscalatedAssignment = this.constructor;
  
  // Mark current assignment as escalated
  this.status = 'escalated';
  this.escalation_reason = reason;
  this.updated_by = escalatedBy;
  
  // Create new escalated assignment
  const newAssignment = new EscalatedAssignment({
    ticket_id: this.ticket_id,
    assigned_to: newAssignee,
    assigned_by: escalatedBy,
    assignment_type: 'escalation',
    escalated_from: this._id,
    escalation_reason: reason,
    assignment_notes: `Escalated from previous assignment: ${reason || 'No reason provided'}`,
    created_by: escalatedBy,
    updated_by: escalatedBy
  });
  
  return Promise.all([this.save(), newAssignment.save()]);
};

// Instance method to add work log entry
assignmentSchema.methods.addWorkLog = function(description, hoursWorked = 0, userId = null) {
  const workLogEntry = {
    timestamp: new Date(),
    description: description,
    hours_worked: hoursWorked,
    logged_by: userId
  };
  
  this.work_log.push(workLogEntry);
  
  // Update actual hours
  if (hoursWorked > 0) {
    const currentActual = parseFloat(this.actual_hours.toString()) || 0;
    this.actual_hours = mongoose.Types.Decimal128.fromString((currentActual + hoursWorked).toString());
  }
  
  this.markModified('work_log');
  if (userId) {
    this.updated_by = userId;
  }
  
  return this.save();
};

const Assignment = mongoose.model('Assignment', assignmentSchema);
export default Assignment;