import { initializeDatabase, getIsUsingFallback, getFallbackStore, getPool } from '../server/db/db.js';

(async () => {
  try {
    const pool = await initializeDatabase();
    const usingFallback = getIsUsingFallback();
    console.log('usingFallback=', usingFallback);

    if (usingFallback) {
      const store = getFallbackStore();
      const users = store?.users || [];
      console.log('Users (fallback):');
      users.forEach(u => console.log(`${u.id}	${u.username}	${u.full_name}	${u.role}`));
      process.exit(0);
    } else {
      const p = getPool() || pool;
      const [rows] = await p.query('SELECT id, username, full_name, role FROM users ORDER BY id ASC');
      console.log('Users (MySQL):');
      rows.forEach(r => console.log(`${r.id}\t${r.username}\t${r.full_name}\t${r.role}`));
      if (p && typeof p.end === 'function') await p.end();
      process.exit(0);
    }
  } catch (e) {
    console.error('Failed to list users:', e);
    process.exit(1);
  }
})();
