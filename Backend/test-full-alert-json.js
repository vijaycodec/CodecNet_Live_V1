import mongoose from 'mongoose';
import Client from './models/client.model.js';
import { axiosInstance } from './services/wazuhExtended.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testFullAlertJSON() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ MongoDB connected\n');

    console.log('📊 Getting client credentials...');
    const client = await Client.findOne({});

    if (!client) {
      throw new Error('No client found in database');
    }

    const indexerCreds = client.indexerCredentials;

    if (!indexerCreds || !indexerCreds.host) {
      throw new Error('Incomplete Indexer credentials');
    }

    console.log(`Indexer Host: ${indexerCreds.host}`);
    console.log(`Indexer Username: ${indexerCreds.username}\n`);

    const auth = Buffer.from(`${indexerCreds.username}:${indexerCreds.password}`).toString('base64');

    // Test 1: Fetch with specific fields (current implementation)
    console.log('🔍 Testing current implementation (specific fields only)...');
    const specificFieldsQuery = {
      query: {
        range: {
          "rule.level": {
            gte: 8,
          },
        },
      },
      sort: [{ "@timestamp": { order: "desc" } }],
      _source: [
        "rule.level",
        "rule.description",
        "rule.id",
        "rule.groups",
        "@timestamp",
        "predecoder.hostname",
        "agent.name",
        "agent.id",
      ],
      size: 1,
    };

    const specificFieldsResponse = await axiosInstance.post(
      `${indexerCreds.host}/wazuh-alerts-*/_search`,
      specificFieldsQuery,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 10000
      }
    );

    const specificFieldsAlert = specificFieldsResponse.data.hits?.hits?.[0]?._source;
    console.log('Current implementation alert fields:');
    console.log(JSON.stringify(specificFieldsAlert, null, 2));
    console.log(`\nNumber of fields: ${Object.keys(specificFieldsAlert || {}).length}\n`);

    // Test 2: Fetch with full JSON (no _source filter)
    console.log('🔍 Testing full JSON implementation (all fields)...');
    const fullJsonQuery = {
      query: {
        range: {
          "rule.level": {
            gte: 8,
          },
        },
      },
      sort: [{ "@timestamp": { order: "desc" } }],
      size: 1,
    };

    const fullJsonResponse = await axiosInstance.post(
      `${indexerCreds.host}/wazuh-alerts-*/_search`,
      fullJsonQuery,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 10000
      }
    );

    const fullAlert = fullJsonResponse.data.hits?.hits?.[0];
    const fullAlertSource = fullAlert?._source;

    console.log('Full JSON alert (first level keys):');
    console.log(Object.keys(fullAlertSource || {}).join(', '));
    console.log(`\nTotal number of top-level fields: ${Object.keys(fullAlertSource || {}).length}`);

    console.log('\n📄 Full alert structure (first alert):');
    console.log(JSON.stringify(fullAlert, null, 2));

    console.log('\n🎉 Test completed! Full JSON data is available from Wazuh indexer.');

    // Generate curl command for manual testing
    console.log('\n📋 Curl command for manual testing:');
    console.log(`curl -X POST "${indexerCreds.host}/wazuh-alerts-*/_search" \\
  -H "Authorization: Basic ${auth}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": {
      "range": {
        "rule.level": {
          "gte": 8
        }
      }
    },
    "sort": [{"@timestamp": {"order": "desc"}}],
    "size": 1
  }'`);

  } catch (error) {
    console.error('\n❌ Test Failed:');
    console.error(`Error: ${error.message}`);

    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error(`Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }

  } finally {
    await mongoose.connection.close();
    console.log('\n🔐 Database connection closed');
  }
}

testFullAlertJSON();
