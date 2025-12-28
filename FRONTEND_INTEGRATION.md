# Frontend Integration Guide - RideSewa Backend

🚀 **Complete guide for connecting your mobile/web app to RideSewa backend**

## 📋 **Quick Setup Checklist**

- [ ] Install Socket.io client
- [ ] Configure API base URL
- [ ] Implement JWT authentication
- [ ] Setup location services
- [ ] Connect WebSocket for real-time updates

## 🔧 **1. Installation & Setup**

### **React Native**
```bash
npm install axios socket.io-client @react-native-async-storage/async-storage
npm install react-native-geolocation-service react-native-permissions
```

### **Flutter**
```yaml
dependencies:
  http: ^0.13.5
  socket_io_client: ^2.0.3+1
  geolocator: ^9.0.2
  permission_handler: ^10.4.3
```

### **React/Vue Web App**
```bash
npm install axios socket.io-client
```

## 🌐 **2. API Configuration**

### **Base Configuration**
```javascript
// config/api.js
export const API_CONFIG = {
  BASE_URL: 'https://backend-ridesewa.onrender.com',
  WEBSOCKET_URL: 'https://backend-ridesewa.onrender.com',
  TIMEOUT: 10000
};

// HTTP Client Setup
import axios from 'axios';

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add JWT token to all requests
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken(); // Your token storage method
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 🔐 **3. Authentication Implementation**

### **User Registration**
```javascript
// services/authService.js
export const registerUser = async (userData) => {
  try {
    const response = await apiClient.post('/api/users/register', {
      full_name: userData.name,
      phone_number: userData.phone,
      email: userData.email,
      user_type: userData.type // 'passenger' or 'driver'
    });
    
    // Store JWT token
    await storeToken(response.data.token);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Registration failed');
  }
};

