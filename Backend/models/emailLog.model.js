import mongoose from "mongoose";

const emailLogSchema = new mongoose.Schema({
  organisation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organisation',
    default: null,
    index: true
  },

  // Email metadata
  email_type: {
    type: String,
    enum: ['critical_alert', 'manual_test', 'other'],
    default: 'critical_alert',
    index: true
  },
  from: {
    type: String,
    required: true,
    trim: true
  },
  to: [{
    type: String,
    trim: true
  }],
  cc: [{
    type: String,
    trim: true
  }],
  subject: {
    type: String,
    required: true,
    trim: true
  },

  // Alert reference fields (denormalized for fast log search)
  alert_id: {
    type: String,
    default: null,
    index: true
  },
  alert_title: {
    type: String,
    default: null
  },
  alert_severity: {
    type: Number,
    default: null
  },
  alert_source: {
    type: String,
    default: null
  },
  alert_time: {
    type: Date,
    default: null
  },
  alert_description: {
    type: String,
    default: null
  },

  // Delivery status
  status: {
    type: String,
    enum: ['queued', 'sent', 'failed'],
    default: 'queued',
    index: true
  },
  smtp_message_id: {
    type: String,
    default: null
  },
  smtp_response: {
    type: String,
    default: null
  },
  error_message: {
    type: String,
    default: null
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0
  },
  sent_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Prevent duplicate critical alert emails per alert_id
emailLogSchema.index(
  { alert_id: 1, email_type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      alert_id: { $type: 'string' },
      email_type: 'critical_alert'
    }
  }
);

emailLogSchema.index({ createdAt: -1 });

const EmailLog = mongoose.model('EmailLog', emailLogSchema);
export default EmailLog;
