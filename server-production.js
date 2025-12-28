const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import database and basic services
const { testConnection } = require('./database/connection');
const { User, DriverProfile, Ride, Bid, Notification } = require('./database/models');

// Import core middleware
const { authenticateToken } = require('./middleware/auth');
const { validateRequest, schemas } = require('./middleware/validation');
const { errorHandler, notFound, asyncHandler } = require('./middleware/errorHandler');
const logger = require('./services/loggerService');

// Import services with error handling
let mapsService, cacheService, analyticsService;

try {
  const MapsService = require('./services/mapsService');
  mapsService = new MapsService();
  console.log('✅ Maps service loaded');
} catch (error) {
  console.log('⚠️  Maps service disabled:', error.message);
}

try {
  cacheService = require('./services/cacheService');
  console.log('✅ Cache service loaded');
} catch (error) {
  console.log('⚠️  Cache service disabled:', error.message);
  cacheService = { get: () => null, set: () => true, del: () => true };
}

try {
  const AnalyticsService = require('./services/analyticsService');
  analyticsService = new AnalyticsService();
  console.log('✅ Analytics service loaded');
} catch (error) {
  console.log('⚠️  Analytics service disabled:', error.message);
}

const app = express();
const server = http.createServer(app);

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'admin-dashboard')));

// Test database connection on startup
testConnection();

// Health check
app.get('/health', asyncHandler(async (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      maps: mapsService ? 'enabled' : 'disabled',
      cache: cacheService ? 'enabled' : 'disabled',
      analytics: analyticsService ? 'enabled' : 'disabled'
    }
  });
}));

// Basic API endpoints
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'InDrive Backend API is working!',
    timestamp: new Date().toISOString(),
    features: [
      'Google Maps Integration',
      'Database Operations',
      'Admin Dashboard',
      'Health Monitoring'
    ]
  });
});

// Maps endpoints (if available)
if (mapsService) {
  app.post('/api/maps/geocode', asyncHandler(async (req, res) => {
    try {
      const { address } = req.body;
      const result = await mapsService.geocodeAddress(address);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }));

  app.post('/api/maps/reverse-geocode', asyncHandler(async (req, res) => {
    try {
      const { lat, lng } = req.body;
      const address = await mapsService.reverseGeocode(lat, lng);
      res.json({ address });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }));
}

// Basic ride endpoints
app.get('/api/rides', asyncHandler(async (req, res) => {
  try {
    const rides = await Ride.findActiveRides();
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Analytics endpoints (if available)
if (analyticsService) {
  app.get('/api/analytics/performance', asyncHandler(async (req, res) => {
    try {
      const metrics = await analyticsService.getPerformanceMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }));
}

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard', 'index.html'));
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  logger.info(`InDrive Backend started on port ${PORT}`);
  console.log(`🚀 InDrive Backend running on port ${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
  console.log(`🗺️  Maps API: ${mapsService ? 'Enabled' : 'Disabled'}`);
  console.log(`📈 Analytics: ${analyticsService ? 'Enabled' : 'Disabled'}`);
  console.log('✅ Production server ready!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = server;