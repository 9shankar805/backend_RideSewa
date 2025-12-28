# Complete API Endpoints for IndriveClone Frontend

🚀 **All required API endpoints for your IndriveClone mobile app**

## 🔐 **Authentication & User Management**

### **Phone Authentication & Registration**
```javascript
// Phone verification and OTP
POST /api/auth/send-otp
{
  "phone_number": "+1234567890"
}

POST /api/auth/verify-otp
{
  "phone_number": "+1234567890",
  "otp": "123456"
}

// User registration
POST /api/users/register
{
  "full_name": "John Doe",
  "phone_number": "+1234567890",
  "email": "john@email.com",
  "user_type": "passenger", // or "driver"
  "password": "hashedPassword"
}

// Login
POST /api/users/login
{
  "phone_number": "+1234567890",
  "password": "password"
}

// Refresh token
POST /api/auth/refresh-token
{
  "refresh_token": "token"
}

// Logout
POST /api/auth/logout
```

### **Profile Management**
```javascript
// Get user profile
GET /api/users/profile

// Update profile
PUT /api/users/profile
{
  "full_name": "John Doe Updated",
  "email": "newemail@email.com",
  "avatar_url": "https://..."
}

// Upload avatar
POST /api/users/avatar
// FormData with image file

// Biometric/Passkey setup
POST /api/auth/biometric/setup
{
  "biometric_data": "encrypted_data",
  "device_id": "device_unique_id"
}

POST /api/auth/biometric/verify
{
  "biometric_data": "encrypted_data",
  "device_id": "device_unique_id"
}
```

## 🗺️ **Location & Maps Services**

### **Google Places Integration**
```javascript
// Address autocomplete
POST /api/maps/autocomplete
{
  "input": "New York",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "radius": 50000
}

// Geocoding (address to coordinates)
POST /api/maps/geocode
{
  "address": "123 Main St, New York, NY"
}

// Reverse geocoding (coordinates to address)
POST /api/maps/reverse-geocode
{
  "latitude": 40.7128,
  "longitude": -74.0060
}

// Place details
POST /api/maps/place-details
{
  "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4"
}

// Get directions
POST /api/maps/directions
{
  "origin": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "destination": {
    "latitude": 40.7589,
    "longitude": -73.9851
  },
  "waypoints": [] // optional
}
```

### **Saved Places Management**
```javascript
// Get saved places
GET /api/places

// Add saved place
POST /api/places
{
  "name": "Home",
  "address": "123 Main St",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "type": "home" // home, work, other
}

// Update saved place
PUT /api/places/{placeId}
{
  "name": "Updated Home",
  "address": "456 New St"
}

// Delete saved place
DELETE /api/places/{placeId}
```

## 🚗 **Ride Management (Passenger)**

### **Ride Requests**
```javascript
// Create ride request
POST /api/rides
{
  "pickup_latitude": 40.7128,
  "pickup_longitude": -74.0060,
  "pickup_address": "123 Main St",
  "destination_latitude": 40.7589,
  "destination_longitude": -73.9851,
  "destination_address": "456 Broadway",
  "proposed_fare": 25.50,
  "ride_type": "standard", // standard, premium, shared
  "payment_method": "cash", // cash, card, wallet
  "notes": "Please call when you arrive"
}

// Get ride details
GET /api/rides/{rideId}

// Get ride bids
GET /api/rides/{rideId}/bids

// Accept a bid
POST /api/rides/{rideId}/accept
{
  "bid_id": "bid_uuid",
  "driver_id": "driver_uuid"
}

// Cancel ride
POST /api/rides/{rideId}/cancel
{
  "reason": "Changed plans",
  "cancellation_fee": 5.00
}
```

### **Scheduled Rides**
```javascript
// Schedule a ride
POST /api/rides/schedule
{
  "pickup_latitude": 40.7128,
  "pickup_longitude": -74.0060,
  "pickup_address": "123 Main St",
  "destination_latitude": 40.7589,
  "destination_longitude": -73.9851,
  "destination_address": "456 Broadway",
  "scheduled_time": "2024-12-30T10:00:00Z",
  "proposed_fare": 25.50
}

// Get scheduled rides
GET /api/rides/scheduled

// Update scheduled ride
PUT /api/rides/scheduled/{rideId}
{
  "scheduled_time": "2024-12-30T11:00:00Z",
  "proposed_fare": 30.00
}

// Cancel scheduled ride
DELETE /api/rides/scheduled/{rideId}
```

### **Trip History**
```javascript
// Get passenger trip history
GET /api/passengers/trips?page=1&limit=20&status=completed

// Get trip details
GET /api/passengers/trips/{tripId}

// Get favorite trips
GET /api/passengers/favorites
```

## 🚙 **Driver Features**

### **Driver Registration & Verification**
```javascript
// Driver registration
POST /api/drivers/register
{
  "license_number": "DL123456789",
  "license_expiry": "2025-12-31",
  "vehicle_registration": "ABC123",
  "vehicle_model": "Toyota Camry",
  "vehicle_color": "Black",
  "vehicle_plate": "NYC123",
  "vehicle_year": 2020,
  "insurance_number": "INS123456"
}

// Upload driver documents
POST /api/drivers/documents
// FormData with files: license, insurance, vehicle_registration, vehicle_photo

// Submit for verification
POST /api/drivers/verification
{
  "document_type": "license", // license, insurance, vehicle_registration
  "document_url": "https://..."
}

// Get verification status
GET /api/drivers/verification/status
```

### **Driver Operations**
```javascript
// Update driver status (online/offline)
POST /api/drivers/status
{
  "is_online": true,
  "is_available": true
}

// Update location
POST /api/drivers/location
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "heading": 45.5,
  "speed": 25.0
}

// Get available rides
GET /api/rides/available?radius=10&vehicle_type=standard

// Submit bid on ride
POST /api/rides/{rideId}/bid
{
  "proposed_fare": 22.00,
  "eta": 5,
  "message": "I'll be there in 5 minutes"
}

// Start ride
POST /api/rides/{rideId}/start
{
  "driver_id": "driver_uuid"
}

// Complete ride
POST /api/rides/{rideId}/complete
{
  "final_fare": 25.50,
  "distance_km": 8.5,
  "duration_minutes": 25
}
```

### **Driver Earnings & Statistics**
```javascript
// Get earnings summary
GET /api/drivers/earnings?period=week // day, week, month, year

// Get detailed earnings
GET /api/drivers/earnings/stats
{
  "total_rides": 150,
  "total_earnings": 2500.00,
  "average_rating": 4.8,
  "acceptance_rate": 85.5
}

// Get trip history
GET /api/drivers/trips?page=1&limit=20

// Get daily earnings
GET /api/drivers/earnings/daily?date=2024-12-28
```

## 💳 **Wallet & Payments**

### **Wallet Management**
```javascript
// Get wallet balance
GET /api/wallet

// Add money to wallet
POST /api/wallet/add
{
  "amount": 100.00,
  "payment_method_id": "pm_123456"
}

// Get transaction history
GET /api/wallet/transactions?page=1&limit=20

// Transfer money
POST /api/wallet/transfer
{
  "recipient_id": "user_uuid",
  "amount": 50.00,
  "note": "Payment for ride"
}
```

### **Payment Methods**
```javascript
// Get payment methods
GET /api/payments/methods

// Add payment method
POST /api/payments/methods
{
  "type": "card", // card, bank_account, digital_wallet
  "card_number": "4111111111111111",
  "expiry_month": 12,
  "expiry_year": 2025,
  "cvv": "123",
  "cardholder_name": "John Doe"
}

// Delete payment method
DELETE /api/payments/methods/{methodId}

// Process payment
POST /api/payments/process
{
  "amount": 25.50,
  "payment_method_id": "pm_123456",
  "ride_id": "ride_uuid"
}
```

### **Promo Codes & Discounts**
```javascript
// Get available promo codes
GET /api/promo-codes

// Apply promo code
POST /api/promo-codes/apply
{
  "code": "SAVE20",
  "ride_id": "ride_uuid"
}

// Validate promo code
POST /api/promo-codes/validate
{
  "code": "SAVE20",
  "amount": 25.50
}
```

## ⭐ **Ratings & Reviews**

### **Rating System**
```javascript
// Submit rating
POST /api/ratings
{
  "ride_id": "ride_uuid",
  "rated_user_id": "driver_uuid",
  "rating": 5,
  "review": "Great driver, very professional",
  "tip_amount": 5.00
}

// Get user ratings
GET /api/ratings/user/{userId}

// Get driver ratings
GET /api/ratings/driver/{driverId}

// Get passenger ratings
GET /api/ratings/passenger/{passengerId}
```

## 🔔 **Notifications**

### **Notification Management**
```javascript
// Get notifications
GET /api/notifications?page=1&limit=20

// Mark notification as read
PUT /api/notifications/{notificationId}/read

// Mark all as read
PUT /api/notifications/read-all

// Get notification settings
GET /api/notifications/settings

// Update notification settings
PUT /api/notifications/settings
{
  "push_enabled": true,
  "email_enabled": false,
  "sms_enabled": true,
  "ride_updates": true,
  "promotions": false
}

// Send notification (admin)
POST /api/notifications/send
{
  "user_id": "user_uuid",
  "title": "Ride Update",
  "message": "Your driver is arriving",
  "type": "ride_update",
  "data": {
    "ride_id": "ride_uuid"
  }
}
```

## 🚨 **Safety & Emergency**

### **Emergency Features**
```javascript
// Get emergency contacts
GET /api/emergency/contacts

// Add emergency contact
POST /api/emergency/contacts
{
  "name": "John Doe",
  "phone_number": "+1234567890",
  "relationship": "family"
}

// Delete emergency contact
DELETE /api/emergency/contacts/{contactId}

// Trigger SOS
POST /api/emergency/sos
{
  "ride_id": "ride_uuid",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "message": "Emergency help needed"
}

// Get safety settings
GET /api/safety/settings

// Update safety settings
PUT /api/safety/settings
{
  "share_trip": true,
  "auto_share_contacts": ["contact_uuid1", "contact_uuid2"],
  "emergency_auto_call": true
}
```

## 💬 **Communication**

### **In-Ride Chat**
```javascript
// Get ride messages
GET /api/chat/{rideId}/messages

// Send message
POST /api/chat/{rideId}/send
{
  "message": "I'm waiting at the main entrance",
  "type": "text" // text, location, image
}

// Initiate call
POST /api/communication/{rideId}/call
{
  "call_type": "voice" // voice, video
}
```

## 🚛 **Service Types**

### **Different Ride Types**
```javascript
// Get available services
GET /api/services

// City to city rides
POST /api/services/city-to-city
{
  "pickup_city": "New York",
  "destination_city": "Philadelphia",
  "pickup_address": "123 Main St",
  "destination_address": "456 Broad St",
  "departure_time": "2024-12-30T10:00:00Z",
  "passengers": 2,
  "proposed_fare": 150.00
}

// Courier service
POST /api/services/courier
{
  "pickup_address": "123 Main St",
  "delivery_address": "456 Broadway",
  "package_type": "documents",
  "package_weight": 1.5,
  "special_instructions": "Handle with care",
  "proposed_fare": 15.00
}

// Freight service
POST /api/services/freight
{
  "pickup_address": "123 Warehouse St",
  "delivery_address": "456 Factory Ave",
  "cargo_type": "electronics",
  "cargo_weight": 500,
  "vehicle_type": "truck",
  "proposed_fare": 200.00
}
```

## ⚙️ **Settings & Preferences**

