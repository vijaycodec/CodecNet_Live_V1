import AssetRegister from '../../models/assetRegisterManagement.model.js';
import mongoose from 'mongoose';

// Basic CRUD operations
export const createAsset = async (assetData) => {
  return await AssetRegister.create(assetData);
};

export const findAssetById = async (id, populateFields = []) => {
  let query = AssetRegister.findById(id);
  
  const defaultPopulate = ['organisation_id', 'business_owner', 'technical_owner'];
  const fieldsToPopulate = populateFields.length > 0 ? populateFields : defaultPopulate;
  
  fieldsToPopulate.forEach(field => {
    if (field === 'organisation_id') {
      query = query.populate(field, 'organisation_name client_name');
    } else if (field === 'business_owner' || field === 'technical_owner') {
      query = query.populate(field, 'username full_name email');
    } else {
      query = query.populate(field);
    }
  });
  
  return await query;
};

export const updateAssetById = async (id, updatedFields, userId = null) => {
  if (userId) {
    updatedFields.updated_by = userId;
  }
  return await AssetRegister.findByIdAndUpdate(id, updatedFields, { 
    new: true,
    runValidators: true 
  });
};

export const deleteAssetById = async (id) => {
  return await AssetRegister.findByIdAndDelete(id);
};

// Soft delete operations
export const softDeleteAsset = async (id, deletedBy, reason = null) => {
  return await AssetRegister.findByIdAndUpdate(id, {
    is_deleted: true,
    deleted_at: new Date(),
    deleted_by: deletedBy,
    deletion_reason: reason,
    status: 'retired'
  }, { new: true });
};

export const restoreAsset = async (id, restoredBy) => {
  return await AssetRegister.findByIdAndUpdate(id, {
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    deletion_reason: null,
    status: 'active',
    updated_by: restoredBy
  }, { new: true });
};

// Query operations
export const findAllAssets = async (organisationId = null, includeDeleted = false) => {
  const query = {};
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  if (!includeDeleted) {
    query.is_deleted = false;
  }
  
  return await AssetRegister.find(query)
    .populate('organisation_id', 'organisation_name client_name')
    .sort({ createdAt: -1 });
};

export const findActiveAssets = async (organisationId = null) => {
  return await AssetRegister.findActive(organisationId)
    .populate('organisation_id', 'organisation_name client_name');
};

export const findAssetsByType = async (assetType, organisationId = null) => {
  return await AssetRegister.findByType(assetType, organisationId)
    .populate('organisation_id', 'organisation_name client_name');
};

export const findAssetsByStatus = async (status, organisationId = null) => {
  const query = { status, is_deleted: false };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await AssetRegister.find(query)
    .populate('organisation_id', 'organisation_name client_name');
};

export const findAssetByTag = async (assetTag, organisationId) => {
  return await AssetRegister.findOne({
    asset_tag: assetTag,
    organisation_id: organisationId,
    is_deleted: false
  }).populate('organisation_id', 'organisation_name client_name');
};

// Wazuh integration
export const findAssetsByWazuhStatus = async (wazuhStatus, organisationId = null) => {
  return await AssetRegister.findByWazuhStatus(wazuhStatus, organisationId);
};

export const findOfflineAssets = async (organisationId = null, minutesThreshold = 5) => {
  return await AssetRegister.findOffline(organisationId, minutesThreshold);
};

export const updateWazuhStatus = async (assetId, status, keepalive = null) => {
  const asset = await AssetRegister.findById(assetId);
  if (!asset) return null;
  
  return await asset.updateWazuhStatus(status, keepalive);
};

export const updateWazuhAgent = async (assetId, agentId, agentName) => {
  return await AssetRegister.findByIdAndUpdate(assetId, {
    wazuh_agent_id: agentId,
    wazuh_agent_name: agentName,
    wazuh_agent_status: 'pending'
  }, { new: true });
};

export const findAssetByWazuhAgentId = async (agentId) => {
  return await AssetRegister.findOne({
    wazuh_agent_id: agentId,
    is_deleted: false
  }).populate('organisation_id', 'organisation_name client_name');
};

// Asset lifecycle management
export const retireAsset = async (assetId, userId, reason = null) => {
  const asset = await AssetRegister.findById(assetId);
  if (!asset) return null;
  
  return await asset.retire(userId, reason);
};

export const quarantineAsset = async (assetId, userId, reason = null) => {
  const asset = await AssetRegister.findById(assetId);
  if (!asset) return null;
  
  return await asset.quarantine(userId, reason);
};

export const assignAssetToUser = async (assetId, userId, assignmentType = 'technical_owner') => {
  const asset = await AssetRegister.findById(assetId);
  if (!asset) return null;
  
  return await asset.assignToUser(userId, assignmentType);
};

// Network and IP management
export const findAssetsByIpRange = async (ipStart, ipEnd, organisationId = null) => {
  const query = {
    ip_address: {
      $gte: ipStart,
      $lte: ipEnd
    },
    is_deleted: false
  };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await AssetRegister.find(query);
};

export const findAssetByIpAddress = async (ipAddress, organisationId = null) => {
  const query = { ip_address: ipAddress, is_deleted: false };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await AssetRegister.findOne(query)
    .populate('organisation_id', 'organisation_name client_name');
};

