import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  console.log('Connecting to MySQL...');
  console.log('Host:', process.env.DB_HOST || 'localhost');
  console.log('User:', process.env.DB_USER || 'root');
  console.log('DB:', process.env.DB_NAME || 'devflow');
  
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    multipleStatements: true,
  });
  console.log('Connected!');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  
  await conn.query(schema);
  console.log('✅ MySQL schema applied successfully (devflow database ready)');
  await conn.end();
}

initDb().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Schema error:', err.message);
  process.exit(1);
});
