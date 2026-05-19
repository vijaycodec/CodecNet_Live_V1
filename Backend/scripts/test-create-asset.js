import mongoose from 'mongoose';
import AssetRegister from '../models/assetRegisterManagement.model.js';

mongoose.connect('mongodb://localhost:27017/soc_dashboard')
  .then(async () => {
    console.log('Connected to MongoDB\n');

    // Test data matching frontend form defaults
    const testAsset = {
      organisation_id: '68ef40c42c29395fd30828de', // Global Finance Corp
      asset_tag: 'TEST-001',
      asset_name: 'Test Asset',
      asset_type: 'endpoint',
      asset_category: '',
      ip_address: '',
      mac_address: '',
      network_zone: 'internal',
      operating_system: '',
      os_version: '',
      os_architecture: '',
      kernel_version: '',
      status: 'active',
      asset_severity: 'low',
      data_classification: 'internal',
      environment: 'production',
      manufacturer: '',
      model: '',
      serial_number: '',
      location: '',
      notes: ''
    };

    console.log('Testing asset creation with data:');
    console.log(JSON.stringify(testAsset, null, 2));
    console.log('\n');

    try {
      const asset = new AssetRegister(testAsset);
      const savedAsset = await asset.save();
      console.log('✓ Asset created successfully!');
      console.log('Asset ID:', savedAsset._id.toString());

      // Clean up
      await AssetRegister.findByIdAndDelete(savedAsset._id);
      console.log('✓ Test asset deleted');
    } catch (error) {
      console.error('✗ Validation Error:');
      console.error('Message:', error.message);
      if (error.errors) {
        console.error('\nValidation Errors:');
        Object.keys(error.errors).forEach(key => {
          console.error(`  - ${key}: ${error.errors[key].message}`);
        });
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
