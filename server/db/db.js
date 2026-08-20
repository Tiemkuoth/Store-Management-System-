import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Connection config — all values come from .env ────────────
const dbConfig = {
  host:               process.env.DB_HOST     || '127.0.0.1',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'store_management_db',
  socketPath:         process.env.DB_SOCKET    || undefined,
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  connectTimeout:     5000,   // fail fast — 5 s instead of the default 30 s
};

let pool = null;
let usingFallback = false;
let fallbackStore = null;
const fallbackFile = path.join(__dirname, 'fallback-store.json');

function createEmptyStore() {
  return {
    meta: {
      nextId: {
        users: 1,
        categories: 1,
        suppliers: 1,
        employees_departments: 1,
        materials: 1,
        stock_transactions: 1,
        stock_transfers: 1,
        audit_logs: 1,
        system_settings: 1,
        material_requests: 1,
        material_disposals: 1,
      }
    },
    users: [],
    categories: [],
    suppliers: [],
    employees_departments: [],
    materials: [],
    stock_transactions: [],
    stock_transfers: [],
    audit_logs: [],
    system_settings: [],
    material_requests: [],
    material_disposals: [],
  };
}

function saveFallbackStore() {
  fs.writeFileSync(fallbackFile, JSON.stringify(fallbackStore, null, 2), 'utf8');
  // If a local sync path is provided, copy the store file there for sharing across machines
  const syncPath = process.env.LOCAL_SYNC_PATH;
  if (syncPath) {
    try {
      const target = require('path').join(syncPath, 'fallback-store.json');
      require('fs').copyFileSync(fallbackFile, target);
      console.log('🔄 Fallback store synced to', target);
    } catch (e) {
      console.warn('⚠️ Failed to sync fallback store to LOCAL_SYNC_PATH:', e.message);
    }
  }
}

function loadFallbackStore() {
  if (fs.existsSync(fallbackFile)) {
    fallbackStore = JSON.parse(fs.readFileSync(fallbackFile, 'utf8'));
    fallbackStore = { ...createEmptyStore(), ...fallbackStore };
    for (const table of Object.keys(fallbackStore.meta.nextId)) {
      if (!fallbackStore.meta.nextId[table]) {
        const list = fallbackStore[table] || [];
        fallbackStore.meta.nextId[table] = list.length ? Math.max(...list.map(i => Number(i.id || 0))) + 1 : 1;
      }
    }
  } else {
    fallbackStore = createEmptyStore();
    saveFallbackStore();
  }
}

function getNextId(table) {
  const next = fallbackStore.meta.nextId[table] || 1;
  fallbackStore.meta.nextId[table] = next + 1;
  return next;
}

function byId(table, id) {
  return fallbackStore[table].find(item => String(item.id) === String(id));
}

