const express = require('express');
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create tables
const createTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
      rater_id UUID REFERENCES users(id) ON DELETE CASCADE,
      rated_id UUID REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      review TEXT,
      tip_amount DECIMAL(10, 2) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  
  await query(`
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      relationship VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  
  await query(`
    CREATE TABLE IF NOT EXISTS emergency_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      message TEXT,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  
  await query(`
    CREATE TABLE IF NOT EXISTS safety_settings (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      share_trip BOOLEAN DEFAULT TRUE,
      auto_share_contacts TEXT[],
      emergency_auto_call BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
};

// Submit rating
router.post('/ratings', authenticateToken, async (req, res) => {
  try {
    await createTables();
    
    const { ride_id, rated_user_id, rating, review, tip_amount } = req.body;
    
    const result = await query(`
      INSERT INTO ratings (ride_id, rater_id, rated_id, rating, review, tip_amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [ride_id, req.user.id, rated_user_id, rating, review, tip_amount || 0]);
    
    // Update user's average rating
    await query(`
      UPDATE users 
      SET rating = (
        SELECT AVG(rating) FROM ratings WHERE rated_id = $1
      )
      WHERE id = $1
    `, [rated_user_id]);
    
    res.json({ success: true, rating: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ratings
router.get('/ratings', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, u.full_name as rater_name
      FROM ratings r
      JOIN users u ON r.rater_id = u.id
      WHERE r.rated_id = $1
      ORDER BY r.created_at DESC
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver ratings
router.get('/ratings/driver/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    
    const result = await query(`
      SELECT r.*, u.full_name as rater_name
      FROM ratings r
      JOIN users u ON r.rater_id = u.id
      WHERE r.rated_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [driverId]);
    
    const avgResult = await query(
      'SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings FROM ratings WHERE rated_id = $1',
      [driverId]
    );
    
    res.json({
      ratings: result.rows,
      average_rating: parseFloat(avgResult.rows[0].average_rating) || 0,
      total_ratings: parseInt(avgResult.rows[0].total_ratings) || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get passenger ratings
router.get('/ratings/passenger/:passengerId', async (req, res) => {
  try {
    const { passengerId } = req.params;
    
    const result = await query(`
      SELECT r.*, u.full_name as rater_name
      FROM ratings r
      JOIN users u ON r.rater_id = u.id
      WHERE r.rated_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [passengerId]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get emergency contacts
router.get('/emergency/contacts', authenticateToken, async (req, res) => {
  try {
    await createTables();
    
    const result = await query(
      'SELECT * FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add emergency contact
router.post('/emergency/contacts', authenticateToken, async (req, res) => {
  try {
    const { name, phone_number, relationship } = req.body;
    
    const result = await query(`
      INSERT INTO emergency_contacts (user_id, name, phone_number, relationship)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.user.id, name, phone_number, relationship]);
    
    res.json({ success: true, contact: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete emergency contact
router.delete('/emergency/contacts/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    
    const result = await query(
      'DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2',
      [contactId, req.user.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger SOS
router.post('/emergency/sos', authenticateToken, async (req, res) => {
  try {
    const { ride_id, location, message } = req.body;
    
    const result = await query(`
      INSERT INTO emergency_alerts (user_id, ride_id, latitude, longitude, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.user.id, ride_id, location?.latitude, location?.longitude, message]);
    
    // TODO: Send alerts to emergency contacts and authorities
    
    res.json({ success: true, alert: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get safety settings
router.get('/safety/settings', authenticateToken, async (req, res) => {
  try {
    await query(`
      INSERT INTO safety_settings (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `, [req.user.id]);
    
    const result = await query(
      'SELECT * FROM safety_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update safety settings
router.put('/safety/settings', authenticateToken, async (req, res) => {
  try {
    const { share_trip, auto_share_contacts, emergency_auto_call } = req.body;
    
    const result = await query(`
      UPDATE safety_settings 
      SET share_trip = $1, auto_share_contacts = $2, emergency_auto_call = $3, updated_at = NOW()
      WHERE user_id = $4
      RETURNING *
    `, [share_trip, auto_share_contacts, emergency_auto_call, req.user.id]);
    
    res.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;