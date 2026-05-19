import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AssetRegister from '../models/assetRegisterManagement.model.js';

dotenv.config();

const syncManualAssetStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    console.log('📋 Syncing status for manually created assets...\n');

    // Find manually created assets (without Wazuh agents)
    const manualAssets = await AssetRegister.find({
      $or: [
        { wazuh_agent_id: { $exists: false } },
        { wazuh_agent_id: null },
        { wazuh_agent_id: '' }
      ],
      is_deleted: false
    });

    console.log(`Found ${manualAssets.length} manually created asset(s)\n`);

    // Map asset status to valid Wazuh agent status
    const statusMap = {
      'active': 'active',
      'inactive': 'disabled',
      'maintenance': 'disabled',
      'quarantined': 'disabled',
      'retired': 'removed'
    };

    let updated = 0;
    for (const asset of manualAssets) {
      // Set wazuh_agent_status to mapped value
      const originalWazuhStatus = asset.wazuh_agent_status;
      asset.wazuh_agent_status = statusMap[asset.status] || 'active';
      await asset.save();

      console.log(`✅ ${asset.asset_name} (${asset.asset_tag})`);
      console.log(`   Status: ${asset.status}`);
      console.log(`   Wazuh Status: ${originalWazuhStatus} → ${asset.wazuh_agent_status}\n`);
      updated++;
    }

    console.log(`✅ Successfully synced ${updated} asset(s)`);
    console.log('   Wazuh agent status now matches asset operational status');
    console.log('   Your firewall should now show as "active"!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

syncManualAssetStatus();
