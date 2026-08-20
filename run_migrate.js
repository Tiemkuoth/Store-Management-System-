import fs from 'fs';
import { initializeDatabase, getPool } from './server/db/db.js';

async function run() {
  await initializeDatabase();
  const pool = getPool();
  if (!pool) {
    console.error('Failed to get database pool');
    process.exit(1);
  }
  try {
    const sql = fs.readFileSync('C:\\Users\\TIEMKUOTH\\.gemini\\antigravity\\brain\\756424bc-46c7-4a88-9bd5-09a82c96b81e\\scratch\\migrate.sql', 'utf8');
    const [result] = await pool.query(sql);
    console.log('Migration successful', result);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}
run();
