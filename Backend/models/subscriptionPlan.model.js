import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema({
  plan_name: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    trim: true
  },
  plan_description: {
    type: String,
    trim: true
  },
  plan_code: {
    type: String,
    required: true,
    unique: true,
    maxlength: 20,
    uppercase: true,
    trim: true
  },

  // Resource Limits
  max_users: {
    type: Number,
    required: true,
    min: 1
  },
  max_assets: {
    type: Number,
    required: true,
    min: 1
  },

  // Features (flexible JSON structure)
  features: {
    type: Object,
    default: {}
  },

  // Plan Management
  is_active: {
    type: Boolean,
    default: true
  },
  is_default: {
    type: Boolean,
    default: false
  },
  display_order: {
    type: Number,
    default: 1
  },
  trial_days: {
    type: Number,
    default: 0,
    min: 0
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
subscriptionPlanSchema.index({ is_active: 1 });
subscriptionPlanSchema.index({ is_default: 1 });
subscriptionPlanSchema.index({ display_order: 1 });

// Virtual for formatted plan name
subscriptionPlanSchema.virtual('formatted_name').get(function() {
  return `${this.plan_name} (${this.plan_code})`;
});

// Pre-save middleware to ensure only one default plan
subscriptionPlanSchema.pre('save', async function(next) {
  if (this.is_default && this.isModified('is_default')) {
    // Remove default flag from other plans
    await mongoose.model('SubscriptionPlan').updateMany(
      { _id: { $ne: this._id }, is_default: true },
      { $set: { is_default: false } }
    );
  }
  next();
});

// Static method to get default plan
subscriptionPlanSchema.statics.getDefaultPlan = function() {
  return this.findOne({ is_default: true, is_active: true });
};

// Static method to get active plans
subscriptionPlanSchema.statics.getActivePlans = function() {
  return this.find({ is_active: true }).sort({ display_order: 1 });
};

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export default SubscriptionPlan;