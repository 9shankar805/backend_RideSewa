const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running database migrations...');
    
    // Add phone_number column to users table
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
    `);
    console.log('✅ Added phone_number column to users');
    
    // Create driver_profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        license_number VARCHAR(50),
        vehicle_type VARCHAR(50),
        vehicle_model VARCHAR(100),
        vehicle_year INTEGER,
        is_online BOOLEAN DEFAULT false,
        is_available BOOLEAN DEFAULT false,
        current_latitude DECIMAL(10, 8),
        current_longitude DECIMAL(11, 8),
        rating DECIMAL(3, 2) DEFAULT 0.00,
        total_rides INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created driver_profiles table');
    
    // Create saved_places table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_places (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        type VARCHAR(20) DEFAULT 'other',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created saved_places table');
    
    // Add contact info columns to rides table
    await client.query(`
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS contact_name VARCHAR(100);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_for_other BOOLEAN DEFAULT false;
    `);
    console.log('✅ Added contact info columns to rides');
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON driver_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_driver_profiles_location ON driver_profiles(current_latitude, current_longitude);
      CREATE INDEX IF NOT EXISTS idx_saved_places_user_id ON saved_places(user_id);
    `);
    console.log('✅ Created indexes');
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();