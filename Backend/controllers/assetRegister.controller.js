import AssetRegister from '../models/assetRegisterManagement.model.js';
import { axiosInstance } from '../services/wazuhExtended.service.js';
import Organisation from '../models/organisation.model.js';
import { EncryptionUtils } from '../utils/security.util.js';

// Get all assets for an organization
export const getAssets = async (req, res) => {
  try {
    const { organisation_id } = req.query;

    const query = { is_deleted: false };
    if (organisation_id) {
      query.organisation_id = organisation_id;
    }

    const assets = await AssetRegister.find(query)
      .populate('created_by', 'username email')
      .populate('updated_by', 'username email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: assets,
      count: assets.length
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assets',
      error: error.message
    });
  }
};

// Get single asset by ID
export const getAssetById = async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await AssetRegister.findOne({
      _id: id,
      is_deleted: false
    })
      .populate('created_by', 'username email')
      .populate('updated_by', 'username email');

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    res.status(200).json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching asset',
      error: error.message
    });
  }
};

// Create new asset manually
export const createAsset = async (req, res) => {
  try {
    const assetData = {
      ...req.body,
      created_by: req.user?._id,
      updated_by: req.user?._id
    };

    const asset = new AssetRegister(assetData);
    await asset.save();

    res.status(201).json({
      success: true,
      message: 'Asset created successfully',
      data: asset
    });
  } catch (error) {
    console.error('Error creating asset:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Asset with this tag or Wazuh agent ID already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating asset',
      error: error.message
    });
  }
};

// Update asset
export const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updated_by: req.user?._id
    };

    // Remove fields that shouldn't be updated directly
    delete updateData.organisation_id;
    delete updateData.created_by;
    delete updateData.createdAt;

    const asset = await AssetRegister.findOneAndUpdate(
      { _id: id, is_deleted: false },
      updateData,
      { new: true, runValidators: true }
    );

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Asset updated successfully',
      data: asset
    });
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating asset',
      error: error.message
    });
  }
};

// Permanently delete asset
export const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await AssetRegister.findByIdAndDelete(id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Asset permanently deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting asset',
      error: error.message
    });
  }
};