export const findAssetByMacAddress = async (macAddress, organisationId = null) => {
  const query = { mac_address: macAddress, is_deleted: false };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await AssetRegister.findOne(query)
    .populate('organisation_id', 'organisation_name client_name');
};

// Risk and security management
export const findAssetsByCriticality = async (criticality, organisationId = null) => {
  const query = { asset_criticality: criticality, is_deleted: false };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await AssetRegister.find(query)
    .populate('organisation_id', 'organisation_name client_name');
};

export const findHighRiskAssets = async (organisationId = null) => {
  const query = {
    asset_criticality: { $in: ['high', 'critical'] },
    is_deleted: false
  };

  if (organisationId) {
    query.organisation_id = organisationId;
  }

  return await AssetRegister.find(query)
    .populate('organisation_id', 'organisation_name client_name');
};

// Warranty and lifecycle tracking
export const findExpiringWarranties = async (daysThreshold = 30, organisationId = null) => {
  return await AssetRegister.findExpiringWarranties(daysThreshold, organisationId);
};

export const updateWarrantyInfo = async (assetId, warrantyStartDate, warrantyExpiryDate, userId = null) => {
  const updateData = {
    warranty_start_date: warrantyStartDate,
    warranty_expiry_date: warrantyExpiryDate
  };
  
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await AssetRegister.findByIdAndUpdate(assetId, updateData, { 
    new: true,
    runValidators: true 
  });
};

// Search operations
export const searchAssets = async (searchTerm, organisationId = null, limit = 20) => {
  const query = {
    $or: [
      { asset_name: { $regex: searchTerm, $options: 'i' } },
      { asset_tag: { $regex: searchTerm, $options: 'i' } },
      { ip_address: { $regex: searchTerm, $options: 'i' } },
      { mac_address: { $regex: searchTerm, $options: 'i' } },
      { wazuh_agent_name: { $regex: searchTerm, $options: 'i' } },
      { serial_number: { $regex: searchTerm, $options: 'i' } },
      { manufacturer: { $regex: searchTerm, $options: 'i' } },
      { model: { $regex: searchTerm, $options: 'i' } }
    ],
    is_deleted: false
  };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await AssetRegister.find(query)
    .populate('organisation_id', 'organisation_name client_name')
    .limit(limit)
    .sort({ asset_name: 1 });
};

// Statistics and reporting
export const getAssetStatistics = async (organisationId = null) => {
  const query = { is_deleted: false };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  const totalAssets = await AssetRegister.countDocuments(query);
  const activeAssets = await AssetRegister.countDocuments({ ...query, status: 'active' });
  const onlineAssets = await AssetRegister.countDocuments({
    ...query,
    wazuh_agent_status: 'active',
    last_keepalive: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
  });
  
  const assetsByType = await AssetRegister.aggregate([
    { $match: query },
    { $group: { _id: '$asset_type', count: { $sum: 1 } } }
  ]);
  
  const assetsByCriticality = await AssetRegister.aggregate([
    { $match: query },
    { $group: { _id: '$asset_criticality', count: { $sum: 1 } } }
  ]);

  return {
    totalAssets,
    activeAssets,
    inactiveAssets: totalAssets - activeAssets,
    onlineAssets,
    offlineAssets: totalAssets - onlineAssets,
    assetsByType,
    assetsByCriticality
  };
};

export const getAssetDistribution = async (organisationId = null) => {
  const query = { is_deleted: false };
  
  if (organisationId) {
    query.organisation_id = organisationId;
  }
  
  return await AssetRegister.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          type: '$asset_type',
          status: '$status',
          severity: '$asset_criticality'
        },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Bulk operations
export const bulkUpdateAssets = async (assetIds, updateData, userId = null) => {
  if (userId) {
    updateData.updated_by = userId;
  }
  
  return await AssetRegister.updateMany(
    { _id: { $in: assetIds } },
    updateData
  );
};

export const bulkImportAssets = async (assetsData) => {
  return await AssetRegister.insertMany(assetsData);
};

// Validation functions
export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const validateAssetExists = async (id) => {
  const asset = await AssetRegister.findById(id);
  return !!asset && !asset.is_deleted;
};

export const checkAssetTagExists = async (assetTag, organisationId, excludeAssetId = null) => {
  const query = {
    asset_tag: assetTag,
    organisation_id: organisationId,
    is_deleted: false
  };
  
  if (excludeAssetId) {
    query._id = { $ne: excludeAssetId };
  }
  
  const asset = await AssetRegister.findOne(query);
  return !!asset;
};

export const checkWazuhAgentIdExists = async (agentId, excludeAssetId = null) => {
  const query = {
    wazuh_agent_id: agentId,
    is_deleted: false
  };
  
  if (excludeAssetId) {
    query._id = { $ne: excludeAssetId };
  }
  
  const asset = await AssetRegister.findOne(query);
  return !!asset;
};

// Export aliases
export const getAssetById = findAssetById;
export const findAssetsByOrganisation = (organisationId) => findAllAssets(organisationId);
export const getAssetByTag = findAssetByTag;
export const getAssetByWazuhAgent = findAssetByWazuhAgentId;
// Backward compatibility alias
export const findAssetsBySeverity = findAssetsByCriticality;