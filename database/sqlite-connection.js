const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create SQLite database
const dbPath = path.join(__dirname, 'indrive_clone.db');
const db = new sqlite3.Database(dbPath);

// Simple query wrapper
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve({ rows, rowCount: rows.length });
    });
  });
};

// Test connection
const testConnection = async () => {
  try {
    await query('SELECT 1');
    console.log('✅ SQLite Database connected successfully');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
};

module.exports = {
  query,
  testConnection
};