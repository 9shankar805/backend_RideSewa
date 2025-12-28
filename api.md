# InDrive Backend API Documentation

## Base URL
```
http://localhost:3002
```

## System Endpoints

### Health Check
- **GET** `/health`
- **Description**: Check server health and service status
- **Response**: 
```json
{
  "status": "healthy",
  "timestamp": "2024-12-28T01:39:14.297Z",
  "services": {
    "database": "connected",
    "maps": "enabled",
    "server": "running"
  }
}
```

### API Test
- **GET** `/api/test`
- **Description**: Test API connectivity
- **Response**:
```json
{
  "message": "InDrive Backend API is working!",
  "timestamp": "2024-12-28T01:39:14.297Z",
  "features": [
    "Google Maps Integration",
    "Admin Dashboard",
    "Health Monitoring",
    "Production Ready"
  ]
}
```

## Admin Dashboard

### Admin Panel
- **GET** `/admin`
- **Description**: Serve admin dashboard HTML page

### Dashboard Data
- **GET** `/api/admin/dashboard`
- **Description**: Get admin dashboard statistics
- **Response**:
```json
{
  "totalRides": 0,
  "activeDrivers": 0,
  "totalUsers": 0,
  "todayRevenue": 0,
  "recentRides": [],
  "driverApplications": [],
  "supportTickets": [],
  "systemHealth": {
    "database": "healthy",
    "redis": "degraded",
    "api": "healthy",
    "uptime": "99.9%"
  }
}
```

## Rides Management

### Get All Rides
- **GET** `/api/rides`
- **Description**: Retrieve all rides
- **Response**:
```json
[
  {
    "id": "R001",
    "passenger": "John Doe",
    "driver": "Mike Johnson",
    "from": "Downtown",
    "to": "Airport",
    "fare": 25.50,
    "status": "completed"
  }
]
```

### Cancel Ride
- **POST** `/api/rides/:id/cancel`
- **Description**: Cancel a specific ride
- **Response**:
```json
{
  "success": true,
  "message": "Ride cancelled successfully"
}
```

## Driver Management

### Get All Drivers
- **GET** `/api/drivers`
- **Description**: Retrieve all drivers
- **Response**:
```json
[
  {
    "id": "D001",
    "name": "Mike Johnson",
    "email": "mike@email.com",
    "phone": "+1234567890",
    "vehicle": "Toyota Camry 2020",
    "status": "online",
    "rating": 4.8
  }
]
```

### Approve Driver
- **POST** `/api/drivers/:id/approve`
- **Description**: Approve a driver application
- **Response**:
```json
{
  "success": true,
  "message": "Driver approved successfully"
}
```

### Suspend Driver
- **POST** `/api/drivers/:id/suspend`
- **Description**: Suspend a driver
- **Response**:
```json
{
  "success": true,
  "message": "Driver suspended successfully"
}
```

### Delete Driver
- **DELETE** `/api/drivers/:id`
- **Description**: Delete a driver
- **Response**:
```json
{
  "success": true,
  "message": "Driver deleted successfully"
}
```

## User Management

### Get All Users
- **GET** `/api/users`
- **Description**: Retrieve all users
- **Response**:
```json
[
  {
    "id": "U001",
    "name": "John Doe",
    "email": "john@email.com",
    "phone": "+1234567894",
    "rides": 25,
    "status": "active",
    "joined": "2023-01-15"
  }
]
```

### Suspend User
- **POST** `/api/users/:id/suspend`
- **Description**: Suspend a user
- **Response**:
```json
{
  "success": true,
  "message": "User suspended successfully"
}
```

### Delete User
- **DELETE** `/api/users/:id`
- **Description**: Delete a user
- **Response**:
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

## Analytics

### Analytics Overview
- **GET** `/api/analytics/overview`
- **Description**: Get analytics data
- **Response**:
```json
{
  "dailyRides": [45, 52, 38, 61, 49, 73, 68],
  "weeklyRevenue": [1250, 1380, 1150, 1420, 1290, 1650, 1580],
  "driverPerformance": [
    {
      "name": "Mike Johnson",
      "rides": 28,
      "rating": 4.8,
      "earnings": 850
    }
  ],
  "userGrowth": [2100, 2250, 2380, 2450, 2567]
}
```

## Settings

### Get Settings
- **GET** `/api/settings`
- **Description**: Get system settings
- **Response**:
```json
{
  "surgeMultiplier": 1.5,
  "baseFare": 2.50,
  "perKmRate": 1.20,
  "commissionRate": 0.15,
  "maxWaitTime": 300,
  "cancellationFee": 5.00
}
```

### Update Settings
- **POST** `/api/settings`
- **Description**: Update system settings
- **Body**:
```json
{
  "surgeMultiplier": 1.5,
  "baseFare": 2.50,
  "perKmRate": 1.20,
  "commissionRate": 0.15
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

## Maps Integration

### Geocode Address
- **POST** `/api/maps/geocode`
- **Description**: Convert address to coordinates
- **Body**:
```json
{
  "address": "123 Main St, City, State"
}
```

### Reverse Geocode
- **POST** `/api/maps/reverse-geocode`
- **Description**: Convert coordinates to address
- **Body**:
```json
{
  "lat": 40.7128,
  "lng": -74.0060
}
```

## Error Responses

### 404 Not Found
```json
{
  "error": "Route not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

### Database Connection Error
```json
{
  "error": "Database connection failed"
}
```

## Status Codes
- **200**: Success
- **400**: Bad Request
- **404**: Not Found
- **500**: Internal Server Error

## Notes
- All endpoints return JSON responses
- Database endpoints create tables automatically if they don't exist
- Maps endpoints require Google Maps API key
- Admin dashboard provides real-time data from PostgreSQL database