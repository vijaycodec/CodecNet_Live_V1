import mongoose from 'mongoose';
import Client from './models/client.model.js';
import { getWazuhToken, axiosInstance } from './services/wazuhExtended.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testWazuhAPI() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/siem');
    console.log('✅ MongoDB connected\n');
    
    console.log('📊 Getting client credentials...');
    const client = await Client.findOne({});
    
    if (!client) {
      throw new Error('No client found in database');
    }
    
    console.log(`Testing with client ID: ${client._id}`);
    
    const wazuhCreds = client.wazuhCredentials;
    const indexerCreds = client.indexerCredentials;
    
    if (!wazuhCreds || !wazuhCreds.host || !wazuhCreds.username || !wazuhCreds.password) {
      throw new Error('Incomplete Wazuh credentials');
    }
    
    console.log(`Wazuh Host: ${wazuhCreds.host}`);
    console.log(`Wazuh Username: ${wazuhCreds.username}\n`);
    
    // Test 1: Authentication
    console.log('🔐 Testing Wazuh Authentication...');
    const token = await getWazuhToken(wazuhCreds.host, wazuhCreds.username, wazuhCreds.password);
    console.log('✅ Authentication successful');
    
    // Test 2: Manager info
    console.log('\n📊 Testing Manager Info...');
    const managerResponse = await axiosInstance.get(
      `${wazuhCreds.host}/manager/info`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        timeout: 10000
      }
    );
    
    const managerInfo = managerResponse.data.data?.affected_items?.[0];
    console.log(`✅ Manager Version: ${managerInfo?.version || 'Unknown'}`);
    console.log(`✅ Manager Node: ${managerInfo?.node_name || 'Unknown'}`);
    
    // Test 3: Agents
    console.log('\n🤖 Testing Agents List...');
    const agentsResponse = await axiosInstance.get(
      `${wazuhCreds.host}/agents`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        timeout: 10000
      }
    );
    
    const agents = agentsResponse.data.data?.affected_items || [];
    console.log(`✅ Found ${agents.length} agents`);
    
    // Test 4: Active agents
    const activeAgents = agents.filter(agent => agent.status === 'active');
    console.log(`✅ Active agents: ${activeAgents.length}`);
    
    // Test 5: Indexer (if credentials exist)
    if (indexerCreds && indexerCreds.host) {
      console.log('\n📈 Testing Indexer (Elasticsearch)...');
      const auth = Buffer.from(`${indexerCreds.username}:${indexerCreds.password}`).toString('base64');
      
      const clusterResponse = await axiosInstance.get(
        `${indexerCreds.host}/`,
        { 
          headers: { 
            Authorization: `Basic ${auth}`,
            Accept: 'application/json'
          },
          timeout: 10000
        }
      );
      
      console.log(`✅ Indexer Cluster: ${clusterResponse.data.cluster_name || 'Unknown'}`);
      
      // Test alerts index
      const alertsResponse = await axiosInstance.get(
        `${indexerCreds.host}/wazuh-alerts-*/_search?size=1`,
        { 
          headers: { 
            Authorization: `Basic ${auth}`,
            Accept: 'application/json'
          },
          timeout: 10000
        }
      );
      
      const totalAlerts = alertsResponse.data.hits?.total?.value || 0;
      console.log(`✅ Total alerts in index: ${totalAlerts}`);
    }
    
    console.log('\n🎉 All API tests passed! The Wazuh and Indexer APIs are working correctly.');
    
  } catch (error) {
    console.error('\n❌ API Test Failed:');
    console.error(`Error: ${error.message}`);
    
    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error(`Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔧 Connection refused - check if Wazuh/Indexer services are running');
    } else if (error.code === 'ENOTFOUND') {
      console.error('🔧 Host not found - check the host URL in credentials');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('🔧 Connection timed out - check network connectivity');
    }
    
  } finally {
    await mongoose.connection.close();
    console.log('\n🔐 Database connection closed');
  }
}

testWazuhAPI();