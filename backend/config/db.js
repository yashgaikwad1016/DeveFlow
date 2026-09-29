import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'devflow',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
  dateStrings: false,
});

// Helper: run a query and return all rows
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Helper: return first row or null
export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Helper: run INSERT/UPDATE/DELETE and return insertId / affectedRows
export async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

// Helper: current datetime string (MySQL format)
export function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Test connection on startup
pool.getConnection().then(conn => {
  console.log('✅ MySQL connected successfully!');
  conn.release();
}).catch(err => {
  console.warn('⚠️ MySQL connection note:', err.message);
});

export default { pool, query, one, run, now };
