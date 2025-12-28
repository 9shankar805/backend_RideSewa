const axios = require('axios');

const BASE_URL = 'https://backend-ridesewa.onrender.com';

async function testDriverRideVisibility() {
  console.log('🧪 Testing driver ride visibility...\n');
  
  try {
    // 1. Check current available rides
    console.log('1. Checking current available rides...');
    let availableResponse = await axios.get(`${BASE_URL}/api/rides/available`);
    console.log('✅ Current available rides:', availableResponse.data.length);
    
    // 2. Create a new ride request
    console.log('\n2. Creating new ride request...');
    const rideResponse = await axios.post(`${BASE_URL}/api/rides`, {
      pickup_latitude: 26.70599566387968,
      pickup_longitude: 86.47132722660899,
      pickup_address: 'Lahan Road, Lahan, Madhesh Province',
      destination_latitude: 27.7061,
      destination_longitude: 85.3299,
      destination_address: 'Siraha, Nepal',
      proposed_fare: 3666,
      ride_type: 'ride',
      is_for_other: false
    });
    
    const rideId = rideResponse.data.ride.id;
    console.log('✅ Ride created with ID:', rideId);
    
    // 3. Immediately check available rides again
    console.log('\n3. Checking available rides after creation...');
    availableResponse = await axios.get(`${BASE_URL}/api/rides/available`);
    console.log('✅ Available rides after creation:', availableResponse.data.length);
    
    // 4. Check if our specific ride is in the list
    const ourRide = availableResponse.data.find(ride => ride.id === rideId);
    if (ourRide) {
      console.log('✅ Our ride is visible to drivers!');
      console.log('📋 Ride details for drivers:');
      console.log('   - ID:', ourRide.id);
      console.log('   - Pickup:', ourRide.pickup_address);
      console.log('   - Destination:', ourRide.destination_address);
      console.log('   - Fare:', ourRide.proposed_fare);
      console.log('   - Status:', ourRide.status);
    } else {
      console.log('❌ Our ride is NOT visible to drivers');
      console.log('Available rides:', availableResponse.data.map(r => ({ id: r.id, status: r.status })));
    }
    
    // 5. Test ride details endpoint
    console.log('\n4. Testing ride details endpoint...');
    const detailsResponse = await axios.get(`${BASE_URL}/api/rides/${rideId}`);
    console.log('✅ Ride details accessible:', detailsResponse.data.id);
    
  } catch (error) {
    const status = error.response?.status || 'TIMEOUT';
    const message = error.response?.data?.error || error.message;
    console.log('❌ Test failed - Status:', status, '- Error:', message);
  }
  
  console.log('\n🏁 Driver visibility test completed');
}

testDriverRideVisibility();