const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { DriverProfile, LocationUpdate, Notification } = require('../database/models');

class RealTimeService {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.connectedUsers = new Map(); // userId -> socketId
    this.driverLocations = new Map(); // driverId -> location
    this.activeRides = new Map(); // rideId -> { passengerId, driverId }
    
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 User connected: ${socket.id}`);

      // Authentication
      socket.on('authenticate', async (data) => {
        try {
          const { userId, userType, token } = data;
          
          socket.userId = userId;
          socket.userType = userType;
          this.connectedUsers.set(userId, socket.id);
          
          socket.join(`user_${userId}`);
          if (userType === 'driver') {
            socket.join('drivers');
          } else {
            socket.join('passengers');
          }
          
          console.log(`✅ User authenticated: ${userId} (${userType})`);
          socket.emit('authenticated', { success: true });
          
        } catch (error) {
          console.error('Authentication failed:', error);
          socket.emit('authentication_failed', { error: 'Invalid token' });
        }
      });

      // Driver location updates
      socket.on('driver_location_update', async (data) => {
        if (socket.userType !== 'driver') return;
        
        try {
          const { latitude, longitude, heading, speed } = data;
          
          this.driverLocations.set(socket.userId, {
            latitude,
            longitude,
            heading,
            speed,
            timestamp: Date.now()
          });
          
          socket.broadcast.emit('driver_location', {
            driverId: socket.userId,
            latitude,
            longitude,
            heading,
            speed
          });
          
        } catch (error) {
          console.error('Error updating driver location:', error);
        }
      });

      // Join ride room for real-time updates
      socket.on('join_ride', (rideId) => {
        socket.join(`ride_${rideId}`);
        console.log(`👥 User ${socket.userId} joined ride ${rideId}`);
      });

      // Disconnect handler
      socket.on('disconnect', () => {
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
        }
        console.log(`🔌 User disconnected: ${socket.id}`);
      });
    });
  }

  emitNewRide(rideData, nearbyDrivers) {
    nearbyDrivers.forEach(driver => {
      const socketId = this.connectedUsers.get(driver.user_id);
      if (socketId) {
        this.io.to(socketId).emit('new_ride_available', rideData);
      }
    });
  }

  emitNewBid(rideId, bidData) {
    this.io.to(`ride_${rideId}`).emit('new_bid', bidData);
  }

  emitRideStatusUpdate(rideId, status, data = {}) {
    this.io.to(`ride_${rideId}`).emit('ride_status_update', {
      rideId,
      status,
      ...data,
      timestamp: Date.now()
    });
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
}

module.exports = RealTimeService;