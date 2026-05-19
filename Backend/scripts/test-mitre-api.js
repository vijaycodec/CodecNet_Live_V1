import mongoose from 'mongoose';
import Organisation from '../models/organisation.model.js';
import { getWazuhToken, axiosInstance } from '../services/wazuhExtended.service.js';
import { decryptPassword } from '../repositories/organisationRepository/organisation.repository.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from Backend directory
const envPath = path.join(__dirname, '..', '.env');
console.log(`📝 Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env:', result.error);
} else {
  console.log(`✅ Loaded ${Object.keys(result.parsed || {}).length} environment variables`);
  // Verify ENCRYPTION_KEY is loaded
  if (process.env.ENCRYPTION_KEY) {
    console.log('✅ ENCRYPTION_KEY is set');
  } else {
    console.error('❌ ENCRYPTION_KEY not found in environment');
  }
}

async function testMitreEndpoints(wazuhHost, token) {
  const endpoints = [
    { name: 'Groups', path: '/mitre/groups', params: { offset: 0, limit: 10, sort: '+name' } },
    { name: 'Mitigations', path: '/mitre/mitigations', params: { offset: 0, limit: 10, sort: '+name' } },
    { name: 'Software', path: '/mitre/software', params: { offset: 0, limit: 10, sort: '+name' } },
    { name: 'Tactics', path: '/mitre/tactics', params: { offset: 0, limit: 10, sort: '+name' } },
    { name: 'Techniques', path: '/mitre/techniques', params: { offset: 0, limit: 10, sort: '+name' } },
  ];

  console.log('🧪 Testing MITRE API Endpoints...\n');

  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Testing ${endpoint.name} (${endpoint.path})...`);

      const response = await axiosInstance.get(
        `${wazuhHost}${endpoint.path}`,
        {
          params: endpoint.params,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      const data = response.data;
      const items = data.data?.affected_items || [];
      const total = data.data?.total_affected_items || 0;

      console.log(`✅ ${endpoint.name}: Found ${total} total items`);
      if (items.length > 0) {
        console.log(`   Sample data:`, JSON.stringify(items[0], null, 2).substring(0, 200) + '...');
      }
      console.log('');
    } catch (error) {
      console.error(`❌ ${endpoint.name} failed:`, error.response?.data || error.message);
      console.log('');
    }
  }
}

