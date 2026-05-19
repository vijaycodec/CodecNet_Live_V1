import Organisation from '../../models/organisation.model.js';
import mongoose from 'mongoose';
import { EncryptionUtils } from '../../utils/security.util.js';

/**
 * SECURITY FIX (PATCH 42): Helper function to encrypt passwords before saving (CWE-256)
 * Encrypts Wazuh Manager, Indexer, and Dashboard passwords
 */
function encryptCredentials(orgData) {
  const encrypted = { ...orgData };

  // Encrypt Wazuh Manager password if provided and not already encrypted
  if (encrypted.wazuh_manager_password) {
    if (typeof encrypted.wazuh_manager_password === 'string') {
      encrypted.wazuh_manager_password = EncryptionUtils.encrypt(
        encrypted.wazuh_manager_password
      );
    }
  }

  // Encrypt Wazuh Indexer password if provided and not already encrypted
  if (encrypted.wazuh_indexer_password) {
    if (typeof encrypted.wazuh_indexer_password === 'string') {
      encrypted.wazuh_indexer_password = EncryptionUtils.encrypt(
        encrypted.wazuh_indexer_password
      );
    }
  }

  // Encrypt Wazuh Dashboard password if provided and not already encrypted
  if (encrypted.wazuh_dashboard_password) {
    if (typeof encrypted.wazuh_dashboard_password === 'string') {
      encrypted.wazuh_dashboard_password = EncryptionUtils.encrypt(
        encrypted.wazuh_dashboard_password
      );
    }
  }

  return encrypted;
}

/**
 * SECURITY FIX (PATCH 42): Helper function to decrypt password if encrypted (CWE-256)
 * Handles both plaintext (legacy) and encrypted passwords
 */
export function decryptPassword(password) {
  // If password is null or undefined, return null
  if (!password) return null;

  // If password is already plaintext string, return as-is (backward compatibility)
  if (typeof password === 'string') {
    console.warn('⚠️  WARNING: Plaintext password detected - should be encrypted');
    return password;
  }

  // If password is encrypted object, decrypt it
  if (typeof password === 'object' && password.encrypted && password.iv && password.authTag) {
    try {
      return EncryptionUtils.decrypt(password);
    } catch (error) {
      console.error('❌ Failed to decrypt password:', error.message);
      throw new Error('Failed to decrypt credentials');
    }
  }

  // Unknown format
  console.error('❌ Unknown password format:', typeof password);
  throw new Error('Invalid password format in database');
}

// Basic CRUD operations
export const createOrganisation = async (orgData) => {
  // SECURITY FIX (PATCH 42): Encrypt credentials before saving
  const encryptedData = encryptCredentials(orgData);
  return await Organisation.create(encryptedData);
};

export const findOrganisationById = async (id, populateFields = [], includeCredentials = false) => {
  console.log('🔍 Repository: findOrganisationById called', { id, includeCredentials });

  let query = Organisation.findById(id);

  // Include sensitive Wazuh credentials if requested
  if (includeCredentials) {
    console.log('📋 Including credentials with select override');
    query = query.select('+wazuh_manager_username +wazuh_manager_password +wazuh_indexer_username +wazuh_indexer_password +wazuh_dashboard_username +wazuh_dashboard_password');
  }

  // Handle population
  if (populateFields.length > 0) {
    populateFields.forEach(field => {
      query = query.populate(field);
    });
  }

  const result = await query.exec();

  // Decrypt passwords for frontend if credentials requested
  if (result && includeCredentials) {
    result._includeCredentials = true;

    // Convert to plain object to modify
    const orgObject = result.toObject();

    // Decrypt passwords if they exist (handles both encrypted objects and plain strings)
    if (orgObject.wazuh_manager_password) {
      orgObject.wazuh_manager_password = decryptPassword(orgObject.wazuh_manager_password);
    }
    if (orgObject.wazuh_indexer_password) {
      orgObject.wazuh_indexer_password = decryptPassword(orgObject.wazuh_indexer_password);
    }
    if (orgObject.wazuh_dashboard_password) {
      orgObject.wazuh_dashboard_password = decryptPassword(orgObject.wazuh_dashboard_password);
    }

    console.log('🔓 Decrypted passwords for frontend');
    return orgObject;
  }

  return result;
};

