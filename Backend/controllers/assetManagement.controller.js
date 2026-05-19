import {
  createAssetService,
  getAllAssetsService,
  getActiveAssetsService,
  getAssetByIdService,
  updateAssetService,
  updateAssetStatusService,
  updateMonitoringStatusService,
  updateWazuhConfigurationService,
  searchAssetsService,
  getAssetsByOrganisationService,
  getAssetsByStatusService,
  getAssetStatisticsService,
  bulkUpdateAssetsService,
  deleteAssetService,
  restoreAssetService
} from "../services/assetManagement/assetManagement.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createAsset = async (req, res) => {
  try {
    const assetData = req.body;
    const createdBy = req.user?.id;
    const organisationId = req.user?.organisation_id;

    const newAsset = await createAssetService(assetData, createdBy, organisationId);

    res.status(201).json(new ApiResponse(201, newAsset, "Asset created successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Create asset error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAllAssets = async (req, res) => {
  try {
    const {
      organisation_id,
      status,
      asset_type,
      monitoring_status,
      criticality_level,
      environment,
      limit,
      offset,
      sort_by,
      sort_order,
      include_deleted
    } = req.query;

    const filters = {
      organisation_id: organisation_id || req.user?.organisation_id,
      status,
      asset_type,
      monitoring_status,
      criticality_level,
      environment
    };

    const options = {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      sort_by: sort_by || 'createdAt',
      sort_order: sort_order || 'desc',
      include_deleted: include_deleted === 'true'
    };

    const assets = await getAllAssetsService(filters, options);

    res.status(200).json(new ApiResponse(200, assets, "Assets retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get all assets error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getActiveAssets = async (req, res) => {
  try {
    const { organisation_id, asset_type, criticality_level } = req.query;
    const organisationId = organisation_id || req.user?.organisation_id;

    const assets = await getActiveAssetsService(organisationId, asset_type, criticality_level);

    res.status(200).json(new ApiResponse(200, assets, "Active assets retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get active assets error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAssetById = async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await getAssetByIdService(id);

    res.status(200).json(new ApiResponse(200, asset, "Asset retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get asset by ID error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user?.id;

    const updatedAsset = await updateAssetService(id, updateData, updatedBy);

    res.status(200).json(new ApiResponse(200, updatedAsset, "Asset updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update asset error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateAssetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const updatedBy = req.user?.id;

    const result = await updateAssetStatusService(id, status, reason, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Asset status updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update asset status error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateMonitoringStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { monitoring_status, reason } = req.body;
    const updatedBy = req.user?.id;

    const result = await updateMonitoringStatusService(id, monitoring_status, reason, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Asset monitoring status updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update monitoring status error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const updateWazuhConfiguration = async (req, res) => {
  try {
    const { id } = req.params;
    const { wazuh_configuration } = req.body;
    const updatedBy = req.user?.id;

    const result = await updateWazuhConfigurationService(id, wazuh_configuration, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Asset Wazuh configuration updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Update Wazuh configuration error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const searchAssets = async (req, res) => {
  try {
    const { q, organisation_id, limit, offset } = req.query;
    const searchTerm = q;
    const organisationId = organisation_id || req.user?.organisation_id;
    const searchLimit = parseInt(limit) || 20;
    const searchOffset = parseInt(offset) || 0;

    const assets = await searchAssetsService(searchTerm, organisationId, searchLimit, searchOffset);

    res.status(200).json(new ApiResponse(200, assets, "Asset search completed"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Search assets error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAssetsByOrganisation = async (req, res) => {
  try {
    const { organisation_id } = req.params;
    const { status, asset_type, limit, offset } = req.query;

    const assets = await getAssetsByOrganisationService(
      organisation_id,
      status,
      asset_type,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );

    res.status(200).json(new ApiResponse(200, assets, "Organisation assets retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get assets by organisation error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAssetsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { organisation_id, limit, offset } = req.query;
    const orgId = organisation_id || req.user?.organisation_id;

    const assets = await getAssetsByStatusService(status, orgId, parseInt(limit) || 50, parseInt(offset) || 0);

    res.status(200).json(new ApiResponse(200, assets, `Assets with status '${status}' retrieved successfully`));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get assets by status error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const getAssetStatistics = async (req, res) => {
  try {
    const { organisation_id, asset_type, environment, start_date, end_date } = req.query;
    const orgId = organisation_id || req.user?.organisation_id;

    const statistics = await getAssetStatisticsService(orgId, asset_type, environment, start_date, end_date);

    res.status(200).json(new ApiResponse(200, statistics, "Asset statistics retrieved successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Get asset statistics error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const bulkUpdateAssets = async (req, res) => {
  try {
    const { asset_ids, updates } = req.body;
    const updatedBy = req.user?.id;

    const result = await bulkUpdateAssetsService(asset_ids, updates, updatedBy);

    res.status(200).json(new ApiResponse(200, result, "Assets updated successfully"));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Bulk update assets error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const deletedBy = req.user?.id;

    const result = await deleteAssetService(id, deletedBy, reason);

    res.status(200).json(new ApiResponse(200, null, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Delete asset error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};

export const restoreAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const restoredBy = req.user?.id;

    const result = await restoreAssetService(id, restoredBy);

    res.status(200).json(new ApiResponse(200, result, result.message));

  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(new ApiResponse(error.statusCode, null, error.message));
    }
    console.error('Restore asset error:', error);
    res.status(500).json(new ApiResponse(500, null, "Internal server error"));
  }
};