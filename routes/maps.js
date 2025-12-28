const express = require('express');
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const MapsService = require('../services/mapsService');

const router = express.Router();
const mapsService = new MapsService();

// Address autocomplete
router.post('/autocomplete', authenticateToken, async (req, res) => {
  try {
    const { input, location, radius } = req.body;
    const result = await mapsService.autocomplete(input, location, radius);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Place details
router.post('/place-details', authenticateToken, async (req, res) => {
  try {
    const { place_id } = req.body;
    const result = await mapsService.getPlaceDetails(place_id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Directions
router.post('/directions', authenticateToken, async (req, res) => {
  try {
    const { origin, destination, waypoints } = req.body;
    const result = await mapsService.getDirections(origin, destination, waypoints);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get saved places
router.get('/places', authenticateToken, async (req, res) => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS saved_places (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        type VARCHAR(50) DEFAULT 'other',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    const result = await query(
      'SELECT * FROM saved_places WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add saved place
router.post('/places', authenticateToken, async (req, res) => {
  try {
    const { name, address, latitude, longitude, type } = req.body;
    
    const result = await query(`
      INSERT INTO saved_places (user_id, name, address, latitude, longitude, type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.user.id, name, address, latitude, longitude, type || 'other']);
    
    res.json({ success: true, place: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update saved place
router.put('/places/:placeId', authenticateToken, async (req, res) => {
  try {
    const { placeId } = req.params;
    const { name, address, latitude, longitude, type } = req.body;
    
    const result = await query(`
      UPDATE saved_places 
      SET name = $1, address = $2, latitude = $3, longitude = $4, type = $5
      WHERE id = $6 AND user_id = $7
      RETURNING *
    `, [name, address, latitude, longitude, type, placeId, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }
    
    res.json({ success: true, place: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete saved place
router.delete('/places/:placeId', authenticateToken, async (req, res) => {
  try {
    const { placeId } = req.params;
    
    const result = await query(
      'DELETE FROM saved_places WHERE id = $1 AND user_id = $2',
      [placeId, req.user.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }
    
    res.json({ success: true, message: 'Place deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;