async function testAlertMitreMapping(wazuhHost, indexerHost, indexerUser, indexerPass) {
  console.log('🎯 Testing Alert MITRE Mapping from Indexer (Rule Level 8+)...\n');

  try {
    const auth = Buffer.from(`${indexerUser}:${indexerPass}`).toString('base64');

    // Fetch recent alerts from indexer (rule level 8 and above)
    const response = await axiosInstance.post(
      `${indexerHost}/wazuh-alerts-*/_search`,
      {
        size: 100,
        query: {
          bool: {
            must: [
              {
                range: {
                  '@timestamp': {
                    gte: 'now-7d',
                    lte: 'now'
                  }
                }
              },
              {
                range: {
                  'rule.level': {
                    gte: 8
                  }
                }
              }
            ]
          }
        },
        sort: [{ '@timestamp': { order: 'desc' } }]
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const hits = response.data.hits?.hits || [];
    console.log(`📊 Found ${hits.length} high-severity alerts (level 8+)`);

    // Find alerts with MITRE mapping
    const mitreAlerts = hits.filter(hit => hit._source?.rule?.mitre);
    console.log(`🎯 Alerts with MITRE mapping: ${mitreAlerts.length}`);

    if (mitreAlerts.length > 0) {
      console.log('\n📋 Sample MITRE-mapped alerts:');
      mitreAlerts.slice(0, 3).forEach((hit, index) => {
        const alert = hit._source;
        console.log(`\n  Alert ${index + 1}:`);
        console.log(`    Rule ID: ${alert.rule?.id}`);
        console.log(`    Description: ${alert.rule?.description}`);
        console.log(`    MITRE ID: ${JSON.stringify(alert.rule?.mitre?.id)}`);
        console.log(`    MITRE Tactic: ${JSON.stringify(alert.rule?.mitre?.tactic)}`);
        console.log(`    MITRE Technique: ${JSON.stringify(alert.rule?.mitre?.technique)}`);
      });
    } else {
      console.log('⚠️  No alerts with MITRE mapping found in recent alerts');
    }
  } catch (error) {
    console.error('❌ Alert MITRE mapping test failed:', error.response?.data || error.message);
  }
}

async function main() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/soc_dashboard');
    console.log('✅ MongoDB connected\n');

    console.log('📊 Getting organisation credentials...');

    // Try to find FinanceSecure, fallback to Global Finance Corp
    let organisation = await Organisation.findOne({ organisation_name: 'FinanceSecure' });

    if (!organisation) {
      console.log('⚠️  "FinanceSecure" not found, trying "Global Finance Corp"...');
      organisation = await Organisation.findOne({ organisation_name: 'Global Finance Corp' });
    }

    if (!organisation) {
      const orgs = await Organisation.find({}).select('organisation_name');
      const orgNames = orgs.map(o => o.organisation_name).join(', ');
      throw new Error(`Organisation not found. Available organisations: ${orgNames}`);
    }

    // Fetch organisation with credentials (they may be select: false in schema)
    const orgWithCreds = await Organisation.findById(organisation._id)
      .select('+wazuh_manager_username +wazuh_manager_password +wazuh_indexer_username +wazuh_indexer_password');

    console.log(`✅ Testing with organisation: ${orgWithCreds.organisation_name || orgWithCreds._id}\n`);

    // Decrypt passwords using repository function (handles both encrypted and plaintext)
    console.log('🔓 Decrypting credentials...');
    const wazuhPassword = decryptPassword(orgWithCreds.wazuh_manager_password);
    const indexerPassword = decryptPassword(orgWithCreds.wazuh_indexer_password);

    // Construct credentials from organisation fields
    const wazuhCreds = {
      host: `https://${orgWithCreds.wazuh_manager_ip}:${orgWithCreds.wazuh_manager_port || 55000}`,
      username: orgWithCreds.wazuh_manager_username || 'wazuh',
      password: wazuhPassword
    };

    const indexerCreds = {
      host: `https://${orgWithCreds.wazuh_indexer_ip}:${orgWithCreds.wazuh_indexer_port || 9200}`,
      username: orgWithCreds.wazuh_indexer_username || 'admin',
      password: indexerPassword
    };

    if (!orgWithCreds.wazuh_manager_ip) {
      throw new Error('No Wazuh manager IP configured for this organisation');
    }

    if (!wazuhCreds.password) {
      throw new Error('No Wazuh manager password configured for this organisation');
    }

    console.log(`Wazuh Host: ${wazuhCreds.host}`);
    console.log(`Wazuh Username: ${wazuhCreds.username}`);
    console.log(`Indexer Host: ${indexerCreds.host}\n`);

    // Test 1: Authentication
    console.log('🔐 Testing Wazuh Authentication...');
    const token = await getWazuhToken(wazuhCreds.host, wazuhCreds.username, wazuhCreds.password);
    console.log('✅ Authentication successful\n');

    // Test 2: MITRE Endpoints
    await testMitreEndpoints(wazuhCreds.host, token);

    // Test 3: Alert MITRE Mapping
    if (indexerCreds && indexerCreds.host) {
      await testAlertMitreMapping(
        wazuhCreds.host,
        indexerCreds.host,
        indexerCreds.username,
        indexerCreds.password
      );
    }

    console.log('\n✅ All MITRE tests completed!');
    console.log('\n💡 Summary:');
    console.log('   ✓ Wazuh authentication working');
    console.log('   ✓ MITRE endpoints tested');
    console.log('   ✓ Alert MITRE mapping checked');
    console.log('\n🚀 Ready to proceed with full MITRE ATT&CK implementation!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }

    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔐 Database connection closed');
  }
}

main();
