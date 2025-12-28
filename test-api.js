const axios = require('axios');

const BASE_URL = 'https://backend-ridesewa.onrender.com';

const testEndpoints = [
  // Public endpoints
  { method: 'GET', url: '/health', auth: false },
  { method: 'GET', url: '/api/status', auth: false },
  { method: 'GET', url: '/api/websocket/test', auth: false },
  
  // Auth endpoints
  { method: 'POST', url: '/api/users/register', auth: false, data: { full_name: 'Test User', phone_number: '+1234567890', email: 'test@test.com', user_type: 'passenger' } },
  { method: 'POST', url: '/api/users/login', auth: false, data: { phone_number: '+1234567890' } },
  
  // Rides endpoints
  { method: 'GET', url: '/api/rides', auth: false },
  { method: 'GET', url: '/api/rides/available', auth: false },
  
  // Driver endpoints
  { method: 'POST', url: '/api/drivers/nearby', auth: false, data: { latitude: 27.7172, longitude: 85.3240 } },
];

async function testAPI() {
  console.log('🧪 Testing API endpoints...\n');
  
  for (const endpoint of testEndpoints) {
    try {
      const config = {
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.url}`,
        timeout: 10000
      };
      
      if (endpoint.data) {
        config.data = endpoint.data;
      }
      
      const response = await axios(config);
      console.log(`✅ ${endpoint.method} ${endpoint.url} - Status: ${response.status}`);
      
    } catch (error) {
      const status = error.response?.status || 'TIMEOUT';
      const message = error.response?.data?.error || error.message;
      console.log(`❌ ${endpoint.method} ${endpoint.url} - Status: ${status} - ${message}`);
    }
  }
  
  console.log('\n🏁 API test completed');
}

testAPI();