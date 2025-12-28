const axios = require('axios');

// Test Google Maps API integration
async function testMapsAPI() {
  const apiKey = 'AIzaSyCA3uTGHA-w-9nyfne5v1YiiAVRHJU03RE';
  
  console.log('🗺️  Testing Google Maps API...');
  
  try {
    // Test Geocoding
    const geocodeResponse = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
      params: {
        address: 'New York, NY',
        key: apiKey
      }
    });
    
    if (geocodeResponse.data.status === 'OK') {
      console.log('✅ Geocoding API: Working');
      console.log('📍 New York coordinates:', geocodeResponse.data.results[0].geometry.location);
    } else {
      console.log('❌ Geocoding API: Failed -', geocodeResponse.data.status);
    }
    
    // Test Directions
    const directionsResponse = await axios.get(`https://maps.googleapis.com/maps/api/directions/json`, {
      params: {
        origin: '40.7128,-74.0060', // New York
        destination: '34.0522,-118.2437', // Los Angeles
        key: apiKey
      }
    });
    
    if (directionsResponse.data.status === 'OK') {
      console.log('✅ Directions API: Working');
      const route = directionsResponse.data.routes[0];
      console.log('🚗 NY to LA:', route.legs[0].distance.text, '-', route.legs[0].duration.text);
    } else {
      console.log('❌ Directions API: Failed -', directionsResponse.data.status);
    }
    
  } catch (error) {
    console.log('❌ API Test Failed:', error.message);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testMapsAPI();
}

module.exports = testMapsAPI;