export const updateOrganisationById = async (id, updatedFields, userId = null) => {
  if (userId) {
    updatedFields.updated_by = userId;
  }

  // SECURITY FIX (PATCH 42): Encrypt credentials before updating
  const encryptedFields = encryptCredentials(updatedFields);

  return await Organisation.findByIdAndUpdate(id, encryptedFields, {
    new: true,
    runValidators: true
  });
};

export const deleteOrganisationById = async (id) => {
  return await Organisation.findByIdAndDelete(id);
};

// Soft delete operations
export const softDeleteOrganisation = async (id, deletedBy, reason = null) => {
  return await Organisation.findByIdAndUpdate(id, {
    is_deleted: true,
    deleted_at: new Date(),
    deleted_by: deletedBy,
    status: 'deleted'
  }, { new: true });
};

export const hardDeleteOrganisation = async (id) => {
  return await Organisation.findByIdAndDelete(id);
};

export const restoreOrganisation = async (id, restoredBy) => {
  return await Organisation.findByIdAndUpdate(id, {
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    status: 'active',
    updated_by: restoredBy
  }, { new: true });
};

// Query operations
export const findAllOrganisations = async (includeDeleted = false) => {
  const query = {};
  
  if (!includeDeleted) {
    query.is_deleted = false;
  }
  
  return await Organisation.find(query)
    .populate('subscription_plan_id', 'plan_name plan_code max_users max_assets')
    .sort({ createdAt: -1 });
};

export const findActiveOrganisations = async () => {
  return await Organisation.findActive()
    .populate('subscription_plan_id', 'plan_name plan_code max_users max_assets');
};

export const findOrganisationByClientName = async (clientName) => {
  return await Organisation.findOne({ 
    client_name: clientName,
    is_deleted: false 
  }).populate('subscription_plan_id');
};

export const findOrganisationsByStatus = async (status) => {
  return await Organisation.find({ 
    status: status,
    is_deleted: false 
  }).populate('subscription_plan_id', 'plan_name plan_code');
};

export const findOrganisationsBySubscriptionPlan = async (subscriptionPlanId) => {
  return await Organisation.find({ 
    subscription_plan_id: subscriptionPlanId,
    is_deleted: false 
  });
};

// Subscription management
export const findBySubscriptionStatus = async (subscriptionStatus) => {
  return await Organisation.findBySubscriptionStatus(subscriptionStatus)
    .populate('subscription_plan_id', 'plan_name plan_code max_users max_assets');
};

export const updateSubscriptionPlan = async (id, subscriptionPlanId, userId = null) => {
  const updateData = { 
    subscription_plan_id: subscriptionPlanId,
    subscription_start_date: new Date()
  };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Organisation.findByIdAndUpdate(id, updateData, { 
    new: true,
    runValidators: true 
  }).populate('subscription_plan_id');
};

export const updateSubscriptionStatus = async (id, status, userId = null) => {
  const updateData = { subscription_status: status };
  
  if (status === 'cancelled' || status === 'expired') {
    updateData.subscription_end_date = new Date();
  }
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Organisation.findByIdAndUpdate(id, updateData, { new: true });
};

export const extendSubscription = async (id, endDate, userId = null) => {
  const updateData = { 
    subscription_end_date: endDate,
    subscription_status: 'active'
  };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Organisation.findByIdAndUpdate(id, updateData, { new: true });
};

// Usage tracking
export const updateUserCount = async (id, userCount) => {
  return await Organisation.findByIdAndUpdate(id, {
    current_user_count: userCount
  }, { new: true });
};

