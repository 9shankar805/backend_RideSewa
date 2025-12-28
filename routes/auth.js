const express = require('express');
const { query } = require('../database/connection');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Email/Password Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, phone_number, user_type = 'passenger' } = req.body;
    
    // Validate required fields
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }
    
    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await query(`
      INSERT INTO users (email, password_hash, full_name, phone_number, user_type, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, full_name, phone_number, user_type, created_at
    `, [email, hashedPassword, full_name, phone_number, user_type, true]);
    
    const user = result.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      user,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email/Password Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Remove password from response
    delete user.password_hash;
    
    res.json({
      success: true,
      user,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Phone verification - Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { phone_number } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in database (expires in 5 minutes)
    await query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        phone_number VARCHAR(20) PRIMARY KEY,
        otp VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    await query(`
      INSERT INTO otp_verifications (phone_number, otp, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
      ON CONFLICT (phone_number) 
      DO UPDATE SET otp = $2, expires_at = NOW() + INTERVAL '5 minutes'
    `, [phone_number, otp]);
    
    console.log(`OTP for ${phone_number}: ${otp}`);
    
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone_number, otp } = req.body;
    
    const result = await query(`
      SELECT * FROM otp_verifications 
      WHERE phone_number = $1 AND otp = $2 AND expires_at > NOW()
    `, [phone_number, otp]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
    await query('DELETE FROM otp_verifications WHERE phone_number = $1', [phone_number]);
    
    res.json({ success: true, verified: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh token
router.post('/refresh-token', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);
    const user = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const newToken = jwt.sign(
      { id: user.rows[0].id, phone_number: user.rows[0].phone_number },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Update user role
router.put('/update-role', authenticateToken, async (req, res) => {
  try {
    const { user_type } = req.body;
    const userId = req.user.id;
    
    // Validate user_type
    if (!['passenger', 'driver', 'both'].includes(user_type)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }
    
    // Update user role
    const result = await query(`
      UPDATE users 
      SET user_type = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, full_name, phone_number, user_type, updated_at
    `, [user_type, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;