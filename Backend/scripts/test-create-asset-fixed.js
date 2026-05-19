import mongoose from 'mongoose';
import AssetRegister from '../models/assetRegisterManagement.model.js';

mongoose.connect('mongodb://localhost:27017/soc_dashboard')
  .then(async () => {
    console.log('Connected to MongoDB\n');

    // Test data with undefined instead of empty strings for optional fields
    const testAsset = {
      organisation_id: '68ef40c42c29395fd30828de',
      asset_tag: 'TEST-002',
      asset_name: 'Test Asset with proper data',
      asset_type: 'endpoint',
      network_zone: 'internal',
      status: 'active',
      asset_severity: 'low',
      data_classification: 'internal',
      environment: 'production'
      // All other optional fields are omitted (undefined)
    };

    console.log('Testing asset creation with cleaned data:');
    console.log(JSON.stringify(testAsset, null, 2));
    console.log('\n');

    try {
      const asset = new AssetRegister(testAsset);
      const savedAsset = await asset.save();
      console.log('✓ Asset created successfully!');
      console.log('Asset ID:', savedAsset._id.toString());
      console.log('Asset Tag:', savedAsset.asset_tag);
      console.log('Asset Name:', savedAsset.asset_name);

      // Clean up
      await AssetRegister.findByIdAndDelete(savedAsset._id);
      console.log('\n✓ Test asset deleted');
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
