const axios = require('axios');

const BASE_URL = 'https://backend-ridesewa.onrender.com';

async function testDriverEndpoints() {
  console.log('🧪 Testing driver endpoints...\n');
  
  try {
    // Test driver status update
    console.log('1. Testing driver status update...');
    const statusResponse = await axios.post(`${BASE_URL}/api/drivers/status`, {
      isOnline: true,
      isAvailable: true
    });
    console.log('✅ Driver status - Status:', statusResponse.status);
    console.log('📋 Response:', statusResponse.data);
    
    // Test driver location update
    console.log('\n2. Testing driver location update...');
    const locationResponse = await axios.post(`${BASE_URL}/api/drivers/location`, {
      latitude: 27.7172,
      longitude: 85.3240,
      heading: 90
    });
    console.log('✅ Driver location - Status:', locationResponse.status);
    console.log('📋 Response:', locationResponse.data);
    
    // Test WebSocket info
    console.log('\n3. Testing WebSocket info...');
    const wsResponse = await axios.get(`${BASE_URL}/api/websocket/test`);
    console.log('✅ WebSocket test - Status:', wsResponse.status);
    console.log('📋 WebSocket info:', wsResponse.data);
    
    // Test driver registration
    console.log('\n4. Testing driver registration...');
    const regResponse = await axios.post(`${BASE_URL}/api/drivers/register`, {
      vehicleType: 'Car',
      vehicleModel: 'Toyota Corolla',
      vehiclePlate: 'BA 1 PA 1234',
      vehicleColor: 'White'
    });
    console.log('✅ Driver registration - Status:', regResponse.status);
    console.log('📋 Response:', regResponse.data);
    
  } catch (error) {
    const status = error.response?.status || 'TIMEOUT';
    const message = error.response?.data?.error || error.message;
    console.log('❌ Test failed - Status:', status, '- Error:', message);
  }
  
  console.log('\n🏁 Driver endpoints test completed');
}

testDriverEndpoints();