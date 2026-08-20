// scripts/importData.js
// Import JSON export into MySQL database.
// Usage: node scripts/importData.js <inputFilePath>
// Example: node scripts/importData.js dataExport.json

import { getPool } from '../server/db/db.js';
import fs from 'fs';
import path from 'path';

// Define import order to respect foreign keys (adjust as needed)
const importOrder = [
  'system_settings',
  'users',
  'categories',
  'suppliers',
  'employees_departments',
  'materials',
  'inventory'
];

async function importData(inputPath) {
  const absPath = path.resolve(inputPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(absPath, 'utf-8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error('Invalid JSON file:', e.message);
    process.exit(1);
  }
  const pool = getPool();
  for (const tbl of importOrder) {
    const rows = data[tbl];
    if (!Array.isArray(rows)) continue;
    console.log(`Importing ${rows.length} rows into ${tbl}`);
    // Simple approach: delete existing rows then insert
    await pool.query(`DELETE FROM ${tbl}`);
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(',');
    const sql = `INSERT INTO ${tbl} (${columns.join(',')}) VALUES (${placeholders})`;
    for (const row of rows) {
      const values = columns.map(col => row[col]);
      await pool.query(sql, values);
    }
  }
  console.log('Import completed successfully.');
}

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Please provide input file path, e.g., node scripts/importData.js dataExport.json');
  process.exit(1);
}
importData(args[0])
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Import error:', err);
    process.exit(1);
  });
