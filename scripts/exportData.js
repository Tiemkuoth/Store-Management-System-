// scripts/exportData.js
// Export selected tables from MySQL to a JSON file for transfer between machines.
// Usage: node scripts/exportData.js <outputFilePath>
// Example: node scripts/exportData.js dataExport.json

import { getPool } from '../server/db/db.js';
import fs from 'fs';
import path from 'path';

const tables = [
  'users',
  'categories',
  'suppliers',
  'employees_departments',
  'materials',
  'inventory', // assuming table name
  'system_settings',
  // add other tables as needed
];

async function exportData(outputPath) {
  const pool = getPool();
  const exportObj = {};
  for (const tbl of tables) {
    const [rows] = await pool.query(`SELECT * FROM ${tbl}`);
    exportObj[tbl] = rows;
  }
  const json = JSON.stringify(exportObj, null, 2);
  const absPath = path.resolve(outputPath);
  fs.writeFileSync(absPath, json);
  console.log(`Data exported to ${absPath}`);
}

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Please provide output file path, e.g., node scripts/exportData.js dataExport.json');
  process.exit(1);
}
exportData(args[0])
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Export error:', err);
    process.exit(1);
  });
