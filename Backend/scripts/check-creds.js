import mongoose from 'mongoose';
import Organisation from '../models/organisation.model.js';

async function check() {
  await mongoose.connect('mongodb://localhost:27017/soc_dashboard');

  const org = await Organisation.findOne({ organisation_name: 'Global Finance Corp' })
    .select('+wazuh_manager_username +wazuh_manager_password +wazuh_indexer_username +wazuh_indexer_password');

  if (org) {
    console.log('Organisation:', org.organisation_name);
    console.log('\nWazuh Manager:');
    console.log('  Host:', `${org.wazuh_manager_ip}:${org.wazuh_manager_port || 55000}`);
    console.log('  Username:', org.wazuh_manager_username || '(not set)');
    console.log('  Password:', org.wazuh_manager_password || '(not set)');

    console.log('\nWazuh Indexer:');
    console.log('  Host:', `${org.wazuh_indexer_ip}:${org.wazuh_indexer_port || 9200}`);
    console.log('  Username:', org.wazuh_indexer_username || '(not set)');
    console.log('  Password:', org.wazuh_indexer_password ? '(set)' : '(not set)');
  } else {
    console.log('Organisation not found');
  }

  await mongoose.connection.close();
}

check();
