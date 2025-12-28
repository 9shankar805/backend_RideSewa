const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import middleware
const { googleAuth } = require('./middleware/googleAuth');
const { authenticateToken } = require('./middleware/auth');
const { validateRequest, schemas } = require('./middleware/validation');
const { authLimiter, apiLimiter, rideLimiter, securityHeaders, corsOptions } = require('./middleware/security');
const { errorHandler, notFound, asyncHandler } = require('./middleware/errorHandler');
const { requestLogger, errorLogger } = require('./middleware/logging');
const { cacheAnalytics, cacheDrivers, cacheRides, cacheUser, invalidateCache } = require('./middleware/cache');
const { httpsOnly, createAdvancedRateLimit, bruteForce, apiKeyAuth, secureSession, csrfProtection, sanitizeInput, auditLogger, speedLimiter } = require('./middleware/enhancedSecurity');

// Import services
const PaymentService = require('./services/paymentService');
const MapsService = require('./services/mapsService');
const NotificationService = require('./services/notificationService');
const FileService = require('./services/fileService');
const AdvancedRideService = require('./services/advancedRideService');
const AnalyticsService = require('./services/analyticsService');
const CommunicationService = require('./services/communicationService');
const DriverVerificationService = require('./services/driverVerificationService');
const AdvancedFeaturesService = require('./services/advancedFeaturesService');
const AdminService = require('./services/adminService');
const ComplianceService = require('./services/complianceService');
const cacheService = require('./services/cacheService');
const securityService = require('./services/securityService');
const logger = require('./services/loggerService');

// Import database and services
const { testConnection, query } = require('./database/connection');
const { User, DriverProfile, Ride, Bid, Notification } = require('./database/models');
const RealTimeService = require('./services/realTimeService');
const RideMatchingService = require('./services/rideMatchingService');

const app = express();
const server = http.createServer(app);

// Initialize services (single initialization)
const realTimeService = new RealTimeService(server);
const rideMatchingService = new RideMatchingService(realTimeService);
const mapsService = new MapsService();
const notificationService = new NotificationService();
const fileService = new FileService();
const advancedRideService = new AdvancedRideService();
const analyticsService = new AnalyticsService();
const communicationService = new CommunicationService();
const driverVerificationService = new DriverVerificationService();
const advancedFeaturesService = new AdvancedFeaturesService();
const adminService = new AdminService();
const complianceService = new ComplianceService();

// Enhanced security middleware
app.use(httpsOnly);
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'admin-dashboard')));

// Security enhancements
app.use(sanitizeInput);
app.use(speedLimiter);
app.use(auditLogger);
app.use(secureSession);

// Logging middleware
app.use(requestLogger);

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/auth/login', bruteForce.prevent);
app.use('/api', apiLimiter);

// Test database connection on startup
testConnection();

// Real-time service handles all socket connections

// API Routes

// Dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await rideMatchingService.getRideStats();
    res.json({
      ...stats,
      activeConnections: realTimeService.getConnectedUsersCount()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User registration
app.post('/api/users/register', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Google OAuth login
app.post('/api/auth/google', validateRequest(schemas.googleAuth), asyncHandler(googleAuth));

// Payment webhook
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    await PaymentService.handleWebhook(event);
    res.json({received: true});
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}));

