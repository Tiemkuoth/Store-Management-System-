import { initializeDatabase } from '../server/db/db.js';

(async () => {
  try {
    const pool = await initializeDatabase();
    console.log('Initialization complete. usingFallback=', !!(pool && typeof pool.query === 'function'));
    if (pool && typeof pool.end === 'function') await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Initialization failed:', e);
    process.exit(1);
  }
})();