export const loginUser = async (phoneNumber) => {
  try {
    const response = await apiClient.post('/api/users/login', {
      phone_number: phoneNumber
    });
    
    await storeToken(response.data.token);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Login failed');
  }
};
```

## 🔌 **4. WebSocket Connection**

### **Real-time Service**
```javascript
// services/socketService.js
import io from 'socket.io-client';
import { API_CONFIG } from '../config/api';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(userId) {
    this.socket = io(API_CONFIG.WEBSOCKET_URL, {
      auth: {
        userId: userId
      }
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      this.isConnected = false;
    });

    // Essential event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Ride updates
    this.socket.on('ride_update', (data) => {
      console.log('🚗 Ride update:', data);
      // Update your UI here
    });

    // New ride requests (for drivers)
    this.socket.on('new_ride', (data) => {
      console.log('🔔 New ride request:', data);
      // Show ride request to driver
    });

    // Bid updates (for passengers)
    this.socket.on('new_bid', (data) => {
      console.log('💰 New bid received:', data);
      // Show bid to passenger
    });

    // Driver location updates
    this.socket.on('driver_location', (data) => {
      console.log('📍 Driver location:', data);
      // Update driver marker on map
    });
  }

  // Send location update (for drivers)
  updateLocation(latitude, longitude) {
    if (this.isConnected) {
      this.socket.emit('location_update', {
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }
}

export default new SocketService();
```

## 🚗 **5. Ride Management**

### **Passenger - Request Ride**
```javascript
// services/rideService.js
export const requestRide = async (rideData) => {
  try {
    const response = await apiClient.post('/api/rides', {
      pickup_latitude: rideData.pickup.latitude,
      pickup_longitude: rideData.pickup.longitude,
      pickup_address: rideData.pickup.address,
      destination_latitude: rideData.destination.latitude,
      destination_longitude: rideData.destination.longitude,
      destination_address: rideData.destination.address,
      proposed_fare: rideData.fare
    });
    
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to request ride');
  }
};

export const getRides = async () => {
  try {
    const response = await apiClient.get('/api/rides');
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch rides');
  }
};

export const cancelRide = async (rideId, reason) => {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/cancel`, {
      reason: reason
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to cancel ride');
  }
};
```

### **Driver - Manage Rides**
```javascript
export const getAvailableRides = async () => {
  try {
    const response = await apiClient.get('/api/rides/available');
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch available rides');
  }
};

export const submitBid = async (rideId, bidData) => {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/bid`, {
      proposedFare: bidData.fare,
      eta: bidData.eta,
      message: bidData.message
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to submit bid');
  }
};

export const updateDriverStatus = async (isOnline, isAvailable) => {
  try {
    const response = await apiClient.post('/api/drivers/status', {
      isOnline,
      isAvailable
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to update status');
  }
};
```

## 📍 **6. Location Services**

### **Location Manager**
```javascript
// services/locationService.js
import Geolocation from 'react-native-geolocation-service';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

class LocationService {
  constructor() {
    this.watchId = null;
    this.currentLocation = null;
  }

  async requestPermission() {
    try {
      const result = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  }

  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          this.currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          resolve(this.currentLocation);
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  }

  startLocationUpdates(callback) {
    this.watchId = Geolocation.watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        this.currentLocation = location;
        callback(location);
      },
      (error) => console.error('Location watch error:', error),
      { enableHighAccuracy: true, distanceFilter: 10, interval: 30000 }
    );
  }

  stopLocationUpdates() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Send location to backend (for drivers)
  async updateLocationOnServer(location) {
    try {
      await apiClient.post('/api/drivers/location', {
        latitude: location.latitude,
        longitude: location.longitude
      });
    } catch (error) {
      console.error('Failed to update location on server:', error);
    }
  }
}

export default new LocationService();
```

## 🔔 **7. Notifications**

### **Notification Manager**
```javascript
// services/notificationService.js
export const getNotifications = async () => {
  try {
    const response = await apiClient.get('/api/notifications');
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch notifications');
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    await apiClient.put(`/api/notifications/${notificationId}/read`);
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
};

export const sendNotification = async (userId, title, body, data = {}) => {
  try {
    const response = await apiClient.post('/api/notifications/send', {
      userId,
      title,
      body,
      data
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to send notification');
  }
};
```

## 🗺️ **8. Maps Integration**

### **Maps Service**
```javascript
// services/mapsService.js
export const geocodeAddress = async (address) => {
  try {
    const response = await apiClient.post('/api/maps/geocode', {
      address: address
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to geocode address');
  }
};

export const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await apiClient.post('/api/maps/reverse-geocode', {
      lat: latitude,
      lng: longitude
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to reverse geocode');
  }
};

export const findNearbyDrivers = async (latitude, longitude, radius = 10) => {
  try {
    const response = await apiClient.post('/api/drivers/nearby', {
      latitude,
      longitude,
      radius
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to find nearby drivers');
  }
};
```

## 🔄 **9. Complete Integration Example**

### **Passenger App Flow**
```javascript
// screens/PassengerHomeScreen.js
import React, { useEffect, useState } from 'react';
import socketService from '../services/socketService';
import locationService from '../services/locationService';
import { requestRide } from '../services/rideService';

const PassengerHomeScreen = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [rideStatus, setRideStatus] = useState('idle');

  useEffect(() => {
    // Initialize services
    initializeServices();
    
    return () => {
      // Cleanup
      socketService.disconnect();
      locationService.stopLocationUpdates();
    };
  }, []);

  const initializeServices = async () => {
    // Get location permission
    const hasPermission = await locationService.requestPermission();
    if (hasPermission) {
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);
    }

    // Connect to WebSocket
    const userId = getUserId(); // Your method to get user ID
    socketService.connect(userId);
  };

  const handleRequestRide = async (destination) => {
    try {
      const rideData = {
        pickup: currentLocation,
        destination: destination,
        fare: 250.00
      };
      
      const result = await requestRide(rideData);
      setRideStatus('searching');
      
      // Listen for ride updates
      socketService.socket.on('ride_update', (data) => {
        setRideStatus(data.status);
      });
      
    } catch (error) {
      console.error('Failed to request ride:', error);
    }
  };

  return (
    // Your UI components here
    <div>
      {/* Map, ride request form, etc. */}
    </div>
  );
};
```

### **Driver App Flow**
```javascript
// screens/DriverHomeScreen.js
import React, { useEffect, useState } from 'react';
import socketService from '../services/socketService';
import locationService from '../services/locationService';
import { updateDriverStatus, getAvailableRides } from '../services/rideService';

const DriverHomeScreen = () => {
  const [isOnline, setIsOnline] = useState(false);
  const [availableRides, setAvailableRides] = useState([]);

  useEffect(() => {
    initializeServices();
    
    return () => {
      socketService.disconnect();
      locationService.stopLocationUpdates();
    };
  }, []);

  const initializeServices = async () => {
    // Connect WebSocket
    const userId = getUserId();
    socketService.connect(userId);

    // Listen for new ride requests
    socketService.socket.on('new_ride', (ride) => {
      setAvailableRides(prev => [...prev, ride]);
    });

    // Start location tracking
    locationService.startLocationUpdates((location) => {
      // Send location to server every 30 seconds
      locationService.updateLocationOnServer(location);
      // Send via WebSocket for real-time updates
      socketService.updateLocation(location.latitude, location.longitude);
    });
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      await updateDriverStatus(newStatus, newStatus);
      setIsOnline(newStatus);
      
      if (newStatus) {
        // Fetch available rides when going online
        const rides = await getAvailableRides();
        setAvailableRides(rides);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    // Your UI components here
    <div>
      {/* Online/offline toggle, available rides list, etc. */}
    </div>
  );
};
```

## 🚨 **10. Error Handling**

### **Global Error Handler**
```javascript
// utils/errorHandler.js
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.error || 'Server error occurred';
    console.error('API Error:', message);
    return message;
  } else if (error.request) {
    // Network error
    console.error('Network Error:', error.request);
    return 'Network connection failed';
  } else {
    // Other error
    console.error('Error:', error.message);
    return error.message;
  }
};

// Usage in components
try {
  const result = await requestRide(rideData);
} catch (error) {
  const errorMessage = handleApiError(error);
  showErrorToUser(errorMessage);
}
```

## 📱 **11. Testing Your Integration**

### **Test Checklist**
- [ ] User registration/login works
- [ ] JWT token is stored and sent with requests
- [ ] WebSocket connection establishes successfully
- [ ] Location updates are sent to server
- [ ] Ride requests create properly
- [ ] Real-time updates are received
- [ ] Error handling works correctly

### **Test API Endpoints**
```javascript
// Test basic connectivity
const testConnection = async () => {
  try {
    const response = await fetch('https://backend-ridesewa.onrender.com/health');
    const data = await response.json();
    console.log('Backend status:', data.status);
  } catch (error) {
    console.error('Backend connection failed:', error);
  }
};
```

## 🎯 **Quick Start Commands**

```bash
# Test backend health
curl https://backend-ridesewa.onrender.com/health

# Test ride creation (replace with your JWT token)
curl -X POST https://backend-ridesewa.onrender.com/api/rides \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"pickup_latitude":27.7172,"pickup_longitude":85.3240,"pickup_address":"Kathmandu","destination_latitude":27.7000,"destination_longitude":85.3200,"destination_address":"Patan","proposed_fare":250}'
```

## 🔗 **Important URLs**

- **Backend API**: `https://backend-ridesewa.onrender.com`
- **WebSocket**: `https://backend-ridesewa.onrender.com`
- **Admin Dashboard**: `https://backend-ridesewa.onrender.com/admin`
- **Health Check**: `https://backend-ridesewa.onrender.com/health`

---

**🚀 Your backend is ready! Follow this guide to connect your frontend and you'll have a fully functional ride-hailing app.**

**Need help? Check the API documentation at `/api.md` or contact the backend team.**