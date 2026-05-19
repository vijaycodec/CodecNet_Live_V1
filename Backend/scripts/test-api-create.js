import axios from 'axios';
import jwt from 'jsonwebtoken';

async function testCreateAsset() {
  try {
    // Create a valid JWT token
    const token = jwt.sign(
      { _id: '68ef40c42c29395fd30828d8', username: 'superadmin' },
      'soc_dashboard_jwt_secret_2024_development_key_256_bit_secure',
      { expiresIn: '1h' }
    );

    console.log('Testing asset creation via API...\n');

    const assetData = {
      organisation_id: '68ef40c42c29395fd30828de', // Global Finance Corp
      asset_tag: 'API-TEST-001',
      asset_name: 'API Test Asset',
      asset_type: 'endpoint',
      network_zone: 'internal',
      status: 'active',
      asset_severity: 'low',
      data_classification: 'internal',
      environment: 'production'
    };

    console.log('Sending data:');
    console.log(JSON.stringify(assetData, null, 2));
    console.log('\n');

    const response = await axios.post(
      'http://localhost:5000/api/asset-register',
      assetData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✓ Success!');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('✗ Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testCreateAsset();
