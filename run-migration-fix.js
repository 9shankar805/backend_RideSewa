const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('🔧 Running database migration...');
    
    const sqlFile = path.join(__dirname, 'fix-database.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Database migration completed successfully');
    
    // Test the fixes
    const testQueries = [
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_number'",
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'driver_profiles'",
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'saved_places'"
    ];
    
    for (const query of testQueries) {
      const result = await pool.query(query);
      console.log(`✅ Verification: ${result.rows.length > 0 ? 'PASS' : 'FAIL'}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();