export const updateAssetCount = async (id, assetCount) => {
  return await Organisation.findByIdAndUpdate(id, {
    current_asset_count: assetCount
  }, { new: true });
};

// NOTE: Removed incrementUserCount and incrementAssetCount functions
// We now use full recount approach for accuracy to prevent drift
// Use getUserCountByOrganisation() from user.repository.js and update via updateOrganisationById()

// Overage tracking
export const trackAssetOverage = async (id, overageCount) => {
  const updateData = {
    assets_over_limit: overageCount
  };
  
  if (overageCount > 0) {
    const org = await Organisation.findById(id);
    if (!org.overage_start_date) {
      updateData.overage_start_date = new Date();
    }
  } else {
    updateData.overage_start_date = null;
    updateData.overage_notifications_sent = 0;
    updateData.last_overage_notification = null;
  }
  
  return await Organisation.findByIdAndUpdate(id, updateData, { new: true });
};

export const recordOverageNotification = async (id) => {
  const org = await Organisation.findById(id);
  if (org) {
    org.overage_notifications_sent = (org.overage_notifications_sent || 0) + 1;
    org.last_overage_notification = new Date();
    return await org.save();
  }
  return null;
};

// Wazuh integration
export const updateWazuhCredentials = async (id, wazuhConfig, userId = null) => {
  const updateData = { 
    ...wazuhConfig
  };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Organisation.findByIdAndUpdate(id, updateData, { 
    new: true,
    runValidators: true 
  });
};

// SECURITY: Internal use only - returns infrastructure details for backend operations
// This function should NEVER be called from controllers that return data to users
// Only use for internal backend operations like connecting to Wazuh
export const getWazuhCredentialsInternal = async (id) => {
  const org = await Organisation.findById(id)
    .select('+wazuh_manager_username +wazuh_manager_password +wazuh_indexer_username +wazuh_indexer_password +wazuh_dashboard_username +wazuh_dashboard_password');
  if (!org) return null;

  // Returns full credentials including IPs, ports, usernames, passwords
  // SECURITY WARNING: Never expose this in API responses
  return {
    wazuh_manager_ip: org.wazuh_manager_ip,
    wazuh_manager_port: org.wazuh_manager_port,
    wazuh_manager_username: org.wazuh_manager_username,
    wazuh_manager_password: org.wazuh_manager_password,
    wazuh_indexer_ip: org.wazuh_indexer_ip,
    wazuh_indexer_port: org.wazuh_indexer_port,
    wazuh_indexer_username: org.wazuh_indexer_username,
    wazuh_indexer_password: org.wazuh_indexer_password,
    wazuh_dashboard_ip: org.wazuh_dashboard_ip,
    wazuh_dashboard_port: org.wazuh_dashboard_port,
    wazuh_dashboard_username: org.wazuh_dashboard_username,
    wazuh_dashboard_password: org.wazuh_dashboard_password
  };
};

// Contact information
export const updateContactInfo = async (id, contactInfo, userId = null) => {
  const updateData = { 
    emails: contactInfo.emails || [],
    phone_numbers: contactInfo.phone_numbers || []
  };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Organisation.findByIdAndUpdate(id, updateData, { 
    new: true,
    runValidators: true 
  });
};

// Settings management
export const updateOrganisationSettings = async (id, settings, userId = null) => {
  const updateData = { 
    timezone: settings.timezone || 'UTC',
    locale: settings.locale || 'en-IN',
    date_format: settings.date_format || 'YYYY-MM-DD'
  };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await Organisation.findByIdAndUpdate(id, updateData, { 
    new: true,
    runValidators: true 
  });
};

// Limit checking
export const checkUserLimit = async (id) => {
  const org = await Organisation.findById(id).populate('subscription_plan_id');
  if (!org) return { canAdd: false, error: 'Organisation not found' };
  
  const isOverLimit = await org.isOverUserLimit();
  return {
    canAdd: !isOverLimit,
    currentCount: org.current_user_count,
    maxAllowed: org.subscription_plan_id.max_users,
    isOverLimit
  };
};

