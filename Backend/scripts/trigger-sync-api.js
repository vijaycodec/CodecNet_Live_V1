import axios from 'axios';
import jwt from 'jsonwebtoken';

async function triggerSync() {
  try {
    // Create a valid JWT token for testing
    const token = jwt.sign(
      { _id: '68ef40c42c29395fd30828d8', username: 'superadmin' },
      'soc_dashboard_jwt_secret_2024_development_key_256_bit_secure',
      { expiresIn: '1h' }
    );

    console.log('Triggering sync for Codec Networks via API...\n');

    const response = await axios.post(
      'http://localhost:5000/api/asset-register/sync',
      {
        organisation_id: '68ef40c42c29395fd30828dc' // Codec Networks
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    console.log('Sync Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Error Response:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

triggerSync();
