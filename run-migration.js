require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  try {
    console.log('🔄 Running complete database migration...');
    
    // Create users table first
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) UNIQUE,
        email VARCHAR(255) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        profile_image_url TEXT,
        user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('passenger', 'driver', 'both')),
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        rating DECIMAL(3,2) DEFAULT 5.0,
        total_ratings INTEGER DEFAULT 0,
        loyalty_points INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Users table created');
      
    // Create driver_profiles table (depends on users)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS driver_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        license_number VARCHAR(50),
        license_expiry DATE,
        license_image_url TEXT,
        vehicle_registration VARCHAR(50),
        vehicle_model VARCHAR(100),
        vehicle_color VARCHAR(50),
        vehicle_plate VARCHAR(20),
        vehicle_year INTEGER,
        vehicle_image_url TEXT,
        insurance_number VARCHAR(100),
        insurance_expiry DATE,
        is_online BOOLEAN DEFAULT FALSE,
        is_available BOOLEAN DEFAULT FALSE,
        verification_status VARCHAR(20) DEFAULT 'pending',
        current_latitude DECIMAL(10, 8),
        current_longitude DECIMAL(11, 8),
        last_location_update TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Driver profiles table created');
      
    // Create rides table (depends on users)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
        driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
        pickup_latitude DECIMAL(10, 8) NOT NULL,
        pickup_longitude DECIMAL(11, 8) NOT NULL,
        pickup_address TEXT NOT NULL,
        destination_latitude DECIMAL(10, 8) NOT NULL,
        destination_longitude DECIMAL(11, 8) NOT NULL,
        destination_address TEXT NOT NULL,
        proposed_fare DECIMAL(10, 2) NOT NULL,
        final_fare DECIMAL(10, 2),
        distance_km DECIMAL(8, 2),
        estimated_duration_minutes INTEGER,
        ride_type VARCHAR(50) DEFAULT 'standard',
        status VARCHAR(20) DEFAULT 'searching',
        payment_method VARCHAR(20) DEFAULT 'cash',
        payment_status VARCHAR(20) DEFAULT 'pending',
        scheduled_time TIMESTAMP WITH TIME ZONE,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        cancelled_at TIMESTAMP WITH TIME ZONE,
        cancellation_reason TEXT,
        cancellation_fee DECIMAL(10, 2) DEFAULT 0,
        payment_intent_id VARCHAR(255),
        estimated_fare DECIMAL(10, 2),
        max_passengers INTEGER DEFAULT 1,
        current_passengers INTEGER DEFAULT 1,
        waypoints JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Rides table created');
      
    // Create bids table (depends on rides and users)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
        driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
        proposed_fare DECIMAL(10, 2) NOT NULL,
        estimated_arrival_minutes INTEGER NOT NULL,
        message TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Bids table created');
      
    // Create notifications table (depends on users)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Notifications table created');

    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();