### **App Settings**
```javascript
// Get user preferences
GET /api/settings/preferences

// Update preferences
PUT /api/settings/preferences
{
  "language": "en",
  "currency": "USD",
  "distance_unit": "km",
  "theme": "light",
  "auto_accept_rides": false,
  "preferred_payment_method": "card"
}

// Get privacy settings
GET /api/settings/privacy

// Update privacy settings
PUT /api/settings/privacy
{
  "share_location": true,
  "share_trip_status": true,
  "allow_contact": true,
  "data_sharing": false
}
```

## 📊 **Analytics & Reports**

### **User Analytics**
```javascript
// Get ride statistics
GET /api/analytics/rides?period=month

// Get spending analysis
GET /api/analytics/spending?period=year

// Get driver performance (for drivers)
GET /api/analytics/driver-performance?period=week
```

## 🔄 **Real-time WebSocket Events**

### **For Passengers:**
```javascript
// Connect to WebSocket
const socket = io('https://backend-ridesewa.onrender.com');

// Listen for events
socket.on('ride_update', (data) => {
  // Ride status changed
});

socket.on('new_bid', (data) => {
  // New driver bid received
});

socket.on('driver_location', (data) => {
  // Real-time driver location
});

socket.on('driver_arrived', (data) => {
  // Driver reached pickup
});

socket.on('ride_started', (data) => {
  // Ride has started
});

socket.on('ride_completed', (data) => {
  // Ride completed
});
```

### **For Drivers:**
```javascript
// Listen for events
socket.on('new_ride', (data) => {
  // New ride request available
});

socket.on('ride_cancelled', (data) => {
  // Passenger cancelled ride
});

socket.on('bid_accepted', (data) => {
  // Your bid was accepted
});

// Emit events
socket.emit('location_update', {
  latitude: 40.7128,
  longitude: -74.0060,
  heading: 45.5
});

socket.emit('driver_status', {
  is_online: true,
  is_available: true
});
```

## 🚀 **Implementation Priority**

### **Phase 1 - Core Features (Week 1-2)**
1. Authentication (register, login, OTP)
2. Basic ride creation and management
3. Driver status and location updates
4. Real-time WebSocket connection
5. Basic maps integration

### **Phase 2 - Enhanced Features (Week 3-4)**
1. Bidding system
2. Payment integration
3. Ratings and reviews
4. Notifications
5. Trip history

### **Phase 3 - Advanced Features (Week 5-6)**
1. Scheduled rides
2. Multiple service types
3. Emergency features
4. Chat functionality
5. Advanced analytics

### **Phase 4 - Premium Features (Week 7-8)**
1. Wallet system
2. Promo codes
3. Advanced safety features
4. Multi-language support
5. Admin features

## 📱 **Frontend Integration Example**

```javascript
// Complete API service for React Native
import axios from 'axios';
import io from 'socket.io-client';

const API_BASE = 'https://backend-ridesewa.onrender.com';

class RideSewa {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE,
      timeout: 10000
    });
    
    this.socket = null;
    this.setupInterceptors();
  }

  setupInterceptors() {
    this.api.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Authentication
  async register(userData) {
    const response = await this.api.post('/api/users/register', userData);
    this.setToken(response.data.token);
    return response.data;
  }

  async login(phoneNumber, password) {
    const response = await this.api.post('/api/users/login', {
      phone_number: phoneNumber,
      password
    });
    this.setToken(response.data.token);
    return response.data;
  }

  // Rides
  async requestRide(rideData) {
    return await this.api.post('/api/rides', rideData);
  }

  async getRides() {
    return await this.api.get('/api/rides');
  }

  // WebSocket
  connectSocket(userId) {
    this.socket = io(API_BASE, {
      auth: { userId }
    });
    
    this.socket.on('connect', () => {
      console.log('Connected to RideSewa');
    });
    
    return this.socket;
  }

  // Helper methods
  setToken(token) {
    // Store in AsyncStorage or SecureStore
  }

  getToken() {
    // Retrieve from storage
  }
}

export default new RideSewa();
```

---

**🎯 This complete API specification covers all screens and features in your IndriveClone app. Your frontend team can now implement the full ride-hailing experience!**