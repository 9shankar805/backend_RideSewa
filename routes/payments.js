const express = require('express');
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create wallet and payment tables
const createTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS wallets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      balance DECIMAL(10, 2) DEFAULT 0.00,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  
  await query(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(10, 2) NOT NULL,
      type VARCHAR(20) NOT NULL,
      description TEXT,
      reference_id UUID,
      balance_after DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  
  await query(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      card_last_four VARCHAR(4),
      card_brand VARCHAR(20),
      is_default BOOLEAN DEFAULT FALSE,
      stripe_payment_method_id VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  
  await query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) UNIQUE NOT NULL,
      discount_type VARCHAR(20) NOT NULL,
      discount_value DECIMAL(10, 2) NOT NULL,
      min_amount DECIMAL(10, 2) DEFAULT 0,
      max_uses INTEGER DEFAULT 1,
      used_count INTEGER DEFAULT 0,
      expires_at TIMESTAMP WITH TIME ZONE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
};

// Get wallet balance
router.get('/wallet', authenticateToken, async (req, res) => {
  try {
    await createTables();
    
    // Create wallet if doesn't exist
    await query(`
      INSERT INTO wallets (user_id, balance)
      VALUES ($1, 0.00)
      ON CONFLICT (user_id) DO NOTHING
    `, [req.user.id]);
    
    const result = await query('SELECT * FROM wallets WHERE user_id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add money to wallet
router.post('/wallet/add', authenticateToken, async (req, res) => {
  try {
    const { amount, payment_method_id } = req.body;
    
    // Update wallet balance
    const result = await query(`
      UPDATE wallets 
      SET balance = balance + $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING *
    `, [amount, req.user.id]);
    
    // Record transaction
    await query(`
      INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after)
      VALUES ($1, $2, 'credit', 'Money added to wallet', $3)
    `, [req.user.id, amount, result.rows[0].balance]);
    
    res.json({ success: true, wallet: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get wallet transactions
router.get('/wallet/transactions', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await query(`
      SELECT * FROM wallet_transactions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment methods
router.get('/payments/methods', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM payment_methods WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add payment method
router.post('/payments/methods', authenticateToken, async (req, res) => {
  try {
    const { type, card_number, expiry_month, expiry_year, cvv, cardholder_name } = req.body;
    
    // In real app, integrate with Stripe to create payment method
    const result = await query(`
      INSERT INTO payment_methods (user_id, type, card_last_four, card_brand)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.user.id, type, card_number?.slice(-4), 'visa']);
    
    res.json({ success: true, payment_method: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete payment method
router.delete('/payments/methods/:methodId', authenticateToken, async (req, res) => {
  try {
    const { methodId } = req.params;
    
    const result = await query(
      'DELETE FROM payment_methods WHERE id = $1 AND user_id = $2',
      [methodId, req.user.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Payment method not found' });
    }
    
    res.json({ success: true, message: 'Payment method deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process payment
router.post('/payments/process', authenticateToken, async (req, res) => {
  try {
    const { amount, payment_method_id, ride_id } = req.body;
    
    // In real app, process payment with Stripe
    res.json({ 
      success: true, 
      payment_id: 'pay_' + Math.random().toString(36).substr(2, 9),
      status: 'succeeded'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get promo codes
router.get('/promo-codes', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT code, discount_type, discount_value, min_amount, expires_at
      FROM promo_codes 
      WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
      AND used_count < max_uses
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply promo code
router.post('/promo-codes/apply', authenticateToken, async (req, res) => {
  try {
    const { code, ride_id } = req.body;
    
    const result = await query(`
      SELECT * FROM promo_codes 
      WHERE code = $1 AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > NOW())
      AND used_count < max_uses
    `, [code]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired promo code' });
    }
    
    const promoCode = result.rows[0];
    
    // Update usage count
    await query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [promoCode.id]);
    
    res.json({ 
      success: true, 
      discount: {
        type: promoCode.discount_type,
        value: promoCode.discount_value
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate promo code
router.post('/promo-codes/validate', authenticateToken, async (req, res) => {
  try {
    const { code, amount } = req.body;
    
    const result = await query(`
      SELECT * FROM promo_codes 
      WHERE code = $1 AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > NOW())
      AND used_count < max_uses
      AND min_amount <= $2
    `, [code, amount]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid promo code or minimum amount not met' });
    }
    
    const promoCode = result.rows[0];
    let discountAmount = 0;
    
    if (promoCode.discount_type === 'percentage') {
      discountAmount = (amount * promoCode.discount_value) / 100;
    } else {
      discountAmount = promoCode.discount_value;
    }
    
    res.json({ 
      valid: true, 
      discount_amount: discountAmount,
      final_amount: amount - discountAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;