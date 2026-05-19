import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AssetRegister from '../models/assetRegisterManagement.model.js';

dotenv.config();

const fixManualAssets = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    console.log('📋 Updating manually created assets (without Wazuh agents)...\n');

    // Update assets without wazuh_agent_id that have wazuh_agent_status as 'pending'
    const result = await AssetRegister.updateMany(
      {
        $or: [
          { wazuh_agent_id: { $exists: false } },
          { wazuh_agent_id: null },
          { wazuh_agent_id: '' }
        ],
        wazuh_agent_status: 'pending',
        is_deleted: false
      },
      {
        $set: { wazuh_agent_status: 'never_connected' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} asset(s)`);
    console.log('   Changed wazuh_agent_status: "pending" → "never_connected"');
    console.log('   This affects manually created assets without Wazuh monitoring');

    if (result.modifiedCount > 0) {
      console.log('\n📝 Note: Your firewall asset should now show the correct status!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixManualAssets();
