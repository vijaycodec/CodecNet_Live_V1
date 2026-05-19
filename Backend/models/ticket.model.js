import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema({
    organisation_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organisation',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Ticket Identification
    ticket_number: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        minlength: 3,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },

    // Classification
    severity: {
        type: String,
        enum: ['minor', 'major', 'critical'],
        required: true  // Make it required instead of having a default
    },
    ticket_type: {
        type: String,
        default: 'alert',
        trim: true
    },
    category: {
        type: String,
        maxlength: 100,
        trim: true
    },
    subcategory: {
        type: String,
        maxlength: 100,
        trim: true
    },

    // Status and Workflow
    ticket_status: {
        type: String,
        enum: ['open', 'investigating', 'resolved'],
        default: 'open'
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

    // Timeline Management
    due_date: {
        type: Date,
        default: null
    },
    first_response_at: {
        type: Date,
        default: null
    },
    resolved_at: {
        type: Date,
        default: null
    },
    resolution_notes: {
        type: String,
        trim: true
    },
    resolution_type: {
        type: String,
        enum: ['false_positive', 'true_positive'],
        default: null
    },

    // Time Tracking
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

    // Asset Relationship (now supports both ObjectId and string for Wazuh agent IDs)
    related_asset_id: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Tags and Metadata
    tags: [{
        type: String,
        trim: true
    }],
    custom_fields: {
        type: Object,
        default: {}
    },

    // SLA Tracking
    sla_breach: {
        type: Boolean,
        default: false
    },
    sla_due_date: {
        type: Date,
        default: null
    },

    // Legacy Alert/Security fields (for backward compatibility)
    alertId: {
        type: String,
        trim: true
    },
    ruleId: {
        type: String,
        trim: true
    },
    ruleName: {
        type: String,
        trim: true
    },
    hostName: {
        type: String,
        trim: true
    },
    agentName: {
        type: String,
        trim: true
    },
    sourceIp: {
        type: String,
        trim: true
    },
    alertTimestamp: {
        type: Date
    },

    // JIRA Integration (legacy)
    jiraIssueKey: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    jiraIssueUrl: {
        type: String,
        trim: true
    },

    // Comments (legacy - consider moving to separate collection)
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        comment: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Attachments (legacy - consider moving to separate collection)
    attachments: [{
        filename: String,
        url: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],

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

// Indexes for better query performance
ticketSchema.index({ organisation_id: 1 });
ticketSchema.index({ user_id: 1 });
ticketSchema.index({ ticket_status: 1 });
ticketSchema.index({ severity: 1 });
ticketSchema.index({ ticket_type: 1 });
ticketSchema.index({ category: 1 });
ticketSchema.index({ due_date: 1 });
ticketSchema.index({ sla_due_date: 1 });
ticketSchema.index({ related_asset_id: 1 });
ticketSchema.index({ createdAt: -1 });

// Compound indexes
ticketSchema.index({ organisation_id: 1, ticket_status: 1 });
ticketSchema.index({ organisation_id: 1, severity: 1 });
ticketSchema.index({ ticket_status: 1, due_date: 1 });

// Virtual for checking if ticket is overdue
ticketSchema.virtual('is_overdue').get(function() {
    return this.due_date && this.due_date < new Date() && this.ticket_status !== 'resolved';
});

// Virtual for checking if SLA is breached
ticketSchema.virtual('is_sla_breached').get(function() {
    return this.sla_breach || (this.sla_due_date && this.sla_due_date < new Date() && this.ticket_status !== 'resolved');
});

// Virtual for time to resolve calculation
ticketSchema.virtual('resolution_time_minutes').get(function() {
    if (this.resolved_at && this.createdAt) {
        return Math.round((this.resolved_at - this.createdAt) / (1000 * 60));
    }
    return null;
});

// Virtual for time to first response calculation
ticketSchema.virtual('first_response_time_minutes').get(function() {
    if (this.first_response_at && this.createdAt) {
        return Math.round((this.first_response_at - this.createdAt) / (1000 * 60));
    }
    return null;
});

// Virtual for display status
ticketSchema.virtual('display_status').get(function() {
    return this.ticket_status.charAt(0).toUpperCase() + this.ticket_status.slice(1);
});

// Pre-validate middleware for ticket number generation (runs before validation)
ticketSchema.pre('validate', async function(next) {
    console.log('=== PRE-SAVE MIDDLEWARE TRIGGERED ===');
    console.log('this.isNew:', this.isNew);
    console.log('this.ticket_number:', this.ticket_number);
    console.log('this.organisation_id:', this.organisation_id);

    if (this.isNew && !this.ticket_number) {
        // Generate ticket number using full organisation_id for uniqueness and traceability
        const orgId = this.organisation_id ? this.organisation_id.toString() : 'SYSTEM';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 4).toUpperCase();
        this.ticket_number = `TKT-${orgId}-${timestamp}-${random}`;
        console.log('Generated ticket_number:', this.ticket_number);
    }
    next();
});

// Pre-save middleware for status tracking
ticketSchema.pre('save', async function(next) {
    if (this.isModified('ticket_status')) {
        // Only fetch previous status if this is an existing ticket (not new)
        if (!this.isNew && this._id) {
            try {
                const existingTicket = await this.constructor.findOne({ _id: this._id }).select('ticket_status');
                if (existingTicket) {
                    this.previous_status = existingTicket.ticket_status;
                }
            } catch (error) {
                console.error('Error fetching previous status:', error);
            }
        }
        this.status_changed_at = new Date();

        // Set resolved_at when status becomes resolved
        if (this.ticket_status === 'resolved' && !this.resolved_at) {
            this.resolved_at = new Date();
        }

        // Clear resolved_at if status changes from resolved
        if (this.ticket_status !== 'resolved' && this.resolved_at) {
            this.resolved_at = null;
            this.resolution_notes = null;
        }
    }
    next();
});

// Pre-save middleware for SLA breach detection
ticketSchema.pre('save', function(next) {
    if (this.sla_due_date && this.sla_due_date < new Date() && this.ticket_status !== 'resolved') {
        this.sla_breach = true;
    }
    next();
});

// Static method to find tickets by status
ticketSchema.statics.findByStatus = function(status, organisationId = null) {
    const query = { ticket_status: status };
    if (organisationId) {
        query.organisation_id = organisationId;
    }
    return this.find(query);
};

// Static method to find overdue tickets
ticketSchema.statics.findOverdue = function(organisationId = null) {
    const query = {
        due_date: { $lt: new Date() },
        ticket_status: { $ne: 'resolved' }
    };
    if (organisationId) {
        query.organisation_id = organisationId;
    }
    return this.find(query);
};

// Static method to find SLA breached tickets
ticketSchema.statics.findSLABreached = function(organisationId = null) {
    const query = {
        $or: [
            { sla_breach: true },
            {
                sla_due_date: { $lt: new Date() },
                ticket_status: { $ne: 'resolved' }
            }
        ]
    };
    if (organisationId) {
        query.organisation_id = organisationId;
    }
    return this.find(query);
};

// Instance method to assign to asset
ticketSchema.methods.assignToAsset = function(assetId) {
    this.related_asset_id = assetId;
    return this.save();
};

// Instance method to resolve ticket
ticketSchema.methods.resolve = function(resolutionNotes, resolvedBy) {
    this.ticket_status = 'resolved';
    this.resolved_at = new Date();
    this.resolution_notes = resolutionNotes;
    this.status_changed_by = resolvedBy;
    this.updated_by = resolvedBy;
    return this.save();
};

export const Ticket = mongoose.model("Ticket", ticketSchema);