const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// In-memory data store
const data = {
  users: [],
  drivers: [],
  rides: [],
  bids: [],
  activeConnections: 0
};

// Socket.io connection handling
io.on('connection', (socket) => {
  data.activeConnections++;
  console.log('✅ User connected:', socket.id);
  
  socket.on('disconnect', () => {
    data.activeConnections--;
    console.log('❌ User disconnected:', socket.id);
  });

  socket.on('authenticate', (userData) => {
    socket.userId = userData.userId;
    socket.userType = userData.userType;
    console.log(`🔐 User authenticated: ${userData.userId} (${userData.userType})`);
    socket.emit('authenticated', { success: true });
  });

  socket.on('join_ride', (rideId) => {
    socket.join(`ride_${rideId}`);
    console.log(`👥 User joined ride: ${rideId}`);
  });
});

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    connections: data.activeConnections
  });
});

app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    totalUsers: data.users.length,
    totalDrivers: data.drivers.length,
    totalRides: data.rides.length,
    activeConnections: data.activeConnections
  });
});

app.post('/api/users/register', (req, res) => {
  const user = {
    id: `user_${Date.now()}`,
    ...req.body,
    created_at: new Date()
  };
  data.users.push(user);
  res.json({ success: true, user });
});

app.post('/api/users/login', (req, res) => {
  const { phone_number } = req.body;
  let user = data.users.find(u => u.phone_number === phone_number);
  
  if (!user) {
    user = {
      id: `user_${Date.now()}`,
      phone_number,
      full_name: 'Test User',
      user_type: 'passenger',
      created_at: new Date()
    };
    data.users.push(user);
  }
  
  res.json({ success: true, user });
});

app.post('/api/rides', (req, res) => {
  const ride = {
    id: `ride_${Date.now()}`,
    ...req.body,
    status: 'searching',
    created_at: new Date()
  };
  data.rides.push(ride);
  
  // Emit to nearby drivers
  io.emit('new_ride_available', ride);
  
  res.json({ 
    success: true, 
    ride,
    nearbyDriversCount: 3,
    nearbyDrivers: [
      { id: 'driver1', latitude: 27.7172, longitude: 85.3240 },
      { id: 'driver2', latitude: 27.7180, longitude: 85.3250 },
      { id: 'driver3', latitude: 27.7160, longitude: 85.3230 }
    ]
  });
});

app.get('/api/rides', (req, res) => {
  res.json(data.rides);
});

app.get('/api/rides/available', (req, res) => {
  const availableRides = data.rides.filter(r => r.status === 'searching' || r.status === 'bidding');
  res.json(availableRides);
});

app.post('/api/rides/:rideId/bid', (req, res) => {
  const { rideId } = req.params;
  const { driverId, proposedFare, eta, message } = req.body;
  
  const bid = {
    id: `bid_${Date.now()}`,
    rideId,
    driverId,
    driverName: 'Test Driver',
    driverRating: 4.5,
    vehicleModel: 'Toyota Corolla',
    vehicleColor: 'White',
    vehiclePlate: 'BA 1 PA 1234',
    proposedFare,
    eta,
    message,
    status: 'pending',
    created_at: new Date()
  };
  
  data.bids.push(bid);
  
  // Update ride status
  const rideIndex = data.rides.findIndex(r => r.id === rideId);
  if (rideIndex >= 0) {
    data.rides[rideIndex].status = 'bidding';
  }
  
  // Emit to passenger
  io.to(`ride_${rideId}`).emit('new_bid', bid);
  
  console.log(`💰 New bid: ${bid.driverName} offered NPR ${proposedFare} for ride ${rideId}`);
  
  res.json({ success: true, bid });
});

app.get('/api/rides/:rideId/bids', (req, res) => {
  const { rideId } = req.params;
  const rideBids = data.bids.filter(b => b.rideId === rideId && b.status === 'pending');
  res.json(rideBids);
});

app.post('/api/rides/:rideId/accept', (req, res) => {
  const { rideId } = req.params;
  const { bidId, passengerId } = req.body;
  
  // Update ride status
  const rideIndex = data.rides.findIndex(r => r.id === rideId);
  if (rideIndex >= 0) {
    data.rides[rideIndex].status = 'accepted';
  }
  
  // Update bid status
  const bidIndex = data.bids.findIndex(b => b.id === bidId);
  if (bidIndex >= 0) {
    data.bids[bidIndex].status = 'accepted';
  }
  
  // Reject other bids
  data.bids.forEach(bid => {
    if (bid.rideId === rideId && bid.id !== bidId) {
      bid.status = 'rejected';
    }
  });
  
  console.log(`✅ Bid ${bidId} accepted for ride ${rideId}`);
  
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 InDrive Clone Server running on port ${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket Server: Ready for real-time connections`);
});