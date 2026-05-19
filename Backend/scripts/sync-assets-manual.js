import mongoose from 'mongoose';
import axios from 'axios';
import https from 'https';
import AssetRegister from '../models/assetRegisterManagement.model.js';
import Organisation from '../models/organisation.model.js';
import { EncryptionUtils } from '../utils/security.util.js';

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 10000
});

async function syncAssets() {
  try {
    await mongoose.connect('mongodb://localhost:27017/soc_dashboard');
    console.log('Connected to MongoDB\n');

    const orgId = '68ef40c42c29395fd30828de'; // FinanceSecure (Global Finance Corp)
    const organisation = await Organisation.findById(orgId)
      .select('+wazuh_manager_username +wazuh_manager_password');

    if (!organisation) {
      console.error('Organisation not found');
      process.exit(1);
    }

    console.log(`Organisation: ${organisation.organisation_name}`);
    console.log(`Wazuh Manager: ${organisation.wazuh_manager_ip}:${organisation.wazuh_manager_port || 55000}\n`);

    // Decrypt password if encrypted
    let password;
    if (typeof organisation.wazuh_manager_password === 'object' && organisation.wazuh_manager_password.encrypted) {
      password = EncryptionUtils.decrypt(organisation.wazuh_manager_password);
      console.log('🔓 Decrypted password');
    } else {
      password = organisation.wazuh_manager_password;
      console.log('⚠️  Using plaintext password');
    }

    const host = `https://${organisation.wazuh_manager_ip}:${organisation.wazuh_manager_port || 55000}`;
    const username = organisation.wazuh_manager_username;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    console.log('Authenticating with Wazuh...');
    const tokenResponse = await axiosInstance.post(
      `${host}/security/user/authenticate`,
      {},
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
    );

    const token = tokenResponse.data?.data?.token;
    if (!token) {
      console.error('Failed to get Wazuh token');
      process.exit(1);
    }
    console.log('✓ Authenticated\n');

    console.log('Fetching agents...');
    const response = await axiosInstance.get(
      `${host}/agents`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        params: { limit: 10000 }
      }
    );

    const agents = response.data?.data?.affected_items || [];
    console.log(`✓ Found ${agents.length} agents\n`);

    let created = 0;
    let updated = 0;
    let errors = [];

    for (const agent of agents) {
      try {
        console.log(`Processing agent ${agent.id} (${agent.name})...`);

        // Fetch hardware info
        let hardwareInfo = null;
        try {
          const hwResponse = await axiosInstance.get(
            `${host}/syscollector/${agent.id}/hardware`,
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
          );
          hardwareInfo = hwResponse.data?.data?.affected_items?.[0] || null;
        } catch (e) {
          console.log(`  - Could not fetch hardware info`);
        }

        // Fetch OS info
        let osInfo = null;
        try {
          const osResponse = await axiosInstance.get(
            `${host}/syscollector/${agent.id}/os`,
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
          );
          osInfo = osResponse.data?.data?.affected_items?.[0] || null;
        } catch (e) {
          console.log(`  - Could not fetch OS info`);
        }

        const existingAsset = await AssetRegister.findOne({
          wazuh_agent_id: agent.id,
          organisation_id: orgId
        });

        const otherAttributes = {
          agent_name: agent.name || null,
          agent_id: agent.id || null,
          agent_version: agent.version || null,
          agent_host_ip: agent.ip || null,
          wazuh_cluster_name: agent.manager || null,
          wazuh_cluster_node: agent.node_name || null,
          host_hostname: osInfo?.hostname || null,
          host_architecture: osInfo?.architecture || agent.os?.arch || null,
          agent_host_architecture: osInfo?.architecture || agent.os?.arch || null,
          host_os_platform: agent.os?.platform || null,
          host_os_name: agent.os?.name || osInfo?.os?.name || null,
          host_os_version: agent.os?.version || osInfo?.os?.version || null,
          host_os_build: agent.os?.build || osInfo?.os?.build || null,
          host_os_major: agent.os?.major || osInfo?.os?.major || null,
          host_os_minor: agent.os?.minor || osInfo?.os?.minor || null,
          host_os_type: agent.os?.platform || null,
          host_os_full: agent.os?.uname || (agent.os?.name && agent.os?.version ? `${agent.os.name} ${agent.os.version}` : null),
          host_os_display_version: osInfo?.os?.display_version || null,
          host_os_release: osInfo?.os_release || null,
          cpu_name: hardwareInfo?.cpu?.name || null,
          cpu_cores: hardwareInfo?.cpu?.cores || null,
          cpu_speed_mhz: hardwareInfo?.cpu?.mhz || null,
          memory_total_kb: hardwareInfo?.ram?.total || null,
          memory_free_kb: hardwareInfo?.ram?.free || null,
          memory_used_kb: hardwareInfo?.ram?.total && hardwareInfo?.ram?.free
            ? hardwareInfo.ram.total - hardwareInfo.ram.free : null,
          memory_usage_percent: hardwareInfo?.ram?.usage || null,
          board_serial: hardwareInfo?.board_serial !== 'None' ? hardwareInfo?.board_serial : null,
          last_hardware_scan: hardwareInfo?.scan?.time || null,
          last_os_scan: osInfo?.scan?.time || null
        };

        const assetData = {
          organisation_id: orgId,
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
          other_attributes: otherAttributes
        };

        if (existingAsset) {
          await AssetRegister.findByIdAndUpdate(
            existingAsset._id,
            assetData,
            { new: true, runValidators: true }
          );
          updated++;
          console.log(`  ✓ Updated`);
        } else {
          const newAsset = new AssetRegister(assetData);
          await newAsset.save();
          created++;
          console.log(`  ✓ Created`);
        }
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        errors.push({ agent_id: agent.id, error: error.message });
      }
    }

    console.log(`\n=== SYNC COMPLETE ===`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('\nError details:');
      errors.forEach(e => console.log(`  Agent ${e.agent_id}: ${e.error}`));
    }

    // Verify final count
    const finalCount = await AssetRegister.countDocuments({
      organisation_id: orgId,
      is_deleted: false
    });
    console.log(`\nTotal assets in DB for Global Finance Corp: ${finalCount}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

syncAssets();
