import mongoose from 'mongoose';
import Organisation from '../models/organisation.model.js';

async function check() {
  await mongoose.connect('mongodb://localhost:27017/soc_dashboard');

  const org = await Organisation.findOne({ organisation_name: 'Global Finance Corp' })
    .select('+wazuh_manager_password +wazuh_indexer_password +encryption_key');

  if (org) {
    console.log('Organisation:', org.organisation_name);

    // Check all fields for encryption key
    const allFields = Object.keys(org.toObject());
    console.log('\nAll fields:', allFields.join(', '));

    const keyFields = allFields.filter(f =>
      f.toLowerCase().includes('key') ||
      f.toLowerCase().includes('encrypt') ||
      f.toLowerCase().includes('secret')
    );

    if (keyFields.length > 0) {
      console.log('\nKey-related fields:', keyFields.join(', '));
      keyFields.forEach(field => {
        console.log(`  ${field}:`, org[field]);
      });
    }
  }

  await mongoose.connection.close();
}

check();
