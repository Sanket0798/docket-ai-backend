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
  multipleStatements: false, // run statements one by one for better error handling
});

const connectDB = async () => {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ MySQL connected: ${process.env.DB_HOST}`);

    // Auto-run schema.sql on every boot.
    // Each statement runs individually so a duplicate index on restart
    // doesn't crash the whole server.
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');

      // Strip CREATE DATABASE and USE — Railway already has a database.
      const cleaned = schema
        .split('\n')
        .filter(line => {
          const upper = line.trim().toUpperCase();
          return !upper.startsWith('CREATE DATABASE') && !upper.startsWith('USE ');
        })
        .join('\n');

      // Split on semicolons and run each statement individually
      const statements = cleaned
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        try {
          await conn.query(stmt);
        } catch (err) {
          // 1061 = duplicate index (safe to ignore on restart)
          // 1050 = table already exists (safe to ignore)
          if (err.errno === 1061 || err.errno === 1050) continue;
          // Log anything else but don't crash
          console.warn(`⚠️  Schema warning [${err.errno}]: ${err.message}`);
        }
      }
      console.log('✅ Schema applied — all tables are ready');
    }

    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };
