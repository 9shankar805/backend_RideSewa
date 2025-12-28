// Missing API endpoints that need to be added to backend

// 1. API Status endpoint (referenced in frontend)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      websocket: 'active',
      redis: 'connected'
    }
  });
});

// 2. User profile endpoints
app.get('/api/users/profile', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.put('/api/users/profile', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { full_name, email } = req.body;
    const result = await query(
      'UPDATE users SET full_name = $1, email = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [full_name, email, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// 3. Places/Autocomplete endpoints
app.post('/api/maps/autocomplete', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { input, location, radius } = req.body;
    const result = await mapsService.getPlaceAutocomplete(input, location, radius);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

app.post('/api/maps/place-details', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { placeId } = req.body;
    const result = await mapsService.getPlaceDetails(placeId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// 4. Saved places endpoints
app.get('/api/places', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const result = await query('SELECT * FROM saved_places WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.post('/api/places', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { name, address, latitude, longitude, type } = req.body;
    const result = await query(
      'INSERT INTO saved_places (user_id, name, address, latitude, longitude, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, name, address, latitude, longitude, type]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// 5. Driver earnings endpoints
app.get('/api/drivers/earnings', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const result = await query(
      'SELECT SUM(final_fare) as total_earnings, COUNT(*) as total_rides FROM rides WHERE driver_id = $1 AND status = $2',
      [req.user.id, 'completed']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// 6. Trip history endpoints
app.get('/api/drivers/trips', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM rides WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

app.get('/api/passengers/trips', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM rides WHERE passenger_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Add these to your server.js file