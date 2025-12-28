const axios = require('axios');

const BASE_URL = 'https://backend-ridesewa.onrender.com';

async function runMigration() {
  console.log('🔧 Triggering database migration...\n');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/migrate`, {}, {
      timeout: 30000
    });
    
    console.log('✅ Migration Status:', response.status);
    console.log('📋 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    const status = error.response?.status || 'TIMEOUT';
    const message = error.response?.data?.error || error.message;
    console.log('❌ Migration failed - Status:', status, '- Error:', message);
  }
  
  console.log('\n🏁 Migration completed');
}

runMigration();