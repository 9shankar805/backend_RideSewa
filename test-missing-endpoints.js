const axios = require('axios');

const BASE_URL = 'https://backend-ridesewa.onrender.com';

async function testMissingEndpoints() {
  console.log('🧪 Testing missing endpoints...\n');
  
  const rideId = 'ride_1766902993728';
  
  const tests = [
    { method: 'GET', url: `/api/rides/${rideId}/bids`, name: 'Ride Bids' },
    { method: 'GET', url: `/api/rides/${rideId}`, name: 'Ride Details' },
    { method: 'GET', url: '/api/wallet', name: 'Wallet' },
    { method: 'GET', url: '/api/users/notifications', name: 'Notifications' },
    { method: 'POST', url: '/api/drivers/register', name: 'Driver Registration', data: { vehicle_type: 'car' } }
  ];
  
  for (const test of tests) {
    try {
      const config = {
        method: test.method,
        url: `${BASE_URL}${test.url}`,
        timeout: 10000
      };
      
      if (test.data) {
        config.data = test.data;
      }
      
      const response = await axios(config);
      console.log(`✅ ${test.name} - Status: ${response.status}`);
      
    } catch (error) {
      const status = error.response?.status || 'TIMEOUT';
      const message = error.response?.data?.error || error.message;
      console.log(`❌ ${test.name} - Status: ${status} - ${message}`);
    }
  }
  
  console.log('\n🏁 Missing endpoints test completed');
}

testMissingEndpoints();