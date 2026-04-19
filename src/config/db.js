const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             process.env.DB_PORT     || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'railway',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  multipleStatements: true, // needed to run the full schema in one shot
});

const connectDB = async () => {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ MySQL connected: ${process.env.DB_HOST}`);

    // Auto-run schema.sql on first boot — creates tables if they don't exist.
    // Safe to run every time because every statement uses IF NOT EXISTS.
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');

      // Strip out CREATE DATABASE and USE statements — Railway already
      // has a database and we don't need to create or switch to another one.
      const cleaned = schema
        .split('\n')
        .filter(line => {
          const upper = line.trim().toUpperCase();
          return !upper.startsWith('CREATE DATABASE') && !upper.startsWith('USE ');
        })
        .join('\n');

      await conn.query(cleaned);
      console.log('✅ Schema applied — all tables are ready');
    }

    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection/schema failed:', err.message);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };
