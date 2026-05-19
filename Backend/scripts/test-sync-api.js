import axios from 'axios';

async function testSync() {
  try {
    console.log('Testing sync API for Codec Networks...\n');

    // You need to provide a valid JWT token here
    // For now, let's test without auth to see the error
    const response = await axios.post(
      'http://localhost:5000/api/asset-register/sync',
      {
        organisation_id: '68ef40c42c29395fd30828dc' // Codec Networks
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    console.log('Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('Error Response:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testSync();
