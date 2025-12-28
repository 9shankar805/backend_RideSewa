const axios = require('axios');

const BASE_URL = 'https://backend-ridesewa.onrender.com';

async function testNewEndpoints() {
  console.log('🧪 Testing new endpoints...\n');
  
  try {
    // Test ride estimate
    console.log('Testing ride estimate...');
    const estimateResponse = await axios.post(`${BASE_URL}/api/rides/estimate`, {
      pickup_latitude: 27.7172,
      pickup_longitude: 85.3240,
      destination_latitude: 27.7061,
      destination_longitude: 85.3299,
      rideType: 'ride'
    });
    console.log('✅ Ride estimate - Status:', estimateResponse.status);
    console.log('📋 Estimate data:', estimateResponse.data);
    
    // Test ride creation
    console.log('\nTesting ride creation...');
    const rideResponse = await axios.post(`${BASE_URL}/api/rides`, {
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
    });
    console.log('✅ Ride creation - Status:', rideResponse.status);
    console.log('📋 Ride data:', rideResponse.data);
    
  } catch (error) {
    const status = error.response?.status || 'TIMEOUT';
    const message = error.response?.data?.error || error.message;
    console.log('❌ Test failed - Status:', status, '- Error:', message);
  }
  
  console.log('\n🏁 Endpoint test completed');
}

testNewEndpoints();