import { initializeDatabase, getIsUsingFallback, getFallbackStore, getPool } from '../server/db/db.js';

(async () => {
  try {
    await initializeDatabase();
    const usingFallback = getIsUsingFallback();

    if (usingFallback) {
      const store = getFallbackStore();
      const users = store?.users || [];
      console.log('username,password_or_hash,is_bcrypt');
      users.forEach(u => {
        const ph = u.password_hash ?? '';
        const isBcrypt = ph.startsWith('$2');
        console.log(`${u.username},${ph.replace(/,/g,'\,')},${isBcrypt}`);
      });
      process.exit(0);
    } else {
      const pool = getPool();
      const [rows] = await pool.query('SELECT username, password_hash FROM users ORDER BY id ASC');
      console.log('username,password_or_hash,is_bcrypt');
      rows.forEach(r => {
        const ph = r.password_hash || '';
        const isBcrypt = ph.startsWith('$2');
        console.log(`${r.username},${ph.replace(/,/g,'\,')},${isBcrypt}`);
      });
      if (pool && typeof pool.end === 'function') await pool.end();
      process.exit(0);
    }
  } catch (e) {
    console.error('Failed to export credentials:', e);
    process.exit(1);
  }
})();
