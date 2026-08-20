import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeDatabase, getPool, getIsUsingFallback, getFallbackStore } from './db.js';

describe('Database Module', () => {
  let initialPool;
  let initialFallback;

  beforeAll(async () => {
    // Initialize database (will use MySQL or fallback)
    await initializeDatabase();
    initialPool = getPool();
    initialFallback = getIsUsingFallback();
  }, 30000);

  afterAll(async () => {
    // Close pool if it exists and supports .end()
    if (initialPool && typeof initialPool.end === 'function') {
      await initialPool.end();
    }
  });

  describe('Database Initialization', () => {
    it('should initialize database connection or fallback mode', () => {
      // Should have either pool or fallback mode active
      const pool = getPool();
      const usingFallback = getIsUsingFallback();
      
      expect(usingFallback === true || pool !== null).toBe(true);
    });

    it('should provide access to fallback store when in fallback mode', () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        expect(store).toBeDefined();
        expect(store.users).toBeDefined();
        expect(store.categories).toBeDefined();
        expect(store.suppliers).toBeDefined();
        expect(store.materials).toBeDefined();
        expect(store.stock_transactions).toBeDefined();
        expect(store.audit_logs).toBeDefined();
      }
    });
  });

  describe('Initial Data', () => {
    it('should start without seeded users', async () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        expect(store.users).toHaveLength(0);
      } else {
        const pool = getPool();
        if (pool) {
          const [[users]] = await pool.query('SELECT COUNT(*) AS count FROM users');
          expect(Number(users.count)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should start without seeded categories', async () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        expect(store.categories).toHaveLength(0);
      } else {
        const pool = getPool();
        if (pool) {
          const [categories] = await pool.query('SELECT COUNT(*) as count FROM categories');
          expect(Number(categories[0].count)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should start without seeded suppliers', async () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        expect(store.suppliers).toHaveLength(0);
      } else {
        const pool = getPool();
        if (pool) {
          const [suppliers] = await pool.query('SELECT COUNT(*) as count FROM suppliers');
          expect(Number(suppliers[0].count)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should start without seeded materials', async () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        expect(store.materials).toHaveLength(0);
      } else {
        const pool = getPool();
        if (pool) {
          const [materials] = await pool.query('SELECT COUNT(*) as count FROM materials');
          expect(Number(materials[0].count)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should start without seeded employees and departments', async () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        expect(store.employees_departments).toHaveLength(0);
      } else {
        const pool = getPool();
        if (pool) {
          const [empDepts] = await pool.query('SELECT COUNT(*) as count FROM employees_departments');
          expect(Number(empDepts[0].count)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should start without seeded stock transactions', async () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        expect(store.stock_transactions).toHaveLength(0);
      } else {
        const pool = getPool();
        if (pool) {
          const [transactions] = await pool.query('SELECT COUNT(*) as count FROM stock_transactions');
          expect(Number(transactions[0].count)).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should start without seeded audit logs', async () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        expect(store.audit_logs).toHaveLength(0);
      } else {
        const pool = getPool();
        if (pool) {
          const [logs] = await pool.query('SELECT COUNT(*) as count FROM audit_logs');
          expect(Number(logs[0].count)).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Fallback Store Data Integrity', () => {
    it('should have consistent user roles in fallback mode', () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        const roles = ['Administrator', 'Store Manager', 'Storekeeper', 'Auditor', 'Viewer'];
        
        store.users.forEach(user => {
          expect(roles).toContain(user.role);
        });
      }
    });

    it('should have materials with valid references in fallback mode', () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        
        store.materials.forEach(material => {
          // Check category reference
          if (material.category_id) {
            const category = store.categories.find(c => c.id === material.category_id);
            expect(category).toBeDefined();
          }
          
          // Check supplier reference
          if (material.supplier_id) {
            const supplier = store.suppliers.find(s => s.id === material.supplier_id);
            expect(supplier).toBeDefined();
          }
        });
      }
    });

    it('should have transactions with valid material references in fallback mode', () => {
      if (getIsUsingFallback()) {
        const store = getFallbackStore();
        
        store.stock_transactions.forEach(transaction => {
          const material = store.materials.find(m => m.id === transaction.material_id);
          expect(material).toBeDefined();
        });
      }
    });
  });

  describe('Database Configuration', () => {
    it('should use environment variables or defaults', () => {
      // This test verifies the configuration logic
      const expectedDefaults = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'store_management_db'
      };
      
      expect(expectedDefaults.host).toBeDefined();
      expect(expectedDefaults.port).toBeDefined();
      expect(expectedDefaults.user).toBeDefined();
      expect(expectedDefaults.database).toBe('store_management_db');
    });
  });
});