function orderBy(rows, field, direction = 'asc') {
  return [...rows].sort((a, b) => {
    if (a[field] == null) return 1;
    if (b[field] == null) return -1;
    if (typeof a[field] === 'number' && typeof b[field] === 'number') {
      return direction === 'asc' ? a[field] - b[field] : b[field] - a[field];
    }
    return direction === 'asc'
      ? String(a[field]).localeCompare(String(b[field]))
      : String(b[field]).localeCompare(String(a[field]));
  });
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function finalizeStore() {
  if (usingFallback) saveFallbackStore();
}

function queryFallback(sql, params = []) {
  const normalized = normalizeSql(sql);

  if (normalized.startsWith('select * from users where username=?')) {
    const [username] = params;
    return [fallbackStore.users.filter(u => u.username === username)];
  }
  if (normalized.startsWith('select * from users where id=?')) {
    const [id] = params;
    return [fallbackStore.users.filter(u => String(u.id) === String(id))];
  }
  if (normalized.startsWith('select id,username,full_name,email,role,status,avatar_url,created_at from users order by id asc')) {
    return [orderBy(fallbackStore.users, 'id', 'asc')];
  }
  if (normalized.startsWith('update users set full_name=?,email=?,avatar_url=? where id=?')) {
    const [full_name, email, avatar_url, id] = params;
    const user = byId('users', id);
    if (user) Object.assign(user, { full_name, email, avatar_url: avatar_url ?? null });
    finalizeStore();
    return [{ affectedRows: user ? 1 : 0 }];
  }
  if (normalized.startsWith('update users set full_name=?,email=?,role=?,status=?,avatar_url=? where id=?')) {
    const [full_name, email, role, status, avatar_url, id] = params;
    const user = byId('users', id);
    if (user) Object.assign(user, { full_name, email, role, status, avatar_url: avatar_url ?? null });
    finalizeStore();
    return [{ affectedRows: user ? 1 : 0 }];
  }
  if (normalized.startsWith('select id,role from users where id=?')) {
    const [id] = params;
    const user = byId('users', id);
    return [[user ? { id: user.id, role: user.role } : undefined].filter(Boolean)];
  }
  if (normalized.startsWith('update users set status=? where id=?')) {
    const [status, id] = params;
    const user = byId('users', id);
    if (user) user.status = status;
    finalizeStore();
    return [{ affectedRows: user ? 1 : 0 }];
  }
  if (normalized.startsWith('update users set password_hash=? where id=?')) {
    const [password_hash, id] = params;
    const user = byId('users', id);
    if (user) user.password_hash = password_hash;
    finalizeStore();
    return [{ affectedRows: user ? 1 : 0 }];
  }
  if (normalized.startsWith('delete from users where id=?')) {
    const [id] = params;
    const before = fallbackStore.users.length;
    fallbackStore.users = fallbackStore.users.filter(u => String(u.id) !== String(id));
    finalizeStore();
    return [{ affectedRows: before - fallbackStore.users.length }];
  }
  if (normalized.startsWith('insert into users')) {
    const [username, password_hash, full_name, email, role, avatar_url] = params;
    const id = getNextId('users');
    fallbackStore.users.push({ id, username, password_hash, full_name, email, role, status: 'Active', avatar_url: avatar_url || null, created_at: new Date().toISOString() });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (normalized.startsWith('select * from categories order by name asc')) {
    return [orderBy(fallbackStore.categories, 'name', 'asc')];
  }
  if (normalized.startsWith('insert into categories')) {
    const [name, description] = params;
    const id = getNextId('categories');
    fallbackStore.categories.push({ id, name, description, created_at: new Date().toISOString() });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith('update categories set name=?,description=? where id=?')) {
    const [name, description, id] = params;
    const category = byId('categories', id);
    if (category) Object.assign(category, { name, description });
    finalizeStore();
    return [{ affectedRows: category ? 1 : 0 }];
  }
  if (normalized.startsWith('delete from categories where id=?')) {
    const [id] = params;
    const before = fallbackStore.categories.length;
    fallbackStore.categories = fallbackStore.categories.filter(c => String(c.id) !== String(id));
    finalizeStore();
    return [{ affectedRows: before - fallbackStore.categories.length }];
  }

  if (normalized.startsWith('select * from suppliers order by name asc')) {
    return [orderBy(fallbackStore.suppliers, 'name', 'asc')];
  }
  if (normalized.startsWith('insert into suppliers')) {
    const [supplier_code, name, contact_person, email, phone, address] = params;
    const id = getNextId('suppliers');
    fallbackStore.suppliers.push({ id, supplier_code, name, contact_person, email, phone, address, created_at: new Date().toISOString() });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith('update suppliers set name=?,contact_person=?,email=?,phone=?,address=? where id=?')) {
    const [name, contact_person, email, phone, address, id] = params;
    const sup = byId('suppliers', id);
    if (sup) Object.assign(sup, { name, contact_person, email, phone, address });
    finalizeStore();
    return [{ affectedRows: sup ? 1 : 0 }];
  }
  if (normalized.startsWith('delete from suppliers where id=?')) {
    const [id] = params;
    const before = fallbackStore.suppliers.length;
    fallbackStore.suppliers = fallbackStore.suppliers.filter(s => String(s.id) !== String(id));
    finalizeStore();
    return [{ affectedRows: before - fallbackStore.suppliers.length }];
  }

  if (normalized.startsWith('select * from employees_departments order by name asc')) {
    return [orderBy(fallbackStore.employees_departments, 'name', 'asc')];
  }
  if (normalized.startsWith('delete from employees_departments where id=?')) {
    const [id] = params;
    const before = fallbackStore.employees_departments.length;
    fallbackStore.employees_departments = fallbackStore.employees_departments.filter(e => String(e.id) !== String(id));
    finalizeStore();
    return [{ affectedRows: before - fallbackStore.employees_departments.length }];
  }
  if (normalized.startsWith('insert into employees_departments')) {
    const [type, code, name, department_name, contact_number, email] = params;
    const id = getNextId('employees_departments');
    fallbackStore.employees_departments.push({ id, type, code, name, department_name, contact_number, email, created_at: new Date().toISOString() });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith('update employees_departments set name=?,department_name=?,contact_number=?,email=? where id=?')) {
    const [name, department_name, contact_number, email, id] = params;
    const rec = byId('employees_departments', id);
    if (rec) Object.assign(rec, { name, department_name, contact_number, email });
    finalizeStore();
    return [{ affectedRows: rec ? 1 : 0 }];
  }

  if (normalized.startsWith('select * from materials')) {
    return [fallbackStore.materials];
  }
  if (normalized.startsWith('insert into materials')) {
    const [material_code, name, category_id, unit_of_measure, specifications, min_stock_level, current_stock, unit_cost, supplier_id, location, barcode] = params;
    const id = getNextId('materials');
    fallbackStore.materials.push({ id, material_code, name, category_id: category_id || null, unit_of_measure, specifications, min_stock_level: Number(min_stock_level), current_stock: Number(current_stock), unit_cost: Number(unit_cost), supplier_id: supplier_id || null, location, barcode, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith('update materials set name=?,category_id=?,unit_of_measure=?,specifications=?,')) {
    const [name, category_id, unit_of_measure, specifications, min_stock_level, unit_cost, supplier_id, location, id] = params;
    const mat = byId('materials', id);
    if (mat) Object.assign(mat, { name, category_id: category_id || null, unit_of_measure, specifications, min_stock_level: Number(min_stock_level), unit_cost: Number(unit_cost), supplier_id: supplier_id || null, location, updated_at: new Date().toISOString() });
    finalizeStore();
    return [{ affectedRows: mat ? 1 : 0 }];
  }
  if (normalized.startsWith('delete from materials where id=?')) {
    const [id] = params;
    const before = fallbackStore.materials.length;
    fallbackStore.materials = fallbackStore.materials.filter(m => String(m.id) !== String(id));
    finalizeStore();
    return [{ affectedRows: before - fallbackStore.materials.length }];
  }
  if (normalized.startsWith('select count(*) as total from stock_transactions')) {
    return [[{ total: fallbackStore.stock_transactions.length }]];
  }
  if (normalized.startsWith('select count(*) as total from materials')) {
    return [[{ total: fallbackStore.materials.length }]];
  }
  if (normalized.startsWith('select count(*) as low from materials where current_stock <= min_stock_level')) {
    return [[{ low: fallbackStore.materials.filter(m => Number(m.current_stock) <= Number(m.min_stock_level)).length }]];
  }
  if (normalized.startsWith('select sum(current_stock * unit_cost) as val from materials')) {
    return [[{ val: fallbackStore.materials.reduce((sum, m) => sum + (Number(m.current_stock) * Number(m.unit_cost)), 0) }]];
  }
  if (normalized.startsWith('select count(*) as txtoday from stock_transactions where date(transaction_date)=curdate()')) {
    return [[{ txToday: fallbackStore.stock_transactions.filter(t => {
      const d = new Date(t.transaction_date);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }).length }]];
  }

  if (normalized.startsWith('select * from stock_transactions order by id desc limit ? offset ?')) {
    const [limit, offset] = params;
    const rows = orderBy(fallbackStore.stock_transactions, 'id', 'desc').slice(offset, offset + limit);
    return [rows];
  }
  if (normalized.includes('from stock_transactions t') && normalized.includes('left join materials')) {
    const [limit, offset] = params;
    const rows = orderBy(fallbackStore.stock_transactions, 'id', 'desc').slice(offset, offset + limit).map(t => {
      const m = byId('materials', t.material_id) || {};
      const s = byId('suppliers', t.supplier_id) || {};
      const ed = byId('employees_departments', t.employee_dept_id) || {};
      const u1 = byId('users', t.issued_by_id) || {};
      const u2 = byId('users', t.approved_by_id) || {};
      return {
        ...t,
        material_name: m.name || null,
        material_code: m.material_code || null,
        supplier_name: s.name || null,
        receiver_name: ed.name || null,
        issued_by_name: u1.username || null,
        approved_by_name: u2.username || null,
      };
    });
    return [rows];
  }
  if (normalized.startsWith('insert into stock_transactions')) {
    const [code, material_id, quantity, unit_cost, supplier_id, purpose, issued_by_id, store_location, remarks] = params;
    const id = getNextId('stock_transactions');
    fallbackStore.stock_transactions.push({ id, transaction_code: code, transaction_type: 'STOCK_IN', material_id, quantity: Number(quantity), unit_cost: Number(unit_cost), supplier_id: supplier_id || null, employee_dept_id: null, purpose, issued_by_id, approved_by_id: null, store_location, remarks, transaction_date: new Date().toISOString() });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith('select current_stock,name from materials where id=?')) {
    const [id] = params;
    const mat = byId('materials', id);
    return [[mat ? { current_stock: mat.current_stock, name: mat.name } : undefined].filter(Boolean)];
  }
  if (normalized.startsWith('update materials set current_stock=current_stock+?, unit_cost=if(?>0,?,unit_cost) where id=?')) {
    const [qty, cost, cost2, id] = params;
    const mat = byId('materials', id);
    if (mat) {
      mat.current_stock = Number(mat.current_stock) + Number(qty);
      if (Number(cost) > 0) mat.unit_cost = Number(cost2);
      mat.updated_at = new Date().toISOString();
    }
    finalizeStore();
    return [{ affectedRows: mat ? 1 : 0 }];
  }
  if (normalized.startsWith('update materials set current_stock=current_stock-? where id=?')) {
    const [qty, id] = params;
    const mat = byId('materials', id);
    if (mat) {
      mat.current_stock = Number(mat.current_stock) - Number(qty);
      mat.updated_at = new Date().toISOString();
    }
    finalizeStore();
    return [{ affectedRows: mat ? 1 : 0 }];
  }
  if (normalized.startsWith('update materials set current_stock=current_stock+? where id=?')) {
    const [qty, id] = params;
    const mat = byId('materials', id);
    if (mat) {
      mat.current_stock = Number(mat.current_stock) + Number(qty);
      mat.updated_at = new Date().toISOString();
    }
    finalizeStore();
    return [{ affectedRows: mat ? 1 : 0 }];
  }
  if (normalized.startsWith('update materials set current_stock=? where id=?')) {
    const [target, id] = params;
    const mat = byId('materials', id);
    if (mat) {
      mat.current_stock = Number(target);
      mat.updated_at = new Date().toISOString();
    }
    finalizeStore();
    return [{ affectedRows: mat ? 1 : 0 }];
  }
  if (normalized.startsWith('update materials set location=? where id=?')) {
    const [location, id] = params;
    const mat = byId('materials', id);
    if (mat) {
      mat.location = location;
      mat.updated_at = new Date().toISOString();
    }
    finalizeStore();
    return [{ affectedRows: mat ? 1 : 0 }];
  }

  if (normalized.startsWith('select count(*) as total from stock_transfers')) {
    return [[{ total: fallbackStore.stock_transfers.length }]];
  }
  if (normalized.startsWith('select t.*, m.name as material_name')) {
    const [limit, offset] = params;
    const rows = orderBy(fallbackStore.stock_transfers, 'id', 'desc').slice(offset, offset + limit).map(t => {
      const m = byId('materials', t.material_id) || {};
      const u = byId('users', t.transferred_by_id) || {};
      return { ...t, material_name: m.name || null, material_code: m.material_code || null, transferred_by_name: u.username || null };
    });
    return [rows];
  }
  if (normalized.startsWith('insert into stock_transfers')) {
    const [code, material_id, quantity, source_location, destination_location, transferred_by_id, remarks] = params;
    const id = getNextId('stock_transfers');
    fallbackStore.stock_transfers.push({ id, transfer_code: code, material_id, quantity: Number(quantity), source_location, destination_location, transferred_by_id, transfer_date: new Date().toISOString(), remarks });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (normalized.startsWith('select c.name as category, count(m.id) as item_count')) {
    const stats = fallbackStore.categories.map(cat => {
      const filtered = fallbackStore.materials.filter(m => String(m.category_id) === String(cat.id));
      return { category: cat.name, item_count: filtered.length, stock_qty: filtered.reduce((sum, m) => sum + Number(m.current_stock), 0) };
    });
    return [stats];
  }

  if (normalized.includes('from material_requests mr') && normalized.includes('left join materials')) {
    const [limit, offset] = params;
    const rows = orderBy(fallbackStore.material_requests, 'id', 'desc').slice(offset, offset + limit).map(req => {
      const m = byId('materials', req.material_id) || {};
      const u1 = byId('users', req.requested_by_id) || {};
      const u2 = byId('users', req.approved_by_id) || {};
      return {
        ...req,
        material_name: m.name || null,
        material_code: m.material_code || null,
        current_stock: m.current_stock || null,
        unit_of_measure: m.unit_of_measure || null,
        requester_name: u1.full_name || null,
        requester_username: u1.username || null,
        approver_name: u2.full_name || null,
      };
    });
    return [rows];
  }

  if (normalized.includes('from material_disposals d') && normalized.includes('left join materials')) {
    const [limit, offset] = params;
    const rows = orderBy(fallbackStore.material_disposals, 'id', 'desc').slice(offset, offset + limit).map(d => {
      const m = byId('materials', d.material_id) || {};
      const u1 = byId('users', d.recorded_by_id) || {};
      const u2 = byId('users', d.approved_by_id) || {};
      return {
        ...d,
        material_name: m.name || null,
        material_code: m.material_code || null,
        unit_of_measure: m.unit_of_measure || null,
        recorder_name: u1.full_name || null,
        approver_name: u2.full_name || null,
      };
    });
    return [rows];
  }

  if (normalized.includes('on duplicate key update') && normalized.startsWith('insert into system_settings')) {
    const [setting_key, setting_value] = params;
    const existing = fallbackStore.system_settings.find(s => s.setting_key === setting_key);
    if (existing) {
      existing.setting_value = setting_value;
      existing.updated_at = new Date().toISOString();
    } else {
      const id = getNextId('system_settings');
      fallbackStore.system_settings.push({ id, setting_key, setting_value, updated_at: new Date().toISOString() });
    }
    finalizeStore();
    return [{ affectedRows: 1 }];
  }

  if (normalized.includes('from stock_transfers t') && normalized.includes('left join materials')) {
    const [limit, offset] = params;
    const rows = orderBy(fallbackStore.stock_transfers, 'id', 'desc').slice(offset, offset + limit).map(t => {
      const m = byId('materials', t.material_id) || {};
      const u = byId('users', t.transferred_by_id) || {};
      return {
        ...t,
        material_name: m.name || null,
        material_code: m.material_code || null,
        transferred_by_name: u.username || null,
      };
    });
    return [rows];
  }

  if (normalized.startsWith('insert into audit_logs')) {
    const [user_id, username, user_role, action_type, description, ip_address] = params;
    const id = getNextId('audit_logs');
    fallbackStore.audit_logs.push({ id, user_id, username, user_role, action_type, description, ip_address, created_at: new Date().toISOString() });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }

  if (normalized.startsWith('update materials set current_stock=greatest(0,current_stock-?) where id=?')) {
    const [qty, id] = params;
    const mat = byId('materials', id);
    if (mat) {
      mat.current_stock = Math.max(0, Number(mat.current_stock) - Number(qty));
      mat.updated_at = new Date().toISOString();
    }
    finalizeStore();
    return [{ affectedRows: mat ? 1 : 0 }];
  }

  if (normalized.startsWith('insert into system_settings')) {
    const [setting_key, setting_value] = params;
    const existing = fallbackStore.system_settings.find(s => s.setting_key === setting_key);
    if (existing) {
      existing.setting_value = setting_value;
      existing.updated_at = new Date().toISOString();
    } else {
      const id = getNextId('system_settings');
      fallbackStore.system_settings.push({ id, setting_key, setting_value, updated_at: new Date().toISOString() });
    }
    finalizeStore();
    return [{ affectedRows: 1 }];
  }

  if (normalized.startsWith('select count(*) as total from audit_logs')) {
    return [[{ total: fallbackStore.audit_logs.length }]];
  }
  if (normalized.startsWith('select * from audit_logs order by id desc limit ? offset ?')) {
    const [limit, offset] = params;
    return [orderBy(fallbackStore.audit_logs, 'id', 'desc').slice(offset, offset + limit)];
  }
  if (normalized.startsWith('select * from audit_logs order by id desc limit ?')) {
    const [limit] = params;
    return [orderBy(fallbackStore.audit_logs, 'id', 'desc').slice(0, limit)];
  }
  if (normalized.startsWith('select * from audit_logs')) {
    return [orderBy(fallbackStore.audit_logs, 'id', 'desc')];
  }

  if (normalized.startsWith('select * from material_requests')) {
    return [orderBy(fallbackStore.material_requests, 'id', 'desc')];
  }

  if (normalized.startsWith('select * from material_disposals')) {
    return [orderBy(fallbackStore.material_disposals, 'id', 'desc')];
  }

  if (normalized.startsWith('select count(*) as total from material_requests')) {
    return [[{ total: fallbackStore.material_requests.length }]];
  }
  if (normalized.startsWith('select mr.*, m.name as material_name')) {
    const [limit, offset] = params;
    const rows = orderBy(fallbackStore.material_requests, 'id', 'desc').slice(offset, offset + limit).map(req => {
      const m = byId('materials', req.material_id) || {};
      const u1 = byId('users', req.requested_by_id) || {};
      const u2 = byId('users', req.approved_by_id) || {};
      return { ...req, material_name: m.name || null, material_code: m.material_code || null, current_stock: m.current_stock || null, unit_of_measure: m.unit_of_measure || null, requester_name: u1.full_name || null, requester_username: u1.username || null, approver_name: u2.full_name || null };
    });
    return [rows];
  }
  if (normalized.startsWith('insert into material_requests')) {
    const [code, material_id, quantity, purpose, priority, remarks, requested_by_id] = params;
    const id = getNextId('material_requests');
    fallbackStore.material_requests.push({ id, request_code: code, material_id, quantity: Number(quantity), purpose, priority, remarks, status: 'Pending', requested_by_id, approved_by_id: null, approval_remarks: null, request_date: new Date().toISOString(), approved_at: null });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith('update material_requests set status=')) {
    const [approved_by_id, approval_remarks, id] = params;
    const req = byId('material_requests', id);
    if (req) {
      req.status = normalized.includes("status='approved'") ? 'Approved' : 'Rejected';
      req.approved_by_id = approved_by_id;
      req.approval_remarks = approval_remarks;
      req.approved_at = new Date().toISOString();
    }
    finalizeStore();
    return [{ affectedRows: req ? 1 : 0 }];
  }

  if (normalized.startsWith('select count(*) as total from material_disposals')) {
    return [[{ total: fallbackStore.material_disposals.length }]];
  }
  if (normalized.startsWith('select d.*, m.name as material_name')) {
    const [limit, offset] = params;
    const rows = orderBy(fallbackStore.material_disposals, 'id', 'desc').slice(offset, offset + limit).map(d => {
      const m = byId('materials', d.material_id) || {};
      const u1 = byId('users', d.recorded_by_id) || {};
      const u2 = byId('users', d.approved_by_id) || {};
      return { ...d, material_name: m.name || null, material_code: m.material_code || null, unit_of_measure: m.unit_of_measure || null, recorder_name: u1.full_name || null, approver_name: u2.full_name || null };
    });
    return [rows];
  }
  if (normalized.startsWith('insert into material_disposals')) {
    const [code, material_id, quantity, reason, disposal_type, remarks, recorded_by_id] = params;
    const id = getNextId('material_disposals');
    fallbackStore.material_disposals.push({ id, disposal_code: code, material_id, quantity: Number(quantity), disposal_type, reason, remarks, status: 'Pending Approval', recorded_by_id, approved_by_id: null, disposal_date: new Date().toISOString(), approved_at: null });
    finalizeStore();
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith('select * from material_disposals where id=?')) {
    const [id] = params;
    const d = byId('material_disposals', id);
    return [d ? [d] : []];
  }
  if (normalized.startsWith('update material_disposals set status=')) {
    const [approved_by_id, id] = params;
    const d = byId('material_disposals', id);
    if (d) {
      d.status = 'Approved';
      d.approved_by_id = approved_by_id;
      d.approved_at = new Date().toISOString();
    }
    finalizeStore();
    return [{ affectedRows: d ? 1 : 0 }];
  }

  if (normalized.startsWith('select setting_key,setting_value from system_settings')) {
    return [fallbackStore.system_settings];
  }
  if (normalized.startsWith('insert into system_settings')) {
    const [setting_key, setting_value, setting_value2] = params;
    const existing = fallbackStore.system_settings.find(s => s.setting_key === setting_key);
    if (existing) {
      existing.setting_value = setting_value;
      existing.updated_at = new Date().toISOString();
    } else {
      const id = getNextId('system_settings');
      fallbackStore.system_settings.push({ id, setting_key, setting_value, updated_at: new Date().toISOString() });
    }
    finalizeStore();
    return [{ affectedRows: 1 }];
  }

  if (normalized.startsWith('select * from audit_logs order by id desc limit ? offset ?')) {
    const [limit, offset] = params;
    return [orderBy(fallbackStore.audit_logs, 'id', 'desc').slice(offset, offset + limit)];
  }

  throw new Error(`Fallback SQL handler does not support this query: ${sql}`);
}

export async function initializeDatabase() {
  const maxRetries  = 3;
  const retryDelay  = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔌 Connecting to MySQL (attempt ${attempt}/${maxRetries})…`);

      const root = await mysql.createConnection({
        host:           dbConfig.host,
        port:           dbConfig.port,
        user:           dbConfig.user,
        password:       dbConfig.password,
        connectTimeout: 8000,
        enableKeepAlive: true,
      });
      await root.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
      await root.end();

      pool = mysql.createPool(dbConfig);

      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(sql);
      }

      const migrationsDir = path.join(__dirname, 'migrations');
      if (fs.existsSync(migrationsDir)) {
        const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        for (const file of migrationFiles) {
          const migPath = path.join(migrationsDir, file);
          const migSql = fs.readFileSync(migPath, 'utf8');
          await pool.query(migSql);
        }
      }

      usingFallback = false;
      console.log('✅ MySQL connected:', dbConfig.database);
      // ----- Migration from fallback JSON store to remote DB if remote is empty -----
      try {
        const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM users');
        if (count === 0) {
          console.log('🔄 Remote DB is empty – migrating data from local fallback store...');
          loadFallbackStore();
          const migrationOrder = [
            'users',
            'categories',
            'suppliers',
            'employees_departments',
            'materials',
            'stock_transactions',
            'stock_transfers',
            'audit_logs',
            'system_settings',
            'material_requests',
            'material_disposals',
          ];
          for (const tbl of migrationOrder) {
            const rows = fallbackStore[tbl] || [];
            if (!rows.length) continue;
            for (const row of rows) {
              const columns = Object.keys(row).filter(k => k !== 'id');
              const placeholders = columns.map(() => '?').join(',');
              const sql = `INSERT INTO ${tbl} (${columns.join(',')}) VALUES (${placeholders})`;
              const values = columns.map(col => row[col]);
              await pool.query(sql, values);
            }
            console.log(`✅ Migrated ${rows.length} rows into ${tbl}`);
          }
          console.log('🎉 Migration completed. Remote DB now contains all previous data.');
        }
      } catch (migErr) {
        console.error('❌ Migration failed:', migErr);
      }

      // Always sync MySQL → fallback-store.json on startup
      await syncMySQLToFallback();
      return pool;

    } catch (err) {
      console.error(`❌ MySQL connection attempt ${attempt} failed:`, err.message);
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelay / 1000}s…`);
        await new Promise(r => setTimeout(r, retryDelay));
      } else {
        console.warn('⚠️ Cannot connect to MySQL. Falling back to local persistent JSON store.');
        console.warn('⚙️ Current connection config:', JSON.stringify({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.user,
          database: dbConfig.database,
          socketPath: dbConfig.socketPath || 'not configured'
        }, null, 2));
        usingFallback = true;
        loadFallbackStore();
        // Ensure the fallback store has initial seeded data on fresh machines
        try {
          await seedFallbackStore();
        } catch (e) {
          console.warn('⚠️ Failed to seed fallback store:', e.message);
        }
        pool = { query: (sql, params) => Promise.resolve(queryFallback(sql, params)) };
        console.log(`✅ Resilient fallback persistence enabled: ${fallbackFile}`);
        return pool;
      }
    }
  }
}

async function seedFallbackStore() {
  if (!fallbackStore.users.length) {
    fallbackStore.users.push(
      { id: getNextId('users'), username: 'admin',      password_hash: 'admin123',    full_name: 'System Administrator', email: 'admin@store.org',      role: 'Administrator', status: 'Active', avatar_url: null, created_at: new Date().toISOString() },
      { id: getNextId('users'), username: 'manager',    password_hash: 'manager123',  full_name: 'Store Manager',        email: 'manager@store.org',    role: 'Store Manager', status: 'Active', avatar_url: null, created_at: new Date().toISOString() },
      { id: getNextId('users'), username: 'storekeeper',password_hash: 'keeper123',   full_name: 'Alex Storekeeper',     email: 'keeper@store.org',     role: 'Storekeeper', status: 'Active', avatar_url: null, created_at: new Date().toISOString() },
      { id: getNextId('users'), username: 'auditor',    password_hash: 'auditor123',  full_name: 'Grace Auditor',        email: 'auditor@store.org',    role: 'Auditor', status: 'Active', avatar_url: null, created_at: new Date().toISOString() }
    );
  }

  if (!fallbackStore.categories.length) {
    fallbackStore.categories.push(
      { id: getNextId('categories'), name: 'Electronics & IT',    description: 'Computers, printers, networking, accessories', created_at: new Date().toISOString() },
      { id: getNextId('categories'), name: 'Office Supplies',     description: 'Paper, pens, folders, stationery', created_at: new Date().toISOString() },
      { id: getNextId('categories'), name: 'Safety & PPE',        description: 'Helmets, gloves, safety boots, high-vis vests', created_at: new Date().toISOString() },
      { id: getNextId('categories'), name: 'Hardware & Tools',     description: 'Power tools, hand tools, fasteners', created_at: new Date().toISOString() },
      { id: getNextId('categories'), name: 'Furniture & Fixtures', description: 'Desks, chairs, cabinets, lamps', created_at: new Date().toISOString() }
    );
  }

  if (!fallbackStore.suppliers.length) {
    fallbackStore.suppliers.push(
      { id: getNextId('suppliers'), supplier_code: 'SUP-001', name: 'TechCorp Solutions',    contact_person:'Robert Vance',  email:'contact@techcorp.com',   phone:'+1-555-0192', address:'100 Innovation Way, Suite 400', created_at:new Date().toISOString() },
      { id: getNextId('suppliers'), supplier_code: 'SUP-002', name: 'Global Office Supplies',contact_person:'Sarah Jenkins', email:'sales@globaloffice.com', phone:'+1-555-0482', address:'45 Station Road, Bldg B', created_at:new Date().toISOString() },
      { id: getNextId('suppliers'), supplier_code: 'SUP-003', name: 'SafetyFirst Logistics', contact_person:'Marcus Brody',  email:'orders@safetyfirst.org', phone:'+1-555-0773', address:'88 Industrial Park Drive', created_at:new Date().toISOString() }
    );
  }

  if (!fallbackStore.employees_departments.length) {
    fallbackStore.employees_departments.push(
      { id: getNextId('employees_departments'), type:'Employee',  code:'EMP-101', name:'David Miller',          department_name:'IT Support',     contact_number:'+1-555-1111', email:'david.m@store.org', created_at:new Date().toISOString() },
      { id: getNextId('employees_departments'), type:'Employee',  code:'EMP-102', name:'Elena Rostova',         department_name:'Operations',     contact_number:'+1-555-2222', email:'elena.r@store.org', created_at:new Date().toISOString() },
      { id: getNextId('employees_departments'), type:'Department',code:'DEP-001', name:'IT Infrastructure Dept',department_name:'IT Department', contact_number:'+1-555-3333', email:'it-dept@store.org', created_at:new Date().toISOString() },
      { id: getNextId('employees_departments'), type:'Department',code:'DEP-002', name:'Human Resources',       department_name:'HR',              contact_number:'+1-555-4444', email:'hr-dept@store.org', created_at:new Date().toISOString() }
    );
  }

  if (!fallbackStore.materials.length) {
    fallbackStore.materials.push(
      { id: getNextId('materials'), material_code:'MAT-1001', name:'Dell Latitude Laptop 5430',      category_id:1, unit_of_measure:'Unit', specifications:'Core i7, 16GB RAM, 512GB SSD', min_stock_level:5, current_stock:14, unit_cost:950.00, supplier_id:1, location:'Rack A-12', barcode:'890123456001', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
      { id: getNextId('materials'), material_code:'MAT-1002', name:'HP LaserJet Pro Printer M404dn', category_id:1, unit_of_measure:'Unit', specifications:'Monochrome Duplex Laser Printer', min_stock_level:3, current_stock:2, unit_cost:320.00, supplier_id:1, location:'Rack A-15', barcode:'890123456002', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
      { id: getNextId('materials'), material_code:'MAT-2001', name:'A4 Printing Paper (Box 5 reams)', category_id:2, unit_of_measure:'Box', specifications:'80gsm Bright White Paper', min_stock_level:10, current_stock:45, unit_cost:28.50, supplier_id:2, location:'Shelf B-04', barcode:'890123456003', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
      { id: getNextId('materials'), material_code:'MAT-2002', name:'Ergonomic Mesh Executive Chair',  category_id:5, unit_of_measure:'Unit', specifications:'Adjustable lumbar support & armrests', min_stock_level:4, current_stock:8, unit_cost:185.00, supplier_id:2, location:'Floor C-01', barcode:'890123456004', created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
      { id: getNextId('materials'), material_code:'MAT-3001', name:'Industrial Hard Hat (ANSI)',       category_id:3, unit_of_measure:'Pcs', specifications:'High-density polyethylene safety helmet', min_stock_level:15, current_stock:6, unit_cost:22.00, supplier_id:3, location:'Cabinet S-02', barcode:'890123456005', created_at:new Date().toISOString(), updated_at:new Date().toISOString() }
    );
  }

  if (!fallbackStore.stock_transactions.length) {
    fallbackStore.stock_transactions.push(
      { id: getNextId('stock_transactions'), transaction_code:'TX-IN-001', transaction_type:'STOCK_IN', material_id:1, quantity:15, unit_cost:950.00, supplier_id:1, employee_dept_id:null, purpose:'Initial Procurement Stock In', issued_by_id:1, approved_by_id:2, store_location:'Rack A-12', remarks:'Received in good condition', transaction_date:new Date().toISOString() },
      { id: getNextId('stock_transactions'), transaction_code:'TX-OUT-001', transaction_type:'STOCK_OUT', material_id:1, quantity:1, unit_cost:950.00, supplier_id:null, employee_dept_id:1, purpose:'New staff onboarding deployment', issued_by_id:3, approved_by_id:2, store_location:'Rack A-12', remarks:'Issued to David Miller', transaction_date:new Date().toISOString() },
      { id: getNextId('stock_transactions'), transaction_code:'TX-IN-002', transaction_type:'STOCK_IN', material_id:3, quantity:50, unit_cost:28.50, supplier_id:2, employee_dept_id:null, purpose:'Quarterly stationery restock', issued_by_id:3, approved_by_id:2, store_location:'Shelf B-04', remarks:'Supplier PO #9021', transaction_date:new Date().toISOString() }
    );
  }

  if (!fallbackStore.audit_logs.length) {
    fallbackStore.audit_logs.push(
      { id: getNextId('audit_logs'), user_id:1, username:'admin', user_role:'Administrator', action_type:'SYSTEM_INIT', description:'System tables and default data initialized', ip_address:'127.0.0.1', created_at:new Date().toISOString() },
      { id: getNextId('audit_logs'), user_id:3, username:'storekeeper', user_role:'Storekeeper', action_type:'STOCK_IN', description:'Received 15 units of MAT-1001 Dell Laptops', ip_address:'127.0.0.1', created_at:new Date().toISOString() },
      { id: getNextId('audit_logs'), user_id:3, username:'storekeeper', user_role:'Storekeeper', action_type:'STOCK_OUT', description:'Issued 1 unit of MAT-1001 to David Miller', ip_address:'127.0.0.1', created_at:new Date().toISOString() }
    );
  }

  finalizeStore();
}

// ── Seed default rows on empty database ─────────────────────
async function ensureRowExists(selectSql, selectParams, insertSql, insertParams) {
  const [[{ count }]] = await pool.query(selectSql, selectParams);
  if (count === 0) {
    await pool.query(insertSql, insertParams);
  }
}

async function seedInitialData() {
  const userSeeds = [
    { username: 'admin', password: 'admin123', full_name: 'System Administrator', email: 'admin@store.org', role: 'Administrator' },
    { username: 'manager', password: 'manager123', full_name: 'Store Manager', email: 'manager@store.org', role: 'Store Manager' },
    { username: 'storekeeper', password: 'keeper123', full_name: 'Alex Storekeeper', email: 'storekeeper@store.org', role: 'Storekeeper' },
    { username: 'auditor', password: 'auditor123', full_name: 'Grace Auditor', email: 'auditor@store.org', role: 'Auditor' },
  ];

  for (const user of userSeeds) {
    await ensureRowExists(
      'SELECT COUNT(*) AS count FROM users WHERE username = ?',
      [user.username],
      'INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)',
      [user.username, user.password, user.full_name, user.email, user.role],
    );
  }

  const categorySeeds = [
    { name: 'Electronics & IT', description: 'Computers, printers, networking, accessories' },
    { name: 'Office Supplies', description: 'Paper, pens, folders, stationery' },
    { name: 'Safety & PPE', description: 'Helmets, gloves, safety boots, high-vis vests' },
    { name: 'Hardware & Tools', description: 'Power tools, hand tools, fasteners' },
    { name: 'Furniture & Fixtures', description: 'Desks, chairs, cabinets, lamps' },
  ];

  for (const category of categorySeeds) {
    await ensureRowExists(
      'SELECT COUNT(*) AS count FROM categories WHERE name = ?',
      [category.name],
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [category.name, category.description],
    );
  }

  const supplierSeeds = [
    { supplier_code: 'SUP-001', name: 'TechCorp Solutions', contact_person: 'Robert Vance', email: 'contact@techcorp.com', phone: '+1-555-0192', address: '100 Innovation Way, Suite 400' },
    { supplier_code: 'SUP-002', name: 'Global Office Supplies', contact_person: 'Sarah Jenkins', email: 'sales@globaloffice.com', phone: '+1-555-0482', address: '45 Station Road, Bldg B' },
    { supplier_code: 'SUP-003', name: 'SafetyFirst Logistics', contact_person: 'Marcus Brody', email: 'orders@safetyfirst.org', phone: '+1-555-0773', address: '88 Industrial Park Drive' },
  ];

  for (const supplier of supplierSeeds) {
    await ensureRowExists(
      'SELECT COUNT(*) AS count FROM suppliers WHERE supplier_code = ?',
      [supplier.supplier_code],
      'INSERT INTO suppliers (supplier_code, name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [supplier.supplier_code, supplier.name, supplier.contact_person, supplier.email, supplier.phone, supplier.address],
    );
  }

  const employeeSeeds = [
    { type: 'Employee', code: 'EMP-101', name: 'David Miller', department_name: 'IT Support', contact_number: '+1-555-1111', email: 'david.m@store.org' },
    { type: 'Employee', code: 'EMP-102', name: 'Elena Rostova', department_name: 'Operations', contact_number: '+1-555-2222', email: 'elena.r@store.org' },
    { type: 'Department', code: 'DEP-001', name: 'IT Infrastructure Dept', department_name: 'IT Department', contact_number: '+1-555-3333', email: 'it-dept@store.org' },
    { type: 'Department', code: 'DEP-002', name: 'Human Resources', department_name: 'HR', contact_number: '+1-555-4444', email: 'hr-dept@store.org' },
  ];

  for (const employee of employeeSeeds) {
    await ensureRowExists(
      'SELECT COUNT(*) AS count FROM employees_departments WHERE code = ?',
      [employee.code],
      'INSERT INTO employees_departments (type, code, name, department_name, contact_number, email) VALUES (?, ?, ?, ?, ?, ?)',
      [employee.type, employee.code, employee.name, employee.department_name, employee.contact_number, employee.email],
    );
  }

  const materialSeeds = [
    { code: 'MAT-1001', name: 'Dell Latitude Laptop 5430', category_id: 1, unit_of_measure: 'Unit', specifications: 'Core i7, 16GB RAM, 512GB SSD', min_stock_level: 5, current_stock: 14, unit_cost: 950.00, supplier_id: 1, location: 'Rack A-12', barcode: '890123456001' },
    { code: 'MAT-1002', name: 'HP LaserJet Pro Printer M404dn', category_id: 1, unit_of_measure: 'Unit', specifications: 'Monochrome Duplex Laser Printer', min_stock_level: 3, current_stock: 2, unit_cost: 320.00, supplier_id: 1, location: 'Rack A-15', barcode: '890123456002' },
    { code: 'MAT-2001', name: 'A4 Printing Paper (Box 5 reams)', category_id: 2, unit_of_measure: 'Box', specifications: '80gsm Bright White Paper', min_stock_level: 10, current_stock: 45, unit_cost: 28.50, supplier_id: 2, location: 'Shelf B-04', barcode: '890123456003' },
    { code: 'MAT-2002', name: 'Ergonomic Mesh Executive Chair', category_id: 5, unit_of_measure: 'Unit', specifications: 'Adjustable lumbar support & armrests', min_stock_level: 4, current_stock: 8, unit_cost: 185.00, supplier_id: 2, location: 'Floor C-01', barcode: '890123456004' },
    { code: 'MAT-3001', name: 'Industrial Hard Hat (ANSI)', category_id: 3, unit_of_measure: 'Pcs', specifications: 'High-density polyethylene safety helmet', min_stock_level: 15, current_stock: 6, unit_cost: 22.00, supplier_id: 3, location: 'Cabinet S-02', barcode: '890123456005' },
  ];

  for (const material of materialSeeds) {
    await ensureRowExists(
      'SELECT COUNT(*) AS count FROM materials WHERE material_code = ?',
      [material.code],
      `INSERT INTO materials (material_code, name, category_id, unit_of_measure, specifications, min_stock_level, current_stock, unit_cost, supplier_id, location, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [material.code, material.name, material.category_id, material.unit_of_measure, material.specifications, material.min_stock_level, material.current_stock, material.unit_cost, material.supplier_id, material.location, material.barcode],
    );
  }

  const transactionSeeds = [
    { code: 'TX-IN-001', transaction_type: 'STOCK_IN', material_id: 1, quantity: 15, unit_cost: 950.00, supplier_id: 1, employee_dept_id: null, purpose: 'Initial Procurement Stock In', issued_by_id: 1, approved_by_id: 2, store_location: 'Rack A-12', remarks: 'Received in good condition' },
    { code: 'TX-OUT-001', transaction_type: 'STOCK_OUT', material_id: 1, quantity: 1, unit_cost: 950.00, supplier_id: null, employee_dept_id: 1, purpose: 'New staff onboarding deployment', issued_by_id: 3, approved_by_id: 2, store_location: 'Rack A-12', remarks: 'Issued to David Miller' },
    { code: 'TX-IN-002', transaction_type: 'STOCK_IN', material_id: 3, quantity: 50, unit_cost: 28.50, supplier_id: 2, employee_dept_id: null, purpose: 'Quarterly stationery restock', issued_by_id: 3, approved_by_id: 2, store_location: 'Shelf B-04', remarks: 'Supplier PO #9021' },
  ];

  for (const tx of transactionSeeds) {
    await ensureRowExists(
      'SELECT COUNT(*) AS count FROM stock_transactions WHERE transaction_code = ?',
      [tx.code],
      `INSERT INTO stock_transactions (transaction_code, transaction_type, material_id, quantity, unit_cost, supplier_id, employee_dept_id, purpose, issued_by_id, approved_by_id, store_location, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tx.code, tx.transaction_type, tx.material_id, tx.quantity, tx.unit_cost, tx.supplier_id, tx.employee_dept_id, tx.purpose, tx.issued_by_id, tx.approved_by_id, tx.store_location, tx.remarks],
    );
  }

  const auditSeeds = [
    { user_id: 1, username: 'admin', user_role: 'Administrator', action_type: 'SYSTEM_INIT', description: 'System tables and default data initialized' },
    { user_id: 3, username: 'storekeeper', user_role: 'Storekeeper', action_type: 'STOCK_IN', description: 'Received 15 units of MAT-1001 Dell Laptops' },
    { user_id: 3, username: 'storekeeper', user_role: 'Storekeeper', action_type: 'STOCK_OUT', description: 'Issued 1 unit of MAT-1001 to David Miller' },
  ];

  for (const log of auditSeeds) {
    await ensureRowExists(
      'SELECT COUNT(*) AS count FROM audit_logs WHERE action_type = ? AND description = ?',
      [log.action_type, log.description],
      'INSERT INTO audit_logs (user_id, username, user_role, action_type, description) VALUES (?, ?, ?, ?, ?)',
      [log.user_id, log.username, log.user_role, log.action_type, log.description],
    );
  }
}

// ── Sync MySQL → fallback-store.json ─────────────────────────
// Called at startup and after every user write so the JSON file
// always has the latest data and travels with the codebase.
export async function syncMySQLToFallback() {
  if (usingFallback) return;
  try {
    // Make sure the fallbackStore object is loaded first
    if (!fallbackStore) loadFallbackStore();

    const tablesWithId = [
      'users', 'categories', 'suppliers', 'employees_departments',
      'materials', 'stock_transactions', 'stock_transfers',
      'audit_logs', 'material_requests', 'material_disposals'
    ];

    for (const table of tablesWithId) {
      try {
        const [rows] = await pool.query(`SELECT * FROM \`${table}\` ORDER BY id ASC`);
        fallbackStore[table] = rows.map(r => {
          const out = {};
          for (const [k, v] of Object.entries(r)) {
            if (v instanceof Date)   out[k] = v.toISOString();
            else if (Buffer.isBuffer(v)) out[k] = v.toString();
            else out[k] = v;
          }
          return out;
        });
        const maxId = fallbackStore[table].reduce((m, row) => Math.max(m, Number(row.id || 0)), 0);
        fallbackStore.meta.nextId[table] = maxId + 1;
      } catch { /* skip tables that may not exist yet */ }
    }

    // system_settings uses setting_key as PK, not id
    try {
      const [rows] = await pool.query('SELECT * FROM system_settings ORDER BY setting_key ASC');
      fallbackStore['system_settings'] = rows.map(r => {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
          if (v instanceof Date) out[k] = v.toISOString();
          else out[k] = v;
        }
        return out;
      });
    } catch { /* skip if not ready */ }

    saveFallbackStore();
    console.log('💾 fallback-store.json synced — users:', fallbackStore.users.length);
  } catch (e) {
    console.warn('⚠️  Sync skipped:', e.message);
  }
}

// ── Exports ──────────────────────────────────────────────────
export function getPool() { return pool; }
export function getIsUsingFallback() { return usingFallback; }
export function getFallbackStore() { return fallbackStore; }
