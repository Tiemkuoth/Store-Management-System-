import { initializeDatabase, getIsUsingFallback, getFallbackStore, getPool } from '../server/db/db.js';
import bcrypt from 'bcryptjs';

(async () => {
  try {
    await initializeDatabase();
    const fallback = getIsUsingFallback();

    if (fallback) {
      const store = getFallbackStore();
      let updated = 0;
      for (const u of store.users) {
        const ph = u.password_hash || '';
        if (!ph.startsWith('$2')) {
          const newh = bcrypt.hashSync(ph, 10);
          u.password_hash = newh;
          updated++;
        }
      }
      // write back
      const fs = await import('fs');
      fs.writeFileSync(new URL('../server/db/fallback-store.json', import.meta.url), JSON.stringify(store, null, 2));
      console.log(`Re-hashed ${updated} fallback user passwords.`);
      process.exit(0);
    } else {
      const pool = getPool();
      const [rows] = await pool.query('SELECT id, username, password_hash FROM users');
      let updated = 0;
      for (const r of rows) {
        const ph = r.password_hash || '';
        if (!ph.startsWith('$2')) {
          const newh = await bcrypt.hash(ph, 10);
          await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newh, r.id]);
          updated++;
        }
      }
      console.log(`Re-hashed ${updated} MySQL user passwords.`);
      if (pool && typeof pool.end === 'function') await pool.end();
      process.exit(0);
    }
  } catch (e) {
    console.error('Rehash failed:', e);
    process.exit(1);
  }
})();
