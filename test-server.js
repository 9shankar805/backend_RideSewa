const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');

// Simple test server without external dependencies
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'admin-dashboard')));

// Test database connection (mock)
const testConnection = async () => {
  console.log('✅ Database connection test: OK (mocked)');
};

// Basic routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'InDrive Backend is running!'
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    features: [
      'Google Maps Integration',
      'Real-time WebSocket',
      'Admin Dashboard',
      'Security Middleware',
      'Caching System'
    ]
  });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard', 'index.html'));
});

// Test database connection on startup
testConnection();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 InDrive Test Server running on port ${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
  console.log('✅ Basic server functionality: Working');
});

module.exports = server;