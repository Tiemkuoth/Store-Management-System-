import fs from 'fs';
import { initializeDatabase, getIsUsingFallback, getFallbackStore, getPool } from '../server/db/db.js';

const toAdd = [
  { username: 'viewer', password: 'viewer123', full_name: 'Viewer User', email: 'viewer@store.org', role: 'Viewer' },
  { username: 'auditor', password: 'auditor123', full_name: 'Auditor User', email: 'auditor@store.org', role: 'Auditor' }
];

(async () => {
  try {
    await initializeDatabase();
    const fallback = getIsUsingFallback();

    if (fallback) {
      const store = getFallbackStore();
      for (const u of toAdd) {
        if (!store.users.some(x => x.username === u.username)) {
          const id = store.meta.nextId.users || 1;
          store.users.push({ id, username: u.username, password_hash: u.password, full_name: u.full_name, email: u.email, role: u.role, status: 'Active', avatar_url: null, created_at: new Date().toISOString() });
          store.meta.nextId.users = id + 1;
          console.log('Added', u.username);
        } else {
          console.log('Exists, skipping', u.username);
        }
      }
      fs.writeFileSync(new URL('../server/db/fallback-store.json', import.meta.url), JSON.stringify(store, null, 2));
      console.log('Fallback updated. Now re-hashing plaintext passwords...');
      // re-hash
      await new Promise((res, rej) => {
        const p = require('child_process').spawn('node', ['scripts/rehash_passwords.js'], { stdio: 'inherit' });
        p.on('exit', code => code === 0 ? res() : rej(new Error('rehash failed')));
      });
      process.exit(0);
    } else {
      const pool = getPool();
      for (const u of toAdd) {
        const [[exists]] = await pool.query('SELECT 1 FROM users WHERE username = ? LIMIT 1', [u.username]);
        if (!exists) {
          await pool.query('INSERT INTO users (username, password_hash, full_name, email, role, status) VALUES (?, ?, ?, ?, ?, ?)', [u.username, u.password, u.full_name, u.email, u.role, 'Active']);
          console.log('Inserted', u.username);
        } else {
          console.log('Exists, skipping', u.username);
        }
      }
      console.log('Now re-hashing plaintext passwords...');
      await new Promise((res, rej) => {
        const p = require('child_process').spawn('node', ['scripts/rehash_passwords.js'], { stdio: 'inherit' });
        p.on('exit', code => code === 0 ? res() : rej(new Error('rehash failed')));
      });
      if (pool && typeof pool.end === 'function') await pool.end();
      process.exit(0);
    }
  } catch (e) {
    console.error('Add users failed:', e);
    process.exit(1);
  }
})();
