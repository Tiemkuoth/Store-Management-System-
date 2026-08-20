import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createPool } from 'mysql2/promise';

const pool = createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'store_management_db',
  waitForConnections: true,
  connectionLimit: 2,
});

// ── Change these values before running ────────────────────────
const SUPERADMIN = {
  username:  'superadmin',
  password:  'Admin@1234',
  full_name: 'Super Administrator',
  email:     'superadmin@store.org',
  role:      'Administrator',
};
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🔧 Creating super admin account...\n');

  const [existing] = await pool.query(
    'SELECT id FROM users WHERE username = ?', [SUPERADMIN.username]
  );

  if (existing.length > 0) {
    console.log(`⚠️  Username "${SUPERADMIN.username}" already exists.`);
    console.log('   Edit SUPERADMIN.username in this file and run again, or log in with that account.');
    await pool.end();
    process.exit(0);
  }

  const hashed = await bcrypt.hash(SUPERADMIN.password, 10);

  const [result] = await pool.query(
    `INSERT INTO users (username, password_hash, full_name, email, role, status, theme_preference)
     VALUES (?, ?, ?, ?, ?, 'Active', 'Light')`,
    [SUPERADMIN.username, hashed, SUPERADMIN.full_name, SUPERADMIN.email, SUPERADMIN.role]
  );

  console.log('✅ Super admin created successfully!\n');
  console.log('   ID:       ', result.insertId);
  console.log('   Username: ', SUPERADMIN.username);
  console.log('   Password: ', SUPERADMIN.password);
  console.log('   Role:     ', SUPERADMIN.role);
  console.log('\n🔐 Log in at http://localhost:5173 with the credentials above.');
  console.log('   Change the password after first login.\n');

  await pool.end();
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  console.error('\nMake sure MySQL is running and your .env DB settings are correct.');
  process.exit(1);
});
