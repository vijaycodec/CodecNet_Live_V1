import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AssetRegister from '../models/assetRegisterManagement.model.js';

dotenv.config();

const setFirewallActive = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ Connected to MongoDB\n');

    // Find the firewall asset
    const firewall = await AssetRegister.findOne({
      asset_tag: 'Firewall',
      is_deleted: false
    });

    if (!firewall) {
      console.log('❌ Firewall not found');
      process.exit(1);
    }

    console.log(`📋 Found: ${firewall.asset_name} (${firewall.asset_tag})`);
    console.log(`   Current status: ${firewall.status}`);
    console.log(`   Current Wazuh status: ${firewall.wazuh_agent_status}\n`);

    // Update to active
    firewall.status = 'active';
    firewall.wazuh_agent_status = 'active'; // Maps to active for manual assets
    await firewall.save();

    console.log('✅ Updated firewall status:');
    console.log(`   Status: ${firewall.status}`);
    console.log(`   Wazuh Status: ${firewall.wazuh_agent_status}\n`);
    console.log('🎉 Your firewall now shows as ACTIVE!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

setFirewallActive();
