const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔄 Starting database migrations...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      try {
        await pool.query(statement);
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠️  Skipped (exists):', statement.substring(0, 50) + '...');
        } else {
          console.error('❌ Failed:', statement.substring(0, 50) + '...');
          console.error('Error:', error.message);
        }
      }
    }

    // Insert default system configuration
    await pool.query(`
      INSERT INTO system_config (category, key, value, description) VALUES
      ('app', 'commission_rate', '0.15', 'Platform commission rate (15%)'),
      ('app', 'max_search_radius', '15', 'Maximum driver search radius in km'),
      ('app', 'bid_timeout_minutes', '5', 'Bid timeout in minutes'),
      ('pricing', 'base_fare', '2.50', 'Base fare for rides'),
      ('pricing', 'per_km_rate', '1.20', 'Rate per kilometer')
      ON CONFLICT (category, key) DO NOTHING
    `);

    console.log('🎉 Database migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;