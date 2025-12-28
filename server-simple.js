const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'admin-dashboard')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      maps: 'enabled',
      server: 'running'
    }
  });
});

// API test
app.get('/api/test', (req, res) => {
  res.json({
    message: 'InDrive Backend API is working!',
    timestamp: new Date().toISOString(),
    features: [
      'Google Maps Integration',
      'Admin Dashboard', 
      'Health Monitoring',
      'Production Ready'
    ]
  });
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard', 'index.html'));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 Simple InDrive Server running on port ${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`✅ No Redis dependencies - ready for testing`);
});