// Sync agents from Wazuh to assets
export const syncAgentsToAssets = async (req, res) => {
  try {
    const { organisation_id } = req.body;

    console.log('🔄 [SYNC] Starting agent sync for organisation:', organisation_id);

    if (!organisation_id) {
      return res.status(400).json({
        success: false,
        message: 'Organisation ID is required'
      });
    }

    // Get organisation credentials
    // SECURITY: Explicitly select excluded password fields (they have select: false in schema)
    const organisation = await Organisation.findById(organisation_id)
      .select('+wazuh_manager_username +wazuh_manager_password +wazuh_indexer_username +wazuh_indexer_password');

    console.log('🔍 [SYNC] Organisation found:', organisation ? organisation.organisation_name : 'NOT FOUND');
    console.log('🔍 [SYNC] Wazuh credentials check:', {
      hasIP: !!organisation?.wazuh_manager_ip,
      hasUsername: !!organisation?.wazuh_manager_username,
      hasPassword: !!organisation?.wazuh_manager_password
    });

    if (!organisation) {
      return res.status(404).json({
        success: false,
        message: 'Organisation not found'
      });
    }

    // Check if Wazuh credentials exist
    if (!organisation.wazuh_manager_ip || !organisation.wazuh_manager_username || !organisation.wazuh_manager_password) {
      return res.status(404).json({
        success: false,
        message: 'Wazuh credentials not configured for this organisation'
      });
    }

    const host = `https://${organisation.wazuh_manager_ip}:${organisation.wazuh_manager_port || 55000}`;
    const username = organisation.wazuh_manager_username;

    // Decrypt password if it's encrypted (object with encrypted, iv, authTag)
    let password;
    if (typeof organisation.wazuh_manager_password === 'object' && organisation.wazuh_manager_password.encrypted) {
      try {
        password = EncryptionUtils.decrypt(organisation.wazuh_manager_password);
        console.log('🔓 [SYNC] Decrypted Wazuh manager password');
      } catch (decryptError) {
        console.error('❌ [SYNC] Failed to decrypt Wazuh manager password:', decryptError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to decrypt Wazuh credentials'
        });
      }
    } else {
      // Plain text password (legacy format)
      password = organisation.wazuh_manager_password;
      console.log('⚠️  [SYNC] Using plain text password (legacy format)');
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    // Get Wazuh token for API calls
    const tokenResponse = await axiosInstance.post(
      `${host}/security/user/authenticate`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const token = tokenResponse.data?.data?.token;
    if (!token) {
      return res.status(500).json({
        success: false,
        message: 'Failed to authenticate with Wazuh'
      });
    }

    // Fetch agents from Wazuh with full details
    const response = await axiosInstance.get(
      `${host}/agents`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit: 10000
        }
      }
    );

    const agents = response.data?.data?.affected_items || [];

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const agent of agents) {
      try {
        // Fetch hardware info using syscollector
        let hardwareInfo = null;
        try {
          const hwResponse = await axiosInstance.get(
            `${host}/syscollector/${agent.id}/hardware`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          hardwareInfo = hwResponse.data?.data?.affected_items?.[0] || null;
        } catch (hwError) {
          // Silently skip if hardware info not available
          console.log(`Could not fetch hardware info for agent ${agent.id}`);
        }

        // Fetch OS info using syscollector
        let osInfo = null;
        try {
          const osResponse = await axiosInstance.get(
            `${host}/syscollector/${agent.id}/os`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          osInfo = osResponse.data?.data?.affected_items?.[0] || null;
        } catch (osError) {
          // Silently skip if OS info not available
          console.log(`Could not fetch OS info for agent ${agent.id}`);
        }

        // Check if asset already exists
        const existingAsset = await AssetRegister.findOne({
          wazuh_agent_id: agent.id,
          organisation_id: organisation_id
        });

        // Build other_attributes with all hardware and system info
        const otherAttributes = {
          // Agent information
          agent_name: agent.name || null,
          agent_id: agent.id || null,
          agent_version: agent.version || null,
          agent_host_ip: agent.ip || null,

          // Wazuh cluster information
          wazuh_cluster_name: agent.manager || null,
          wazuh_cluster_node: agent.node_name || null,

          // Host information
          host_hostname: osInfo?.hostname || null,
          host_architecture: osInfo?.architecture || agent.os?.arch || null,
          agent_host_architecture: osInfo?.architecture || agent.os?.arch || null,

          // OS Platform information (from agent endpoint)
          host_os_platform: agent.os?.platform || null,
          host_os_name: agent.os?.name || osInfo?.os?.name || null,
          host_os_version: agent.os?.version || osInfo?.os?.version || null,
          host_os_build: agent.os?.build || osInfo?.os?.build || null,
          host_os_major: agent.os?.major || osInfo?.os?.major || null,
          host_os_minor: agent.os?.minor || osInfo?.os?.minor || null,
          host_os_type: agent.os?.platform || null,
          host_os_full: agent.os?.uname ||
            (agent.os?.name && agent.os?.version ? `${agent.os.name} ${agent.os.version}` : null),

          // Additional OS details (from syscollector endpoint)
          host_os_display_version: osInfo?.os?.display_version || null,
          host_os_release: osInfo?.os_release || null,

          // CPU information
          cpu_name: hardwareInfo?.cpu?.name || null,
          cpu_cores: hardwareInfo?.cpu?.cores || null,
          cpu_speed_mhz: hardwareInfo?.cpu?.mhz || null,

          // Memory information
          memory_total_kb: hardwareInfo?.ram?.total || null,
          memory_free_kb: hardwareInfo?.ram?.free || null,
          memory_used_kb: hardwareInfo?.ram?.total && hardwareInfo?.ram?.free
            ? hardwareInfo.ram.total - hardwareInfo.ram.free
            : null,
          memory_usage_percent: hardwareInfo?.ram?.usage || null,

          // Hardware information
          board_serial: hardwareInfo?.board_serial !== 'None' ? hardwareInfo?.board_serial : null,

          // Timestamps
          last_hardware_scan: hardwareInfo?.scan?.time || null,
          last_os_scan: osInfo?.scan?.time || null
        };

        const assetData = {
          organisation_id: organisation_id,
          asset_tag: `WZH-${agent.id}`,
          asset_name: agent.name || `Agent ${agent.id}`,
          wazuh_agent_id: agent.id,
          wazuh_agent_name: agent.name,
          wazuh_agent_status: agent.status === 'active' ? 'active' :
                             agent.status === 'disconnected' ? 'disconnected' :
                             agent.status === 'never_connected' ? 'never_connected' : 'pending',
          ip_address: agent.ip || null,
          operating_system: agent.os?.name || null,
          os_version: agent.os?.version || null,
          os_architecture: osInfo?.architecture || agent.os?.arch || null,
          kernel_version: agent.os?.uname || null,
          last_keepalive: agent.lastKeepAlive ? new Date(agent.lastKeepAlive) : null,
          updated_by: req.user?._id,
          other_attributes: otherAttributes
        };

        if (existingAsset) {
          // Check if any data has changed
          const hasChanges =
            existingAsset.wazuh_agent_status !== assetData.wazuh_agent_status ||
            existingAsset.ip_address !== assetData.ip_address ||
            existingAsset.operating_system !== assetData.operating_system ||
            existingAsset.wazuh_agent_name !== assetData.wazuh_agent_name;

          if (hasChanges) {
            await AssetRegister.findByIdAndUpdate(
              existingAsset._id,
              assetData,
              { new: true, runValidators: true }
            );
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new asset
          assetData.created_by = req.user?._id;
          const newAsset = new AssetRegister(assetData);
          await newAsset.save();
          created++;
        }
      } catch (error) {
        console.error(`Error syncing agent ${agent.id}:`, error.message);
        errors.push({
          agent_id: agent.id,
          agent_name: agent.name,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Agent synchronization completed',
      data: {
        total_agents: agents.length,
        created,
        updated,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error syncing agents to assets:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing agents to assets',
      error: error.message
    });
  }
};

// Get asset statistics
export const getAssetStatistics = async (req, res) => {
  try {
    const { organisation_id } = req.query;

    const query = { is_deleted: false };
    if (organisation_id) {
      query.organisation_id = organisation_id;
    }

    const [
      totalAssets,
      activeAssets,
      criticalAssets,
      byType,
      bySeverity,
      byEnvironment,
      byStatus
    ] = await Promise.all([
      AssetRegister.countDocuments(query),
      AssetRegister.countDocuments({ ...query, status: 'active' }),
      AssetRegister.countDocuments({ ...query, asset_criticality: 'critical' }),
      AssetRegister.aggregate([
        { $match: query },
        { $group: { _id: '$asset_type', count: { $sum: 1 } } }
      ]),
      AssetRegister.aggregate([
        { $match: query },
        { $group: { _id: '$asset_criticality', count: { $sum: 1 } } }
      ]),
      AssetRegister.aggregate([
        { $match: query },
        { $group: { _id: '$environment', count: { $sum: 1 } } }
      ]),
      AssetRegister.aggregate([
        { $match: query },
        { $group: { _id: '$wazuh_agent_status', count: { $sum: 1 } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalAssets,
        active: activeAssets,
        critical: criticalAssets,
        by_type: byType,
        by_severity: bySeverity,
        by_environment: byEnvironment,
        by_status: byStatus
      }
    });
  } catch (error) {
    console.error('Error fetching asset statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching asset statistics',
      error: error.message
    });
  }
};
