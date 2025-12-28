const axios = require('axios');

const BASE_URL = 'https://backend-ridesewa.onrender.com';

async function testContactInfo() {
  console.log('🧪 Testing contact info functionality...\n');
  
  try {
    // Test ride creation with contact info
    const rideData = {
      pickup_latitude: 27.7172,
      pickup_longitude: 85.3240,
      pickup_address: 'Kathmandu, Nepal',
      destination_latitude: 27.7061,
      destination_longitude: 85.3299,
      destination_address: 'Thamel, Kathmandu',
      proposed_fare: 150,
      contact_name: 'John Doe',
      contact_phone: '+977-9841234567',
      is_for_other: true
    };
    
    const response = await axios.post(`${BASE_URL}/api/rides`, rideData, {
      timeout: 10000
    });
    
    console.log('✅ Contact info endpoint - Status:', response.status);
    console.log('📋 Response data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    const status = error.response?.status || 'TIMEOUT';
    const message = error.response?.data?.error || error.message;
    console.log('❌ Contact info test - Status:', status, '- Error:', message);
  }
  
  console.log('\n🏁 Contact info test completed');
}

testContactInfo();