import fs from 'fs';
import { initializeDatabase, getIsUsingFallback, getFallbackStore, getPool } from '../server/db/db.js';

(async () => {
  try {
    await initializeDatabase();
    const fallback = getIsUsingFallback();
    const newUsers = JSON.parse(fs.readFileSync(new URL('./new_users.json', import.meta.url)));

    if (fallback) {
      const store = getFallbackStore();
      // backup
      fs.writeFileSync(new URL('../server/db/fallback-store-backup.json', import.meta.url), JSON.stringify(store, null, 2));
      // remove old users
      store.users = [];
      for (const u of newUsers) {
        const id = store.meta.nextId.users || 1;
        store.users.push({ id, username: u.username, password_hash: u.password, full_name: u.full_name, email: u.email, role: u.role, status: 'Active', avatar_url: null, created_at: new Date().toISOString() });
        store.meta.nextId.users = id + 1;
      }
      fs.writeFileSync(new URL('../server/db/fallback-store.json', import.meta.url), JSON.stringify(store, null, 2));
      console.log('Fallback users reset. Backup written to server/db/fallback-store-backup.json');
      process.exit(0);
    } else {
      const pool = getPool();
      // backup current users
      const [rows] = await pool.query('SELECT * FROM users');
      fs.writeFileSync(new URL('../server/db/mysql-users-backup.json', import.meta.url), JSON.stringify(rows, null, 2));
      // delete all users
      await pool.query('DELETE FROM users');
      // insert new users with plaintext passwords in password_hash column
      for (const u of newUsers) {
        await pool.query('INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)', [u.username, u.password, u.full_name, u.email, u.role]);
      }
      console.log('MySQL users replaced. Backup written to server/db/mysql-users-backup.json');
      if (pool && typeof pool.end === 'function') await pool.end();
      process.exit(0);
    }
  } catch (e) {
    console.error('Reset failed:', e);
    process.exit(1);
  }
})();
