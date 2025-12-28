const axios = require('axios');

const BASE_URL = 'https://backend-ridesewa.onrender.com';

async function testRideFlow() {
  console.log('🧪 Testing ride creation and retrieval flow...\n');
  
  try {
    // 1. Create a ride request
    console.log('1. Creating ride request...');
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
    
    console.log('✅ Ride created:', rideResponse.data.ride.id);
    const rideId = rideResponse.data.ride.id;
    
    // 2. Check if ride appears in available rides
    console.log('\n2. Checking available rides...');
    const availableResponse = await axios.get(`${BASE_URL}/api/rides/available`);
    console.log('✅ Available rides count:', availableResponse.data.length);
    
    const foundRide = availableResponse.data.find(ride => ride.id === rideId);
    if (foundRide) {
      console.log('✅ Ride found in available rides!');
      console.log('📋 Ride details:', {
        id: foundRide.id,
        pickup: foundRide.pickup_address,
        destination: foundRide.destination_address,
        fare: foundRide.proposed_fare,
        status: foundRide.status
      });
    } else {
      console.log('❌ Ride NOT found in available rides');
    }
    
    // 3. Get specific ride details
    console.log('\n3. Getting ride details...');
    const detailsResponse = await axios.get(`${BASE_URL}/api/rides/${rideId}`);
    console.log('✅ Ride details retrieved:', detailsResponse.data.id);
    
  } catch (error) {
    const status = error.response?.status || 'TIMEOUT';
    const message = error.response?.data?.error || error.message;
    console.log('❌ Test failed - Status:', status, '- Error:', message);
  }
  
  console.log('\n🏁 Ride flow test completed');
}

testRideFlow();