export const checkAssetLimit = async (id) => {
  const org = await Organisation.findById(id).populate('subscription_plan_id');
  if (!org) return { canAdd: false, error: 'Organisation not found' };
  
  const isOverLimit = await org.isOverAssetLimit();
  return {
    canAdd: !isOverLimit,
    currentCount: org.current_asset_count,
    maxAllowed: org.subscription_plan_id.max_assets,
    isOverLimit
  };
};

// Statistics and reporting
export const getOrganisationStatistics = async () => {
  const totalOrgs = await Organisation.countDocuments({ is_deleted: false });
  const activeOrgs = await Organisation.countDocuments({ status: 'active', is_deleted: false });
  const activeSubscriptions = await Organisation.countDocuments({ 
    subscription_status: 'active', 
    is_deleted: false 
  });
  
  return {
    totalOrganisations: totalOrgs,
    activeOrganisations: activeOrgs,
    inactiveOrganisations: totalOrgs - activeOrgs,
    activeSubscriptions,
    expiredSubscriptions: totalOrgs - activeSubscriptions
  };
};

export const getSubscriptionDistribution = async () => {
  return await Organisation.aggregate([
    {
      $match: { is_deleted: false }
    },
    {
      $group: {
        _id: '$subscription_status',
        count: { $sum: 1 }
      }
    }
  ]);
};

export const getUsageStats = async (id) => {
  const org = await Organisation.findById(id).populate('subscription_plan_id');
  if (!org) return null;
  
  return {
    users: {
      current: org.current_user_count,
      max: org.subscription_plan_id.max_users,
      percentage: Math.round((org.current_user_count / org.subscription_plan_id.max_users) * 100)
    },
    assets: {
      current: org.current_asset_count,
      max: org.subscription_plan_id.max_assets,
      percentage: Math.round((org.current_asset_count / org.subscription_plan_id.max_assets) * 100),
      overLimit: org.assets_over_limit
    }
  };
};

// Search operations
export const searchOrganisations = async (searchTerm, limit = 20) => {
  const query = {
    $or: [
      { client_name: { $regex: searchTerm, $options: 'i' } },
      { organisation_name: { $regex: searchTerm, $options: 'i' } },
      { industry: { $regex: searchTerm, $options: 'i' } }
    ],
    is_deleted: false
  };
  
  return await Organisation.find(query)
    .populate('subscription_plan_id', 'plan_name plan_code')
    .limit(limit)
    .sort({ client_name: 1 });
};

// Validation operations
export const checkClientNameExists = async (clientName, excludeOrgId = null) => {
  const query = { 
    client_name: clientName,
    is_deleted: false 
  };
  
  if (excludeOrgId) {
    query._id = { $ne: excludeOrgId };
  }
  
  const org = await Organisation.findOne(query);
  return !!org;
};

// Utility functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validateOrganisationExists = async (id) => {
  const org = await Organisation.findById(id);
  return !!org && !org.is_deleted;
};

// Legacy compatibility functions (for gradual migration from Client model)
export const getClientCredentialsByUserId = async (userId) => {
  // Find organisation by user
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) {
    return {
      wazuhCredentials: null,
      indexerCredentials: null
    };
  }
  
  const org = await Organisation.findById(user.organisation_id);
  if (!org) {
    return {
      wazuhCredentials: null,
      indexerCredentials: null
    };
  }
  
  return {
    wazuhCredentials: {
      host: org.wazuh_manager_ip,
      port: org.wazuh_manager_port,
      // Note: username/password would need to be handled differently in the new structure
    },
    indexerCredentials: {
      host: org.wazuh_indexer_ip,
      port: org.wazuh_indexer_port,
      // Note: username/password would need to be handled differently in the new structure
    }
  };
};

// Export aliases for backward compatibility
export const getOrganisationById = findOrganisationById;
export const findClientByUserId = async (userId) => {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  return user ? await findOrganisationById(user.organisation_id) : null;
};