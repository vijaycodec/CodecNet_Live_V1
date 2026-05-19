import mongoose from 'mongoose';
import AssetRegister from '../models/assetRegisterManagement.model.js';

mongoose.connect('mongodb://localhost:27017/soc_dashboard')
  .then(async () => {
    const orgId = '68ef40c42c29395fd30828de'; // FinanceSecure

    const assets = await AssetRegister.find({
      organisation_id: orgId,
      is_deleted: false
    }).select('asset_tag asset_name wazuh_agent_id wazuh_agent_status ip_address operating_system other_attributes')
      .limit(3);

    console.log('=== ASSET VERIFICATION ===');
    console.log(`Total assets: ${await AssetRegister.countDocuments({ organisation_id: orgId, is_deleted: false })}\n`);

    assets.forEach(asset => {
      console.log(`Asset: ${asset.asset_name} (${asset.asset_tag})`);
      console.log(`  Wazuh ID: ${asset.wazuh_agent_id}`);
      console.log(`  Status: ${asset.wazuh_agent_status}`);
      console.log(`  IP: ${asset.ip_address}`);
      console.log(`  OS: ${asset.operating_system}`);
      if (asset.other_attributes) {
        console.log(`  CPU: ${asset.other_attributes.cpu_name || 'N/A'}`);
        console.log(`  CPU Cores: ${asset.other_attributes.cpu_cores || 'N/A'}`);
        console.log(`  RAM: ${asset.other_attributes.memory_total_kb ? (asset.other_attributes.memory_total_kb / 1024).toFixed(2) + ' MB' : 'N/A'}`);
        console.log(`  Hostname: ${asset.other_attributes.host_hostname || 'N/A'}`);
        console.log(`  OS Version: ${asset.other_attributes.host_os_version || 'N/A'}`);
      }
      console.log('');
    });

    await mongoose.disconnect();
    process.exit(0);
  });
