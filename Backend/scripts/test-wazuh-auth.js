import axios from 'axios';
import https from 'https';
import Organisation from '../models/organisation.model.js';
import mongoose from 'mongoose';
import { EncryptionUtils } from '../utils/security.util.js';

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 10000
});

async function testWazuhAuth() {
  try {
    await mongoose.connect('mongodb://localhost:27017/soc_dashboard');

    // Get Codec Networks org
    const codecOrg = await Organisation.findById('68ef40c42c29395fd30828dc')
      .select('+wazuh_manager_username +wazuh_manager_password');
    console.log('=== CODEC NETWORKS ===');
    console.log('Organisation:', codecOrg.organisation_name);
    console.log('Wazuh IP:', codecOrg.wazuh_manager_ip);
    console.log('Username:', codecOrg.wazuh_manager_username);
    console.log('Password (encrypted):', typeof codecOrg.wazuh_manager_password === 'object' ? 'Yes' : 'No (plaintext)');

    // Decrypt password if encrypted
    let password;
    if (typeof codecOrg.wazuh_manager_password === 'object' && codecOrg.wazuh_manager_password.encrypted) {
      password = EncryptionUtils.decrypt(codecOrg.wazuh_manager_password);
      console.log('🔓 Decrypted password');
    } else {
      password = codecOrg.wazuh_manager_password;
      console.log('⚠️  Using plaintext password');
    }

    const host = `https://${codecOrg.wazuh_manager_ip}:${codecOrg.wazuh_manager_port || 55000}`;
    const auth = Buffer.from(`${codecOrg.wazuh_manager_username}:${password}`).toString('base64');

    console.log('\nTrying to authenticate...');
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
    console.log('✓ Authentication successful!');
    console.log('Token received:', token ? 'Yes' : 'No');

    // Try to get agents
    console.log('\nFetching agents...');
    const agentsResponse = await axiosInstance.get(
      `${host}/agents`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: { limit: 10000 }
      }
    );

    const agents = agentsResponse.data?.data?.affected_items || [];
    console.log(`✓ Found ${agents.length} agents`);

    agents.forEach(agent => {
      console.log(`  - Agent ${agent.id}: ${agent.name} (${agent.ip}) - ${agent.status}`);
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testWazuhAuth();
