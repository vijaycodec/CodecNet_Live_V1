import mongoose from 'mongoose';
import Organisation from '../models/organisation.model.js';

mongoose.connect('mongodb://localhost:27017/soc_dashboard')
  .then(async () => {
    console.log('Connected to MongoDB\n');

    const result = await Organisation.updateOne(
      { _id: new mongoose.Types.ObjectId('68ef40c42c29395fd30828de') },
      {
        $set: {
          wazuh_manager_ip: '192.168.1.130',
          wazuh_manager_port: 55000,
          wazuh_manager_username: 'wazuh',
          wazuh_manager_password: '1rK.k+ctdawP8z3XhNio66Q8t8zGpGxP',
          wazuh_indexer_ip: '192.168.1.130',
          wazuh_indexer_port: 9200,
          wazuh_indexer_username: 'admin',
          wazuh_indexer_password: 'aBDQ.8oTtu7*UBP4Uqm51.Py9pUcLGla',
          wazuh_dashboard_ip: '192.168.1.130',
          wazuh_dashboard_port: 443,
          wazuh_dashboard_username: 'admin',
          wazuh_dashboard_password: 'aBDQ.8oTtu7*UBP4Uqm51.Py9pUcLGla'
        }
      }
    );

    console.log('Updated Global Finance Corp credentials:', result.modifiedCount > 0 ? 'Success' : 'No changes');

    // Verify
    const org = await Organisation.findById('68ef40c42c29395fd30828de').select('organisation_name wazuh_manager_ip wazuh_manager_username');
    console.log('\nVerification:');
    console.log('  Organisation:', org.organisation_name);
    console.log('  Wazuh IP:', org.wazuh_manager_ip);
    console.log('  Username:', org.wazuh_manager_username);

    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