// Create ride request with maps integration
app.post('/api/rides', authenticateToken, rideLimiter, validateRequest(schemas.createRide), asyncHandler(async (req, res) => {
  try {
    // Calculate route and fare
    const routeInfo = await mapsService.calculateRoute(
      { lat: req.body.pickup_latitude, lng: req.body.pickup_longitude },
      { lat: req.body.destination_latitude, lng: req.body.destination_longitude }
    );
    
    const estimatedFare = mapsService.estimateFare(routeInfo.distance);
    
    const rideData = {
      ...req.body,
      passenger_id: req.user.id,
      distance_km: routeInfo.distance,
      estimated_duration_minutes: routeInfo.duration,
      estimated_fare: estimatedFare
    };
    
    const result = await rideMatchingService.createRideRequest(rideData);
    res.json({ success: true, ...result, routeInfo });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Process ride payment
app.post('/api/rides/:rideId/payment', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { rideId } = req.params;
    const { amount, paymentMethod } = req.body;
    
    const result = await PaymentService.processRidePayment(rideId, amount, paymentMethod);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// User login
app.post('/api/users/login', async (req, res) => {
  try {
    const { phone_number } = req.body;
    const user = await User.findByPhone(phone_number);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Driver registration
app.post('/api/drivers/register', async (req, res) => {
  try {
    const { userData, driverData } = req.body;
    
    // Create user first
    const user = await User.create({ ...userData, user_type: 'driver' });
    
    // Create driver profile
    const driverProfile = await DriverProfile.create({
      ...driverData,
      user_id: user.id
    });
    
    res.json({ success: true, user, driverProfile });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create ride request
app.post('/api/rides', async (req, res) => {
  try {
    const result = await rideMatchingService.createRideRequest(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get rides
app.get('/api/rides', async (req, res) => {
  try {
    const result = await query('SELECT * FROM rides ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Driver status update
app.post('/api/drivers/status', async (req, res) => {
  try {
    const { userId, isOnline, isAvailable } = req.body;
    await DriverProfile.updateStatus(userId, isOnline, isAvailable);
    res.json({ success: true, isOnline, isAvailable });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get available rides for drivers
app.get('/api/rides/available', async (req, res) => {
  try {
    const result = await query("SELECT * FROM rides WHERE status = 'searching' ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find nearby drivers
app.post('/api/drivers/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 10 } = req.body;
    const result = await query(`
      SELECT dp.*, u.full_name, u.rating 
      FROM driver_profiles dp
      JOIN users u ON dp.user_id = u.id
      WHERE dp.is_online = true AND dp.is_available = true
      AND dp.current_latitude IS NOT NULL AND dp.current_longitude IS NOT NULL
      ORDER BY dp.last_location_update DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver location with validation
app.post('/api/drivers/location', authenticateToken, validateRequest(schemas.driverLocation), asyncHandler(async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    await DriverProfile.updateLocation(req.user.id, latitude, longitude);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Bid submission with validation
app.post('/api/rides/:rideId/bid', authenticateToken, validateRequest(schemas.submitBid), asyncHandler(async (req, res) => {
  try {
    const { rideId } = req.params;
    const bidData = {
      ride_id: rideId,
      driver_id: req.user.id,
      proposed_fare: req.body.proposedFare,
      estimated_arrival_minutes: req.body.eta,
      message: req.body.message
    };
    
    const bid = await rideMatchingService.submitBid(bidData);
    res.json({ success: true, bid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// File upload endpoints
const upload = fileService.getMulterConfig();

// Upload profile image
app.post('/api/users/upload-avatar', authenticateToken, upload.single('avatar'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await fileService.uploadProfileImage(req.file, req.user.id);
    
    // Update user profile
    await query('UPDATE users SET profile_image_url = $1 WHERE id = $2', [result.url, req.user.id]);
    
    res.json({ success: true, imageUrl: result.url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Upload driver documents
app.post('/api/drivers/upload-document', authenticateToken, upload.single('document'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { documentType } = req.body;
    const allowedTypes = ['license', 'insurance', 'vehicle_registration', 'vehicle_image'];
    
    if (!allowedTypes.includes(documentType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    const result = await fileService.uploadDriverDocument(req.file, req.user.id, documentType);
    
    // Update driver profile
    const updateField = `${documentType}_image_url`;
    await query(`UPDATE driver_profiles SET ${updateField} = $1 WHERE user_id = $2`, [result.url, req.user.id]);
    
    res.json({ success: true, documentUrl: result.url, documentType });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Create scheduled ride
app.post('/api/rides/scheduled', authenticateToken, rideLimiter, asyncHandler(async (req, res) => {
  try {
    const { scheduledTime, ...rideData } = req.body;
    const ride = await advancedRideService.createScheduledRide(
      { ...rideData, passenger_id: req.user.id },
      new Date(scheduledTime)
    );
    
    res.json({ success: true, ride });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Create multi-stop ride
app.post('/api/rides/multi-stop', authenticateToken, rideLimiter, asyncHandler(async (req, res) => {
  try {
    const { stops, ...rideData } = req.body;
    const result = await advancedRideService.createMultiStopRide(
      { ...rideData, passenger_id: req.user.id },
      stops
    );
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Create shared ride
app.post('/api/rides/shared', authenticateToken, rideLimiter, asyncHandler(async (req, res) => {
  try {
    const { maxPassengers, ...rideData } = req.body;
    const ride = await advancedRideService.createSharedRide(
      { ...rideData, passenger_id: req.user.id },
      maxPassengers
    );
    
    res.json({ success: true, ride });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Find nearby shared rides
app.post('/api/rides/shared/nearby', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { pickup, destination } = req.body;
    const rides = await advancedRideService.findNearbySharedRides(pickup, destination);
    res.json(rides);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Join shared ride
app.post('/api/rides/:rideId/join', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { rideId } = req.params;
    const result = await advancedRideService.joinSharedRide(rideId, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Send notification
app.post('/api/notifications/send', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;
    await notificationService.sendToUser(userId, { title, body }, data);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Get user notifications
app.get('/api/notifications', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const result = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Geocoding endpoint
app.post('/api/maps/geocode', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { address } = req.body;
    const result = await mapsService.geocodeAddress(address);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Reverse geocoding endpoint
app.post('/api/maps/reverse-geocode', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const address = await mapsService.reverseGeocode(lat, lng);
    res.json({ address });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Update driver location
app.post('/api/drivers/location', async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.body;
    await DriverProfile.updateLocation(userId, latitude, longitude);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Bid submission endpoint
app.post('/api/rides/:rideId/bid', async (req, res) => {
  try {
    const { rideId } = req.params;
    const bidData = {
      ride_id: rideId,
      driver_id: req.body.driverId,
      proposed_fare: req.body.proposedFare,
      estimated_arrival_minutes: req.body.eta,
      message: req.body.message
    };
    
    const bid = await rideMatchingService.submitBid(bidData);
    res.json({ success: true, bid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get bids for a ride
app.get('/api/rides/:rideId/bids', async (req, res) => {
  try {
    const { rideId } = req.params;
    const bids = await rideMatchingService.getRideBids(rideId);
    res.json(bids);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept a bid
app.post('/api/rides/:rideId/accept', async (req, res) => {
  try {
    const { rideId } = req.params;
    const { bidId, passengerId } = req.body;
    
    const result = await rideMatchingService.acceptBid(rideId, bidId, passengerId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start ride
app.post('/api/rides/:rideId/start', async (req, res) => {
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;
    
    const result = await rideMatchingService.startRide(rideId, driverId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Complete ride
app.post('/api/rides/:rideId/complete', async (req, res) => {
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;
    
    const result = await rideMatchingService.completeRide(rideId, driverId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Cancel ride
app.post('/api/rides/:rideId/cancel', async (req, res) => {
  try {
    const { rideId } = req.params;
    const { userId, reason } = req.body;
    
    const result = await rideMatchingService.cancelRide(rideId, userId, reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Analytics endpoints
app.get('/api/analytics/driver-earnings/:driverId', authenticateToken, cacheAnalytics, asyncHandler(async (req, res) => {
  try {
    const { driverId } = req.params;
    const { period = 'week' } = req.query;
    const earnings = await analyticsService.getDriverEarnings(driverId, period);
    res.json(earnings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.get('/api/analytics/rides', authenticateToken, cacheAnalytics, asyncHandler(async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const analytics = await analyticsService.getRideAnalytics(period);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.get('/api/analytics/performance', authenticateToken, cacheAnalytics, asyncHandler(async (req, res) => {
  try {
    const metrics = await analyticsService.getPerformanceMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.get('/api/analytics/revenue', authenticateToken, cacheAnalytics, asyncHandler(async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const revenue = await analyticsService.getRevenueAnalytics(period);
    res.json(revenue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Communication endpoints
app.post('/api/communication/sms', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    const result = await communicationService.sendSMS(phoneNumber, message);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.post('/api/communication/email', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    const result = await communicationService.sendEmail(to, subject, html);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.post('/api/support/ticket', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { subject, message, priority } = req.body;
    const result = await communicationService.createSupportTicket(req.user.id, subject, message, priority);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.post('/api/messages/send', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { toUserId, message, rideId } = req.body;
    const result = await communicationService.sendInAppMessage(req.user.id, toUserId, message, rideId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/messages/ride/:rideId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { rideId } = req.params;
    const messages = await communicationService.getRideMessages(rideId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Driver verification endpoints
app.post('/api/drivers/apply', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const result = await driverVerificationService.submitDriverApplication(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.post('/api/admin/drivers/review/:applicationId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { decision, notes } = req.body;
    const result = await driverVerificationService.reviewDriverApplication(applicationId, req.user.id, decision, notes);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/admin/drivers/applications', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { status, limit } = req.query;
    const applications = await driverVerificationService.getDriverApplications(status, limit);
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.post('/api/drivers/background-check', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { checkType } = req.body;
    const result = await driverVerificationService.performBackgroundCheck(req.user.id, checkType);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.post('/api/drivers/schedule-inspection', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { inspectionDate, location } = req.body;
    const result = await driverVerificationService.scheduleVehicleInspection(req.user.id, inspectionDate, location);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Security & Compliance endpoints
app.post('/api/security/api-keys', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { name, permissions } = req.body;
    const result = await securityService.generateApiKey(req.user.id, name, permissions);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.delete('/api/security/api-keys/:keyId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { keyId } = req.params;
    const result = await securityService.revokeApiKey(keyId, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// GDPR Compliance endpoints
app.post('/api/compliance/consent', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { consentType, granted } = req.body;
    const result = await complianceService.recordConsent(
      req.user.id, 
      consentType, 
      granted, 
      req.ip, 
      req.get('User-Agent')
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/compliance/consent', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const consents = await complianceService.getConsentStatus(req.user.id);
    res.json(consents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.get('/api/compliance/export-data', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const data = await complianceService.exportUserData(req.user.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${req.user.id}.json"`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.delete('/api/compliance/delete-data', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await complianceService.deleteUserData(req.user.id, reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/compliance/privacy-policy', asyncHandler(async (req, res) => {
  try {
    const { version } = req.query;
    const policy = await complianceService.getPrivacyPolicy(version);
    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.get('/api/compliance/terms-of-service', asyncHandler(async (req, res) => {
  try {
    const { version } = req.query;
    const terms = await complianceService.getTermsOfService(version);
    res.json(terms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Admin compliance endpoints
app.post('/api/admin/compliance/privacy-policy', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { content, version } = req.body;
    const result = await complianceService.updatePrivacyPolicy(content, version, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/admin/compliance/report', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await complianceService.generateComplianceReport(startDate, endDate);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.post('/api/admin/compliance/data-breach', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { description, affectedUsers, severity } = req.body;
    const result = await complianceService.reportDataBreach(description, affectedUsers, severity, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Advanced features endpoints
app.get('/api/rides/history', authenticateToken, cacheUser, asyncHandler(async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const history = await advancedFeaturesService.getRideHistory(req.user.id, limit, offset);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.get('/api/rides/:rideId/receipt', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { rideId } = req.params;
    const receipt = await advancedFeaturesService.generateRideReceipt(rideId);
    res.json(receipt);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.post('/api/favorites/locations', authenticateToken, invalidateCache([req => `favorites:${req.user.id}`]), asyncHandler(async (req, res) => {
  try {
    const { name, address, latitude, longitude, type } = req.body;
    const result = await advancedFeaturesService.addFavoriteLocation(req.user.id, name, address, latitude, longitude, type);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/favorites/locations', authenticateToken, cacheUser, asyncHandler(async (req, res) => {
  try {
    const favorites = await advancedFeaturesService.getFavoriteLocations(req.user.id);
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.post('/api/drivers/preferences', authenticateToken, invalidateCache([req => `driver_prefs:${req.user.id}`]), asyncHandler(async (req, res) => {
  try {
    const result = await advancedFeaturesService.setDriverPreferences(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/drivers/preferences', authenticateToken, cacheUser, asyncHandler(async (req, res) => {
  try {
    const preferences = await advancedFeaturesService.getDriverPreferences(req.user.id);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.post('/api/pricing/surge', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { baseFare, location, timeOfDay } = req.body;
    const pricing = await advancedFeaturesService.calculateSurgePrice(baseFare, location, timeOfDay);
    res.json(pricing);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/loyalty/status', authenticateToken, cacheUser, asyncHandler(async (req, res) => {
  try {
    const status = await advancedFeaturesService.getLoyaltyStatus(req.user.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.post('/api/referral/create', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const result = await advancedFeaturesService.createReferralCode(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.post('/api/referral/process', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { referralCode } = req.body;
    const result = await advancedFeaturesService.processReferral(req.user.id, referralCode);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// Admin endpoints
app.get('/api/admin/dashboard', authenticateToken, cacheAnalytics, asyncHandler(async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.get('/api/admin/users', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, userType, status } = req.query;
    const users = await adminService.getUserManagement(page, limit, userType, status);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.put('/api/admin/users/:userId/status', authenticateToken, invalidateCache([req => `user:${req.params.userId}`]), asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, reason } = req.body;
    const result = await adminService.updateUserStatus(userId, isActive, reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.get('/api/admin/financial-reports', authenticateToken, cacheAnalytics, asyncHandler(async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const reports = await adminService.getFinancialReports(period);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Enhanced health check with detailed metrics
app.get('/health', asyncHandler(async (req, res) => {
  try {
    // Simple health check without analytics
    const dbTest = await query('SELECT 1 as test');
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      connections: realTimeService.getConnectedUsersCount(),
      database: dbTest.rows.length > 0 ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}));

// Admin dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    connections: realTimeService.getConnectedUsersCount()
  });
});

// Error handling middleware
app.use(errorLogger);
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`InDrive Clone Server started on port ${PORT}`);
  console.log(`🚀 InDrive Clone Server running on port ${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket Server: Ready for real-time connections`);
  console.log(`🔒 Security: Rate limiting and validation enabled`);
  console.log(`💳 Payments: Stripe integration ready`);
  console.log(`🗺️  Maps: Google Maps API integrated`);
  console.log(`🔔 Notifications: Firebase Cloud Messaging ready`);
  console.log(`📁 File Upload: AWS S3 integration ready`);
  console.log(`🚗 Advanced Rides: Scheduled, Multi-stop, Shared rides enabled`);
  console.log(`📊 Analytics: Driver earnings and ride analytics ready`);
  console.log(`💬 Communication: SMS, Email, In-app messaging enabled`);
  console.log(`🔍 Verification: Driver background checks and document verification`);
  console.log(`🚀 Performance: Redis caching and API optimization enabled`);
  console.log(`🏆 Advanced Features: Loyalty program, referrals, surge pricing`);
  console.log(`🔧 Admin Tools: User management, financial reports, system config`);
  console.log(`🔐 Security: Enhanced security, encryption, audit logging`);
  console.log(`📜 Compliance: GDPR compliance, data privacy, consent management`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});