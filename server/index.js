import multer from 'multer';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { exec } from 'child_process';
import { initializeDatabase, getPool, getIsUsingFallback, syncMySQLToFallback } from './db/db.js';
import { logAudit } from './services/auditLogger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


// ── Role-based permission map ─────────────────────────────────
// Every permission string used by requirePermission() must appear here
// for at least one role, otherwise that route is effectively unreachable.
const ROLE_PERMISSIONS = {
  Administrator: [
    // User management
    'user:create','user:edit','user:delete','user:resetPassword','user:statusChange',
    // Materials
    'material:create','material:update','material:delete',
    // Categories
    'category:create','category:update','category:delete',
    // Suppliers
    'supplier:create','supplier:update','supplier:delete',
    // Employees / Departments
    'employee:create','employee:update','employee:delete',
    // Inventory
    'inventory:stockIn','inventory:stockOut','inventory:return',
    'inventory:adjust','inventory:transfer',
    // Requests & Disposals
    'material:request:manage','disposal:create','disposal:approve',
    // System
    'system:auditLogs','system:configure',
  ],
  'Store Manager': [
    // Materials
    'material:create','material:update',
    // Categories
    'category:create','category:update',
    // Suppliers
    'supplier:create','supplier:update',
    // Employees / Departments
    'employee:create','employee:update',
    // Inventory
    'inventory:stockIn','inventory:stockOut','inventory:return',
    'inventory:adjust','inventory:transfer',
    // Requests & Disposals
    'material:request:manage','disposal:create','disposal:approve',
    // User management (limited)
    'user:resetPassword','user:statusChange',
    // Audit logs (read-only)
    'system:auditLogs',
  ],
  Storekeeper: [
    // Materials — spec says Storekeeper can register + update basic info
    'material:create','material:update',
    // Inventory operations
    'inventory:stockIn','inventory:stockOut','inventory:return',
    'inventory:adjust',
    // Disposals (submit only, not approve)
    'disposal:create',
  ],
  Auditor: [
    // Read-only access to audit logs
    'system:auditLogs',
  ],
  Viewer: [
    // No write permissions — view only (enforced at frontend nav level)
  ],
};

/**
 * Check whether a user object has a given permission based on their role.
 * Async to allow future DB-backed permission overrides.
 */
async function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  const perms = ROLE_PERMISSIONS[user.role] || [];
  return perms.includes(permission);
}

/**
 * Return the full permission list for a user's role.
 */
async function getUserPermissions(user) {
  if (!user || !user.role) return [];
  return ROLE_PERMISSIONS[user.role] || [];
}

const app = express();
const PORT       = process.env.PORT       || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set. Add it to your .env file.');
  process.exit(1);
}
const BCRYPT_ROUNDS = 10;

// ── ESM __dirname shim ────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Ensure avatars upload directory exists ────────────────────
const AVATARS_DIR = path.join(__dirname, '..', 'public', 'avatars');
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:5000", "http://localhost:5173", "blob:"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      fontSrc: ["'self'", "https:", "data:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:5000", "http://localhost:5173"],
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
// Serve uploaded avatar images as static files
app.use('/avatars', express.static(path.join(__dirname, '..', 'public', 'avatars')));
app.use(express.json({ limit: '6mb' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Image is too large. Please use an image under 5MB.' });
  }
  next(err);
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many login attempts' } });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 300, message: { error: 'Too many requests' } });
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ── Middleware ────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const allowed = await hasPermission(req.user, permission);
      if (!allowed) return res.status(403).json({ error: `Access denied. Required permission: ${permission}` });
      next();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  };
}

// ── Helpers ───────────────────────────────────────────────────
function validateRequired(obj, fields) {
  if (!obj || typeof obj !== 'object') return 'Request data is required';
  for (const f of fields)
    if (!Object.prototype.hasOwnProperty.call(obj, f) || obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === '')
      return `Field "${f}" is required`;
  return null;
}
function validatePositiveNumber(val, fieldName) {
  const n = parseFloat(val);
  if (isNaN(n) || n < 0) return `"${fieldName}" must be a non-negative number`;
  return null;
}
const toInt   = (v, d=0) => { const n=parseInt(v,10);  return isNaN(n)||n<0 ? d : n; };
const toFloat = (v, d=0) => { const n=parseFloat(v);   return isNaN(n)||n<0 ? d : n; };
const paginate = q => {
  const page  = Math.max(1, toInt(q.page,1));
  const limit = Math.min(200, Math.max(1, toInt(q.limit,50)));
  return { page, limit, offset:(page-1)*limit };
};

// ── System status ─────────────────────────────────────────────
app.get('/api/system/status', (_req, res) =>
  res.json({ status:'operational', dbMode:getIsUsingFallback() ? 'Fallback JSON Store' : 'MySQL Connected', usingFallback:getIsUsingFallback() })
);

// ── System Settings (GET/PUT) ────────────────────────────────────────
app.get('/api/system/settings', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Login ─────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error:'Username and password are required' });
  try {
    const [rows] = await getPool().query('SELECT * FROM users WHERE username=?', [username.trim()]);
    if (!rows.length) return res.status(401).json({ error:'Invalid username or password' });
    const user = rows[0];
    
    // Check global status
    if (user.status === 'Locked') return res.status(403).json({ error:'Account locked. Contact Administrator.' });
    if (user.status !== 'Active') return res.status(403).json({ error:'Account inactive. Contact Administrator.' });
    
    // Check temporary lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({ error: `Account temporarily locked due to too many failed attempts. Try again later.` });
    } else if (user.locked_until && new Date(user.locked_until) <= new Date()) {
      // Lockout expired, clear it
      await getPool().query('UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=?', [user.id]);
    }

    const ok = user.password_hash.startsWith('$2')
      ? await bcrypt.compare(password, user.password_hash)
      : user.password_hash === password;
      
    if (!ok) {
      // Handle failed attempt
      let maxAttempts = 5;
      let lockoutMins = 15;
      try {
        const [settings] = await getPool().query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('pwd_max_failed_attempts', 'pwd_lockout_duration_mins')");
        settings.forEach(s => {
          if (s.setting_key === 'pwd_max_failed_attempts') maxAttempts = parseInt(s.setting_value, 10) || 5;
          if (s.setting_key === 'pwd_lockout_duration_mins') lockoutMins = parseInt(s.setting_value, 10) || 15;
        });
      } catch (e) {}

      const fails = (user.failed_login_attempts || 0) + 1;
      if (fails >= maxAttempts) {
        const lockTime = new Date(Date.now() + lockoutMins * 60000);
        await getPool().query('UPDATE users SET failed_login_attempts=?, locked_until=? WHERE id=?', [fails, lockTime, user.id]);
        await logAudit(user.id, user.username, user.role, 'ACCOUNT_LOCKOUT', `Account locked for ${lockoutMins} mins after ${fails} failed logins`, req);
        return res.status(403).json({ error: `Account locked for ${lockoutMins} minutes due to too many failed attempts.` });
      } else {
        await getPool().query('UPDATE users SET failed_login_attempts=? WHERE id=?', [fails, user.id]);
        return res.status(401).json({ error:'Invalid username or password' });
      }
    }
    // Successful login – reset counters
    await getPool().query('UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=?', [user.id]);
    if (!user.password_hash.startsWith('$2')) {
      const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await getPool().query('UPDATE users SET password_hash=? WHERE id=?', [newHash, user.id]);
      await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [user.id, newHash]);
    }
    // Force password change / expiration check
    if (user.force_password_change) {
      return res.status(403).json({ error:'Password change required', require_password_change:true, user_id:user.id });
    }
    if (user.password_expires_at) {
      if (new Date(user.password_expires_at) <= new Date()) {
        return res.status(403).json({ error:'Password expired', require_password_change:true, user_id:user.id });
      }
    }
    const safe  = { id:user.id, username:user.username, full_name:user.full_name, email:user.email, role:user.role, avatar_url:user.avatar_url||null };
    // Session timeout from settings
    let sessionHours = 12;
    try {
      const [[row]] = await getPool().query("SELECT setting_value FROM system_settings WHERE setting_key='session_timeout'");
      if (row) sessionHours = Math.max(1, Math.min(168, parseInt(row.setting_value,10) || 12));
    } catch {}
    const token = jwt.sign(safe, JWT_SECRET, { expiresIn: `${sessionHours}h` });
    await logAudit(user.id, user.username, user.role, 'LOGIN', `${user.username} logged in`, req);
    return res.json({ user:safe, token });
  } catch(e) { return res.status(500).json({ error:e.message }); }
});

// ── Get user permissions ─────────────────────────────────────
app.get('/api/auth/permissions', requireAuth, async (req, res) => {
  try {
    const perms = await getUserPermissions(req.user);
    res.json({ permissions: perms });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Change own password ───────────────────────────────────────
// Password Policy Check Helper
async function checkPasswordPolicy(new_password, user_id) {
  try {
    const [policyRows] = await getPool().query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('pwd_min_length','pwd_max_length','pwd_require_uppercase','pwd_require_lowercase','pwd_require_number','pwd_require_special','pwd_history_count')"
    );
    const policy = {};
    policyRows.forEach(r => { policy[r.setting_key] = r.setting_value; });
    const historyCount = parseInt(policy.pwd_history_count || '3', 10);
    
    if ((policy.pwd_require_uppercase || 'true') === 'true' && !/[A-Z]/.test(new_password)) throw new Error('Password must contain at least one uppercase letter');
    if ((policy.pwd_require_lowercase || 'true') === 'true' && !/[a-z]/.test(new_password)) throw new Error('Password must contain at least one lowercase letter');
    if ((policy.pwd_require_number || 'true') === 'true' && !/[0-9]/.test(new_password)) throw new Error('Password must contain at least one number');
    if ((policy.pwd_require_special || 'false') === 'true' && !/[^A-Za-z0-9]/.test(new_password)) throw new Error('Password must contain at least one special character');

    if (historyCount > 0 && user_id) {
      const [history] = await getPool().query('SELECT password_hash FROM password_history WHERE user_id=? ORDER BY created_at DESC LIMIT ?', [user_id, historyCount]);
      for (const row of history) {
        if (await bcrypt.compare(new_password, row.password_hash)) {
          throw new Error(`Password has been used recently. Please choose a different password.`);
        }
      }
    }
  } catch (e) {
    if (e.message.includes('Password')) throw e;
  }
}

app.put('/api/auth/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: 'New password is required' });
  
  try {
    await checkPasswordPolicy(new_password, req.user.id);
  } catch(e) {
    return res.status(400).json({ error: e.message });
  }
  
  try {
    const [rows] = await getPool().query('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error:'User not found' });
    const u = rows[0];
    const ok = u.password_hash.startsWith('$2')
      ? await bcrypt.compare(current_password, u.password_hash) : u.password_hash === current_password;
    if (!ok) return res.status(401).json({ error:'Current password is incorrect' });
    
    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await getPool().query('UPDATE users SET password_hash=?, force_password_change=0 WHERE id=?', [newHash, req.user.id]);
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [req.user.id, newHash]);
    await logAudit(req.user.id, u.username, u.role, 'CHANGE_PASSWORD', 'Changed own password', req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/auth/force-change-password', async (req, res) => {
  const { user_id, current_password, new_password } = req.body;
  if (!user_id || !new_password || !current_password) return res.status(400).json({ error: 'Missing fields' });
  
  try {
    await checkPasswordPolicy(new_password, user_id);
  } catch(e) {
    return res.status(400).json({ error: e.message });
  }

  try {
    const [rows] = await getPool().query('SELECT * FROM users WHERE id=?', [user_id]);
    if (!rows.length) return res.status(404).json({ error:'User not found' });
    const u = rows[0];
    const ok = await bcrypt.compare(current_password, u.password_hash);
    if (!ok) return res.status(401).json({ error:'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await getPool().query('UPDATE users SET password_hash=?, force_password_change=0 WHERE id=?', [newHash, user_id]);
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [user_id, newHash]);
    await logAudit(user_id, u.username, u.role, 'CHANGE_PASSWORD', 'Completed forced password change', req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Update own profile ────────────────────────────────────────
app.put('/api/auth/update-profile', requireAuth, async (req, res) => {
  try {
    const { full_name, email, avatar_url, theme_preference } = req.body || {};

    // Validate required fields
    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    // Validate avatar is a data URL, absolute URL, or server-relative path
    if (avatar_url && typeof avatar_url === 'string' && avatar_url.length > 0) {
      if (!avatar_url.startsWith('data:image/') && !avatar_url.startsWith('http') && !avatar_url.startsWith('/avatars/') && !avatar_url.startsWith('/')) {
        return res.status(400).json({ error: 'Invalid image format.' });
      }
    }

    const preference = theme_preference || 'Light';
    const safeAvatar = (avatar_url && typeof avatar_url === 'string' && avatar_url.length > 0)
      ? avatar_url
      : null;

    await getPool().query(
      'UPDATE users SET full_name=?, email=?, avatar_url=?, theme_preference=? WHERE id=?',
      [String(full_name).trim(), email || null, safeAvatar, preference, req.user.id]
    );

    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_PROFILE', 'Updated profile', req);

    res.json({
      success: true,
      full_name: String(full_name).trim(),
      email: email || null,
      avatar_url: safeAvatar,
      theme_preference: preference,
    });
  } catch (e) {
    console.error('Profile update error:', e.message);
    res.status(500).json({ error: 'Failed to update profile. Please try again.' });
  }
});

// ── Avatar Upload (file saved to public/avatars/, not fallback JSON) ──
app.post('/api/auth/upload-avatar', requireAuth, async (req, res) => {
  try {
    const { avatar_data_url } = req.body || {};
    if (!avatar_data_url || typeof avatar_data_url !== 'string') {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    // Validate it is a real image data URL
    const match = avatar_data_url.match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Invalid image format. Accepted: JPEG, PNG, WebP, GIF.' });
    }

    const mimeType  = match[1].toLowerCase();
    const ext       = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : mimeType.includes('gif') ? 'gif' : 'jpg';
    const base64Data = match[3];

    // Enforce 5 MB limit on the decoded binary
    const byteLength = Buffer.byteLength(base64Data, 'base64');
    if (byteLength > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image is too large. Maximum size is 5 MB.' });
    }

    // Generate unique filename: userId_timestamp.ext
    const filename   = `avatar_${req.user.id}_${Date.now()}.${ext}`;
    const filepath   = path.join(AVATARS_DIR, filename);
    const avatarUrl  = `/avatars/${filename}`;

    // Delete old avatar file if it was a locally uploaded one
    try {
      const [[existing]] = await getPool().query('SELECT avatar_url FROM users WHERE id=?', [req.user.id]);
      if (existing?.avatar_url && existing.avatar_url.startsWith('/avatars/')) {
        const oldFile = path.join(__dirname, '..', 'public', existing.avatar_url);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }
    } catch { /* non-fatal: just skip deleting old file */ }

    // Write new file to disk
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filepath, buffer);

    // Persist avatar URL to database
    await getPool().query(
      'UPDATE users SET avatar_url=? WHERE id=?',
      [avatarUrl, req.user.id]
    );

    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_PROFILE', 'Updated avatar photo', req);

    // Return updated user profile
    const [[user]] = await getPool().query(
      'SELECT id,username,full_name,email,role,status,avatar_url,theme_preference FROM users WHERE id=?',
      [req.user.id]
    );

    res.json({ success: true, avatar_url: avatarUrl, user });
  } catch (e) {
    console.error('Avatar upload error:', e.message);
    res.status(500).json({ error: 'Failed to save avatar. Please try again.' });
  }
});

// ── Remove own avatar ──────────────────────────────────────────
app.delete('/api/auth/avatar', requireAuth, async (req, res) => {
  try {
    const [[existing]] = await getPool().query('SELECT avatar_url FROM users WHERE id=?', [req.user.id]);
    if (existing?.avatar_url && existing.avatar_url.startsWith('/avatars/')) {
      const oldFile = path.join(__dirname, '..', 'public', existing.avatar_url);
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }
    await getPool().query('UPDATE users SET avatar_url=NULL WHERE id=?', [req.user.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_PROFILE', 'Removed avatar photo', req);
    res.json({ success: true, avatar_url: null });
  } catch (e) {
    console.error('Avatar remove error:', e.message);
    res.status(500).json({ error: 'Failed to remove avatar.' });
  }
});

// ── Create Super Admin (disabled automatically once any admin exists) ────
app.post('/api/auth/create-superadmin', async (req, res) => {
  try {
    // Self-disable: if any Administrator already exists, block this endpoint
    const [admins] = await getPool().query("SELECT id FROM users WHERE role='Administrator' LIMIT 1");
    if (admins.length > 0) {
      return res.status(410).json({ error: 'Setup endpoint is disabled. An Administrator account already exists. Please log in normally.' });
    }
    const { secret, username, password, full_name, email } = req.body || {};
    const SETUP_SECRET = process.env.SETUP_SECRET || 'store-setup-2024';
    if (secret !== SETUP_SECRET) {
      return res.status(403).json({ error: 'Invalid setup secret.' });
    }
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'username, password, and full_name are required.' });
    }
    const [existing] = await getPool().query('SELECT id FROM users WHERE username=?', [username.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: `Username "${username}" already exists. Log in with that account.` });
    }
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [r] = await getPool().query(
      "INSERT INTO users (username,password_hash,full_name,email,role,status,theme_preference) VALUES (?,?,?,?,?,'Active','Light')",
      [username.trim(), hashed, full_name, email || null, 'Administrator']
    );
    res.json({
      success: true,
      message: 'Super admin created. Log in now.',
      id: r.insertId,
      username: username.trim(),
      role: 'Administrator',
    });
  } catch (e) {
    console.error('Create superadmin error:', e.message);
    res.status(500).json({ error: e.message });
  }
});
// ── Get current user profile ──────────────────────────────────
app.get('/api/users/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(
      'SELECT id,username,full_name,email,role,status,avatar_url,theme_preference,created_at FROM users WHERE id=?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Get user login history (last 50 LOGIN audit entries) ──────
app.get('/api/users/:id/login-history', requireAuth, async (req, res) => {
  // Admin can view anyone; users can view their own
  if (req.user.role !== 'Administrator' && String(req.params.id) !== String(req.user.id))
    return res.status(403).json({ error: 'Access denied' });
  try {
    const [rows] = await getPool().query(
      `SELECT id, action_type, description, ip_address, created_at
       FROM audit_logs
       WHERE user_id = ? AND action_type IN ('LOGIN','LOGOUT','CHANGE_PASSWORD','UPDATE_PROFILE')
       ORDER BY id DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Users ─────────────────────────────────────────────────────
app.get('/api/users', requireAuth, async (req, res) => {
  // Administrators see all users; Store Managers see read‑only list
  if (!await hasPermission(req.user, 'user:read')) {
    // Fallback: only allow if role is Administrator or Store Manager
    if (!['Administrator','Store Manager'].includes(req.user.role)) {
      return res.status(403).json({ error:'Access denied' });
    }
  }
  try {
    const [rows] = await getPool().query('SELECT id,username,full_name,email,role,status,avatar_url,theme_preference,created_at FROM users ORDER BY id ASC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/users', requireAuth, requirePermission('user:create'), async (req, res) => {
  const err = validateRequired(req.body, ['username','password','full_name','role']);
  if (err) return res.status(400).json({ error: err });
  const { username, password, full_name, email, role, avatar_url, theme_preference } = req.body;
  try {
    // ── Duplicate username check ──────────────────────────────
    const trimmedUsername = username.trim();
    const [existing] = await getPool().query(
      'SELECT id FROM users WHERE username = ?', [trimmedUsername]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        error: 'This username is already in use. Please choose another username.'
      });
    }

    // ── Duplicate full_name check (optional, warn only if name already exists) ──
    const [existingName] = await getPool().query(
      'SELECT id FROM users WHERE full_name = ?', [full_name]
    );
    if (existingName.length > 0) {
      return res.status(409).json({
        error: 'This name is already in use. Please choose another name.'
      });
    }

    if (email && email.trim() !== '') {
      const trimmedEmail = email.trim();
      const [existingEmail] = await getPool().query(
        'SELECT id FROM users WHERE email = ?', [trimmedEmail]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({
          error: 'This email is already registered. Please use another email.'
        });
      }
    }

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const preference = theme_preference || 'Light';
    let forceFirstLogin = 1;
    try {
      const [[s]] = await getPool().query("SELECT setting_value FROM system_settings WHERE setting_key='pwd_force_change_first_login'");
      if (s && s.setting_value === 'false') forceFirstLogin = 0;
    } catch {}

    const [r] = await getPool().query(
      'INSERT INTO users (username,password_hash,full_name,email,role,avatar_url,theme_preference,force_password_change) VALUES (?,?,?,?,?,?,?,?)',
      [trimmedUsername, hashed, full_name, email, role, avatar_url || null, preference, forceFirstLogin]
    );
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [r.insertId, hashed]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_USER', `Created user ${trimmedUsername} (${role})`, req);
    syncMySQLToFallback().catch(() => {});
    res.json({ id: r.insertId, username: trimmedUsername, full_name, email, role, status: 'Active', avatar_url: avatar_url || null, theme_preference: preference });
  } catch (e) {
    // MySQL duplicate key error (code 1062 / ER_DUP_ENTRY) — safety net
    if (e.code === 'ER_DUP_ENTRY' || (e.message && e.message.includes('Duplicate entry'))) {
      if (e.message && e.message.includes("'username'")) {
        return res.status(409).json({ error: 'This username is already in use. Please choose another username.' });
      }
      return res.status(409).json({ error: 'A user with this information already exists.' });
    }
    console.error('Error creating user:', e.message);
    res.status(500).json({ error: 'Failed to create user account. Please try again.' });
  }
});

app.put('/api/users/:id', requireAuth, requirePermission('user:edit'), async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(403).json({ error: 'Use Edit Profile to update your own account.' });
  }
  const { full_name, email, role, status, avatar_url, theme_preference } = req.body;
  try {
    if (email && email.trim() !== '') {
      const trimmedEmail = email.trim();
      const [existingEmail] = await getPool().query(
        'SELECT id FROM users WHERE email = ? AND id != ?', [trimmedEmail, req.params.id]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json({
          error: 'This email is already registered to another user.'
        });
      }
    }

    await getPool().query('UPDATE users SET full_name=?,email=?,role=?,status=?,avatar_url=?,theme_preference=? WHERE id=?',
      [full_name, email, role, status||'Active', avatar_url??null, theme_preference || 'Light', req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_USER', `Updated user #${req.params.id}`, req);
    syncMySQLToFallback().catch(() => {});
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/users/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['Active','Inactive','Locked'];
  if (!allowed.includes(status)) return res.status(400).json({ error:`Status must be: ${allowed.join(', ')}` });
  if (!(await hasPermission(req.user, 'user:statusChange'))) {
    return res.status(403).json({ error:'Access denied' });
  }
  try {
    const [[t]] = await getPool().query('SELECT id,role FROM users WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ error:'User not found' });
    if (req.user.role === 'Store Manager' && t.role === 'Administrator')
      return res.status(403).json({ error:'Cannot modify Administrator accounts' });
    await getPool().query('UPDATE users SET status=? WHERE id=?', [status, req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_USER_STATUS', `Set user #${req.params.id} to ${status}`, req);
    syncMySQLToFallback().catch(() => {});
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/users/:id/password', requireAuth, async (req, res) => {
  const { new_password, force_change } = req.body;
  if (!new_password) return res.status(400).json({ error: 'New password is required' });
  
  try {
    await checkPasswordPolicy(new_password, req.params.id);
  } catch(e) {
    return res.status(400).json({ error: e.message });
  }

  if (!(await hasPermission(req.user, 'user:resetPassword'))){
    return res.status(403).json({ error:'Access denied' });
  }
  try {
    const [[t]] = await getPool().query('SELECT id,role FROM users WHERE id=?', [req.params.id]);
    if (!t) return res.status(404).json({ error:'User not found' });
    if (req.user.role === 'Store Manager' && t.role === 'Administrator')
      return res.status(403).json({ error:'Cannot reset Administrator passwords' });
    
    // Check if we should force change on reset from system settings
    let force = force_change === true ? 1 : 0;
    if (force_change === undefined) {
      try {
        const [[s]] = await getPool().query("SELECT setting_value FROM system_settings WHERE setting_key='pwd_force_change_on_reset'");
        if (s && s.setting_value === 'true') force = 1;
      } catch {}
    }

    const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await getPool().query('UPDATE users SET password_hash=?, force_password_change=?, failed_login_attempts=0, locked_until=NULL WHERE id=?',
      [newHash, force, req.params.id]);
    await getPool().query('INSERT INTO password_history (user_id, password_hash) VALUES (?,?)', [req.params.id, newHash]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'RESET_PASSWORD', `Reset password for user #${req.params.id}`, req);
    syncMySQLToFallback().catch(() => {});
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.delete('/api/users/:id', requireAuth, requirePermission('user:delete'), async (req, res) => {
  if (String(req.params.id) === String(req.user.id))
    return res.status(400).json({ error:'Cannot delete your own account' });
  try {
    await getPool().query('DELETE FROM users WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_USER', `Deleted user #${req.params.id}`, req);
    syncMySQLToFallback().catch(() => {});
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Categories ────────────────────────────────────────────────
app.get('/api/categories', requireAuth, async (req, res) => {
  try { const [r] = await getPool().query('SELECT * FROM categories ORDER BY name ASC'); res.json(r); }
  catch(e) { res.status(500).json({ error:e.message }); }
});
app.post('/api/categories', requireAuth, requirePermission('category:create'), async (req, res) => {
  const err = validateRequired(req.body, ['name']);
  if (err) return res.status(400).json({ error:err });
  const { name, description } = req.body;
  try {
    const [r] = await getPool().query('INSERT INTO categories (name,description) VALUES (?,?)', [name.trim(), description||'']);
    res.json({ id:r.insertId, name:name.trim(), description:description||'' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.put('/api/categories/:id', requireAuth, requirePermission('category:update'), async (req, res) => {
  const { name, description } = req.body;
  try { await getPool().query('UPDATE categories SET name=?,description=? WHERE id=?', [name, description||'', req.params.id]); res.json({ success:true }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});
app.delete('/api/categories/:id', requireAuth, requirePermission('category:delete'), async (req, res) => {
  try { await getPool().query('DELETE FROM categories WHERE id=?', [req.params.id]); res.json({ success:true }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Suppliers ─────────────────────────────────────────────────
app.get('/api/suppliers', requireAuth, async (req, res) => {
  try { const [r] = await getPool().query('SELECT * FROM suppliers ORDER BY name ASC'); res.json(r); }
  catch(e) { res.status(500).json({ error:e.message }); }
});
app.post('/api/suppliers', requireAuth, requirePermission('supplier:create'), async (req, res) => {
  const err = validateRequired(req.body, ['name']);
  if (err) return res.status(400).json({ error:err });
  const { name, contact_person, email, phone, address } = req.body;
  const code = `SUP-${Math.floor(100+Math.random()*900)}`;
  try {
    const [r] = await getPool().query(
      'INSERT INTO suppliers (supplier_code,name,contact_person,email,phone,address) VALUES (?,?,?,?,?,?)',
      [code, name, contact_person, email, phone, address]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_SUPPLIER', `Added ${name}`, req);
    res.json({ id:r.insertId, supplier_code:code, name, contact_person, email, phone, address });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.put('/api/suppliers/:id', requireAuth, requirePermission('supplier:update'), async (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  try {
    await getPool().query('UPDATE suppliers SET name=?,contact_person=?,email=?,phone=?,address=? WHERE id=?',
      [name, contact_person, email, phone, address, req.params.id]);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.delete('/api/suppliers/:id', requireAuth, requirePermission('supplier:delete'), async (req, res) => {
  try {
    await getPool().query('DELETE FROM suppliers WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_SUPPLIER', `Deleted supplier #${req.params.id}`, req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Employees / Departments ───────────────────────────────────
app.get('/api/employees', requireAuth, async (req, res) => {
  try { const [r] = await getPool().query('SELECT * FROM employees_departments ORDER BY name ASC'); res.json(r); }
  catch(e) { res.status(500).json({ error:e.message }); }
});
app.post('/api/employees', requireAuth, requirePermission('employee:create'), async (req, res) => {
  const err = validateRequired(req.body, ['name','type']);
  if (err) return res.status(400).json({ error:err });
  const { type, name, department_name, contact_number, email } = req.body;
  const code = `${type==='Department'?'DEP':'EMP'}-${Math.floor(100+Math.random()*900)}`;
  try {
    const [r] = await getPool().query(
      'INSERT INTO employees_departments (type,code,name,department_name,contact_number,email) VALUES (?,?,?,?,?,?)',
      [type, code, name, department_name, contact_number, email]);
    res.json({ id:r.insertId, type, code, name, department_name, contact_number, email });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.put('/api/employees/:id', requireAuth, requirePermission('employee:update'), async (req, res) => {
  const { name, department_name, contact_number, email } = req.body;
  try {
    await getPool().query('UPDATE employees_departments SET name=?,department_name=?,contact_number=?,email=? WHERE id=?',
      [name, department_name, contact_number, email, req.params.id]);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.delete('/api/employees/:id', requireAuth, requirePermission('employee:delete'), async (req, res) => {
  try { await getPool().query('DELETE FROM employees_departments WHERE id=?', [req.params.id]); res.json({ success:true }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Materials ─────────────────────────────────────────────────
app.get('/api/materials', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT m.*, c.name AS category_name, s.name AS supplier_name
      FROM materials m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN suppliers  s ON m.supplier_id  = s.id
      ORDER BY m.id DESC`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.post('/api/materials', requireAuth, requirePermission('material:create'), async (req, res) => {
  const err = validateRequired(req.body, ['name','unit_of_measure']);
  if (err) return res.status(400).json({ error:err });
  const { material_code, name, category_id, unit_of_measure, specifications,
          min_stock_level, current_stock, unit_cost, supplier_id, location, barcode } = req.body;
  if (unit_cost !== undefined && (isNaN(parseFloat(unit_cost)) || parseFloat(unit_cost) < 0)) {
    return res.status(400).json({ error: 'Unit cost must be a non-negative number' });
  }
  if (min_stock_level !== undefined && (isNaN(parseInt(min_stock_level)) || parseInt(min_stock_level) < 0)) {
    return res.status(400).json({ error: 'Minimum stock level must be a non-negative number' });
  }
  const code = material_code || `MAT-${Math.floor(1000+Math.random()*9000)}`;
  const bar  = barcode       || `890123${Math.floor(100000+Math.random()*900000)}`;
  try {
    const [r] = await getPool().query(
      `INSERT INTO materials (material_code,name,category_id,unit_of_measure,specifications,
        min_stock_level,current_stock,unit_cost,supplier_id,location,barcode)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [code, name, category_id||null, unit_of_measure, specifications||'',
       toInt(min_stock_level,5), toInt(current_stock,0), toFloat(unit_cost,0),
       supplier_id||null, location||'Main Warehouse', bar]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_MATERIAL', `Registered ${name} (${code})`, req);
    res.json({ id:r.insertId, material_code:code, name, unit_of_measure, barcode:bar });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.put('/api/materials/:id', requireAuth, requirePermission('material:update'), async (req, res) => {
  const { name, category_id, unit_of_measure, specifications,
          min_stock_level, unit_cost, supplier_id, location } = req.body;
  try {
    await getPool().query(
      `UPDATE materials SET name=?,category_id=?,unit_of_measure=?,specifications=?,
        min_stock_level=?,unit_cost=?,supplier_id=?,location=? WHERE id=?`,
      [name, category_id||null, unit_of_measure, specifications,
       toInt(min_stock_level,5), toFloat(unit_cost,0), supplier_id||null, location, req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_MATERIAL', `Updated material #${req.params.id}`, req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.delete('/api/materials/:id', requireAuth, requirePermission('material:delete'), async (req, res) => {
  try {
    await getPool().query('DELETE FROM materials WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_MATERIAL', `Deleted material #${req.params.id}`, req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Transactions ──────────────────────────────────────────────
app.get('/api/transactions', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM stock_transactions');
    const [rows] = await getPool().query(`
      SELECT t.*, 
         m.name as material_name, m.material_code, m.unit_of_measure,
         s.name as supplier_name,
         ed.name as receiver_name,
         u1.full_name as issued_by_name,
         u2.full_name as approved_by_name,
         t.payment_method
      FROM stock_transactions t
      LEFT JOIN materials m            ON t.material_id      = m.id
      LEFT JOIN suppliers s            ON t.supplier_id      = s.id
      LEFT JOIN employees_departments ed ON t.employee_dept_id = ed.id
      LEFT JOIN users u1               ON t.issued_by_id     = u1.id
      LEFT JOIN users u2               ON t.approved_by_id   = u2.id
      ORDER BY t.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ data:rows, total, page, limit });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/inventory/stock-in', requireAuth, requirePermission('inventory:stockIn'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id','quantity']);
  if (err) return res.status(400).json({ error:err });
  const { material_id, quantity, unit_cost, supplier_id, purpose, remarks, store_location, payment_method } = req.body;
  const qty = toInt(quantity); if (qty<=0) return res.status(400).json({ error:'Quantity must be > 0' });
  const cost = toFloat(unit_cost);
  const pMethod = payment_method || 'Cash';
  const code = `TX-IN-${Date.now()}`;
  try {
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code,transaction_type,material_id,quantity,unit_cost,supplier_id,purpose,issued_by_id,store_location,payment_method,remarks)
       VALUES (?,'STOCK_IN',?,?,?,?,?,?,?,?,?)`,
      [code, material_id, qty, cost, supplier_id||null, purpose||'Stock In', req.user.id, store_location||'Main Warehouse', pMethod, remarks]);
    await getPool().query('UPDATE materials SET current_stock=current_stock+?, unit_cost=IF(?>0,?,unit_cost) WHERE id=?', [qty,cost,cost,material_id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_IN', `Received ${qty} units for material #${material_id}`, req);
    res.json({ success:true, transaction_code:code });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/inventory/stock-out', requireAuth, requirePermission('inventory:stockOut'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id','quantity']);
  if (err) return res.status(400).json({ error:err });
  const { material_id, quantity, employee_dept_id, purpose, remarks } = req.body;
  const qty = toInt(quantity); if (qty<=0) return res.status(400).json({ error:'Quantity must be > 0' });
  const code = `TX-OUT-${Date.now()}`;
  try {
    // Check if manager approval is required for stock-out
    const [[approvalSetting]] = await getPool().query(
      "SELECT setting_value FROM system_settings WHERE setting_key='require_approval_stock_out'"
    ).catch(() => [[null]]);
    if (approvalSetting?.setting_value === 'true' && req.user.role === 'Storekeeper') {
      return res.status(403).json({
        error: 'Stock-out requires Manager approval. Please submit a Material Request instead.',
        requiresApproval: true,
      });
    }

    const [[mat]] = await getPool().query('SELECT current_stock,name FROM materials WHERE id=?', [material_id]);
    if (!mat) return res.status(404).json({ error:'Material not found' });
    if (mat.current_stock < qty) return res.status(400).json({ error:`Insufficient stock. Available: ${mat.current_stock}` });
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code,transaction_type,material_id,quantity,employee_dept_id,purpose,issued_by_id,remarks)
       VALUES (?,'STOCK_OUT',?,?,?,?,?,?)`,
      [code, material_id, qty, employee_dept_id||null, purpose||'Material Issue', req.user.id, remarks]);
    await getPool().query('UPDATE materials SET current_stock=current_stock-? WHERE id=?', [qty,material_id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_OUT', `Issued ${qty} units of ${mat.name}`, req);
    res.json({ success:true, transaction_code:code });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/inventory/return', requireAuth, requirePermission('inventory:return'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id','quantity']);
  if (err) return res.status(400).json({ error:err });
  const { material_id, quantity, employee_dept_id, remarks } = req.body;
  const qty = toInt(quantity); if (qty<=0) return res.status(400).json({ error:'Quantity must be > 0' });
  const code = `TX-RET-${Date.now()}`;
  try {
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code,transaction_type,material_id,quantity,employee_dept_id,purpose,issued_by_id,remarks)
       VALUES (?,'RETURN',?,?,?,'Material Return',?,?)`,
      [code, material_id, qty, employee_dept_id||null, req.user.id, remarks]);
    await getPool().query('UPDATE materials SET current_stock=current_stock+? WHERE id=?', [qty,material_id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_RETURN', `Returned ${qty} units for material #${material_id}`, req);
    res.json({ success:true, transaction_code:code });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/inventory/adjust', requireAuth, requirePermission('inventory:adjust'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id','new_quantity']);
  if (err) return res.status(400).json({ error:err });
  const { material_id, new_quantity, remarks } = req.body;
  const target = toInt(new_quantity);
  if (target < 0) return res.status(400).json({ error:'Target quantity must be >= 0' });
  const code   = `TX-ADJ-${Date.now()}`;
  try {
    const [[mat]] = await getPool().query('SELECT current_stock,name FROM materials WHERE id=?', [material_id]);
    if (!mat) return res.status(404).json({ error:'Material not found' });
    // Ensure resulting stock is not negative
   const diff = target - mat.current_stock;
   if (mat.current_stock + diff < 0) return res.status(400).json({ error:'Adjustment would result in negative stock' });
    await getPool().query(
      `INSERT INTO stock_transactions (transaction_code,transaction_type,material_id,quantity,purpose,issued_by_id,remarks)
       VALUES (?,'ADJUSTMENT',?,?,?,?,?)`,
      [code, material_id, diff, `Stock Adjustment (count: ${target})`, req.user.id, remarks]);
    await getPool().query('UPDATE materials SET current_stock=? WHERE id=?', [target, material_id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_ADJUSTMENT', `Adjusted ${mat.name} to ${target}`, req);
    res.json({ success:true, transaction_code:code });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Stock Transfers ───────────────────────────────────────────
app.get('/api/transfers', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM stock_transfers');
    const [rows] = await getPool().query(`
      SELECT t.*, m.name AS material_name, m.material_code, u.username AS transferred_by_name
      FROM stock_transfers t
      LEFT JOIN materials m ON t.material_id = m.id
      LEFT JOIN users u     ON t.transferred_by_id = u.id
      ORDER BY t.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ data:rows, total, page, limit });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/transfers', requireAuth, requirePermission('inventory:transfer'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id','quantity','source_location','destination_location']);
  if (err) return res.status(400).json({ error:err });
  const { material_id, quantity, source_location, destination_location, remarks } = req.body;
  const qty = toInt(quantity);
  if (qty<=0) return res.status(400).json({ error:'Quantity must be > 0' });
  if (source_location.trim()===destination_location.trim()) return res.status(400).json({ error:'Source and destination must differ' });
  const code = `TRF-${Date.now()}`;
  try {
    const [[mat]] = await getPool().query('SELECT current_stock,name FROM materials WHERE id=?', [material_id]);
    if (!mat) return res.status(404).json({ error:'Material not found' });
    if (mat.current_stock < qty) return res.status(400).json({ error:`Insufficient stock. Available: ${mat.current_stock}` });
    await getPool().query(
      `INSERT INTO stock_transfers (transfer_code,material_id,quantity,source_location,destination_location,transferred_by_id,remarks)
       VALUES (?,?,?,?,?,?,?)`,
      [code, material_id, qty, source_location, destination_location, req.user.id, remarks]);
    await getPool().query('UPDATE materials SET location=? WHERE id=?', [destination_location, material_id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'STOCK_TRANSFER', `Transferred ${qty} of ${mat.name}: ${source_location} → ${destination_location}`, req);
    res.json({ success:true, transfer_code:code });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Dashboard stats ───────────────────────────────────────────
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const [[{ total }]]       = await getPool().query('SELECT COUNT(*) AS total FROM materials');
    const [[{ low }]]         = await getPool().query('SELECT COUNT(*) AS low FROM materials WHERE current_stock <= min_stock_level');
    const [[{ val }]]         = await getPool().query('SELECT SUM(current_stock * unit_cost) AS val FROM materials');
    const [[{ txToday }]]     = await getPool().query('SELECT COUNT(*) AS txToday FROM stock_transactions WHERE DATE(transaction_date)=CURDATE()');
    const [[{ deptCount }]]   = await getPool().query("SELECT COUNT(*) AS deptCount FROM employees_departments WHERE type='Department'");
    const [[{ pendingCount }]]= await getPool().query("SELECT COUNT(*) AS pendingCount FROM material_requests WHERE status='Pending'");
    const [[{ userCount }]]   = await getPool().query("SELECT COUNT(*) AS userCount FROM users WHERE status='Active'");
    const [catStats]          = await getPool().query(`
      SELECT c.name AS category, COUNT(m.id) AS item_count, SUM(m.current_stock) AS stock_qty
      FROM categories c LEFT JOIN materials m ON c.id=m.category_id GROUP BY c.id`);
    res.json({
      totalMaterials:    total,
      lowStockCount:     low,
      totalStockValue:   parseFloat(val || 0),
      transactionsToday: txToday,
      departments:       deptCount,
      pendingOrders:     pendingCount,
      vendorMeetings:    userCount, // active users as a proxy for active staff
      categoryStats:     catStats,
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Audit logs ────────────────────────────────────────────────
app.get('/api/audit-logs', requireAuth, requirePermission('system:auditLogs'), async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM audit_logs');
    const [rows] = await getPool().query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
    res.json({ data:rows, total, page, limit });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Material Requests ─────────────────────────────────────────
app.get('/api/material-requests', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM material_requests');
    const [rows] = await getPool().query(`
      SELECT mr.*, m.name AS material_name, m.material_code, m.current_stock, m.unit_of_measure,
             u1.full_name AS requester_name, u1.username AS requester_username, u2.full_name AS approver_name
      FROM material_requests mr
      LEFT JOIN materials m ON mr.material_id    = m.id
      LEFT JOIN users u1    ON mr.requested_by_id = u1.id
      LEFT JOIN users u2    ON mr.approved_by_id  = u2.id
      ORDER BY mr.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ data:rows, total, page, limit });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/material-requests', requireAuth, async (req, res) => {
  const err = validateRequired(req.body, ['material_id','quantity']);
  if (err) return res.status(400).json({ error:err });
  const { material_id, quantity, purpose, priority, remarks } = req.body;
  const requestedQuantity = toInt(quantity);
  if (requestedQuantity <= 0) return res.status(400).json({ error:'Quantity must be > 0' });
  const code = `REQ-${Math.floor(1000+Math.random()*9000)}`;
  try {
    const [r] = await getPool().query(
      `INSERT INTO material_requests (request_code,material_id,quantity,purpose,priority,remarks,requested_by_id,status)
       VALUES (?,?,?,?,?,?,?,'Pending')`,
      [code, material_id, requestedQuantity, purpose, priority||'Normal', remarks, req.user.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_REQUEST', `Created request ${code}`, req);
    res.json({ id:r.insertId, request_code:code, status:'Pending' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/material-requests/:id/approve', requireAuth, requirePermission('material:request:manage'), async (req, res) => {
  try {
    await getPool().query(
      `UPDATE material_requests SET status='Approved',approved_by_id=?,approval_remarks=?,approved_at=NOW() WHERE id=?`,
      [req.user.id, req.body.remarks||'', req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'APPROVE_REQUEST', `Approved request #${req.params.id}`, req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/material-requests/:id/reject', requireAuth, requirePermission('material:request:manage'), async (req, res) => {
  try {
    await getPool().query(
      `UPDATE material_requests SET status='Rejected',approved_by_id=?,approval_remarks=?,approved_at=NOW() WHERE id=?`,
      [req.user.id, req.body.remarks||'', req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'REJECT_REQUEST', `Rejected request #${req.params.id}`, req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Disposals ─────────────────────────────────────────────────
app.get('/api/disposals', requireAuth, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const [[{ total }]] = await getPool().query('SELECT COUNT(*) AS total FROM material_disposals');
    const [rows] = await getPool().query(`
      SELECT d.*, m.name AS material_name, m.material_code, m.unit_of_measure,
             u1.full_name AS recorder_name, u2.full_name AS approver_name
      FROM material_disposals d
      LEFT JOIN materials m ON d.material_id    = m.id
      LEFT JOIN users u1    ON d.recorded_by_id  = u1.id
      LEFT JOIN users u2    ON d.approved_by_id  = u2.id
      ORDER BY d.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ data:rows, total, page, limit });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/disposals', requireAuth, requirePermission('disposal:create'), async (req, res) => {
  const err = validateRequired(req.body, ['material_id','quantity','reason']);
  if (err) return res.status(400).json({ error:err });
  const { material_id, quantity, reason, disposal_type, remarks } = req.body;
  const disposalQuantity = toInt(quantity);
  if (disposalQuantity <= 0) return res.status(400).json({ error:'Quantity must be > 0' });
  const code = `DISP-${Math.floor(1000+Math.random()*9000)}`;
  try {
    const [r] = await getPool().query(
      `INSERT INTO material_disposals (disposal_code,material_id,quantity,reason,disposal_type,remarks,recorded_by_id,status)
       VALUES (?,?,?,?,?,?,?,'Pending Approval')`,
      [code, material_id, disposalQuantity, reason, disposal_type||'Damaged', remarks, req.user.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_DISPOSAL', `Recorded disposal ${code}`, req);
    res.json({ id:r.insertId, disposal_code:code, status:'Pending Approval' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/disposals/:id/approve', requireAuth, requirePermission('disposal:approve'), async (req, res) => {
  try {
    const [[d]] = await getPool().query('SELECT * FROM material_disposals WHERE id=?', [req.params.id]);
    if (!d) return res.status(404).json({ error:'Disposal not found' });
    if (d.status !== 'Pending Approval') return res.status(400).json({ error: `Cannot approve a disposal with status: ${d.status}` });
    await getPool().query('UPDATE materials SET current_stock=GREATEST(0,current_stock-?) WHERE id=?', [d.quantity, d.material_id]);
    await getPool().query(`UPDATE material_disposals SET status='Approved',approved_by_id=?,approved_at=NOW() WHERE id=?`, [req.user.id, req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'APPROVE_DISPOSAL', `Approved disposal #${req.params.id}`, req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Reject disposal ───────────────────────────────────────────
app.put('/api/disposals/:id/reject', requireAuth, requirePermission('disposal:approve'), async (req, res) => {
  try {
    const [[d]] = await getPool().query('SELECT * FROM material_disposals WHERE id=?', [req.params.id]);
    if (!d) return res.status(404).json({ error: 'Disposal not found' });
    if (d.status !== 'Pending Approval') return res.status(400).json({ error: `Cannot reject a disposal with status: ${d.status}` });
    await getPool().query(
      `UPDATE material_disposals SET status='Rejected', approved_by_id=?, approved_at=NOW() WHERE id=?`,
      [req.user.id, req.params.id]
    );
    await logAudit(req.user.id, req.user.username, req.user.role, 'REJECT_DISPOSAL', `Rejected disposal #${req.params.id}`, req);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── System Settings ───────────────────────────────────────────
const DEFAULT_SETTINGS = {
  organization_name:'Store Management System', organization_logo:'',
  currency:'ETB', currency_symbol:'Br',
  low_stock_threshold:'5', session_timeout:'12',
  date_format:'DD/MM/YYYY', timezone:'UTC+3',
  allow_negative_stock:'false', require_approval_stock_out:'false',
  system_email:'',
  pwd_min_length:'8', pwd_require_uppercase:'true',
  pwd_require_number:'true', pwd_require_special:'false', pwd_expiry_days:'0',
  theme_presets:'', active_theme:'default',
};

app.get('/api/system-settings', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT setting_key,setting_value FROM system_settings');
    const settings = { ...DEFAULT_SETTINGS };
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/system-settings', requireAuth, requirePermission('system:configure'), async (req, res) => {
  const updates = req.body;
  if (typeof updates !== 'object' || Array.isArray(updates))
    return res.status(400).json({ error:'Body must be a key-value object' });
  try {
    for (const [key, value] of Object.entries(updates))
      await getPool().query(
        'INSERT INTO system_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?',
        [key, String(value), String(value)]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_SETTINGS', `Updated: ${Object.keys(updates).join(', ')}`, req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Backup export (JSON) ─────────────────────────────────────
app.get('/api/backup/export', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [materials]    = await getPool().query('SELECT * FROM materials');
    const [categories]   = await getPool().query('SELECT * FROM categories');
    const [suppliers]    = await getPool().query('SELECT * FROM suppliers');
    const [employees]    = await getPool().query('SELECT * FROM employees_departments');
    const [transactions] = await getPool().query('SELECT * FROM stock_transactions');
    const [transfers]    = await getPool().query('SELECT * FROM stock_transfers');
    const [users]        = await getPool().query('SELECT id,username,full_name,email,role,status,created_at FROM users');
    const [auditLogs]    = await getPool().query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1000');
    const data = { materials, categories, suppliers, employees, transactions, transfers, users, auditLogs, exportedAt:new Date().toISOString(), version:'3.0' };
    res.setHeader('Content-Type','application/json');
    res.setHeader('Content-Disposition',`attachment; filename="store_backup_${new Date().toISOString().slice(0,10)}.json"`);
    res.json(data);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── Backup management (SQL) ─────────────────────────────────────
app.get('/api/backups', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM backups ORDER BY created_at DESC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/backups', requireAuth, requirePermission('system:configure'), async (req, res) => {
  // Alias to trigger backup (same as /api/backup/trigger) for API consistency
  req.url = '/api/backup/trigger';
  app._router.handle(req, res);
});

app.get('/api/backups/:id/download', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [[b]] = await getPool().query('SELECT file_name FROM backups WHERE id=?', [req.params.id]);
    if (!b) return res.status(404).json({ error:'Backup not found' });
    const filePath = path.join(__dirname, '..', 'server', 'backups', b.file_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error:'File missing' });
    res.download(filePath, b.file_name);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/backups/:id/restore', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [[b]] = await getPool().query('SELECT file_name FROM backups WHERE id=?', [req.params.id]);
    if (!b) return res.status(404).json({ error:'Backup not found' });
    const filePath = path.join(__dirname, '..', 'server', 'backups', b.file_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error:'File missing' });
    // Execute mysql import
    const cmd = `mysql -u root store_management_db < "${filePath}"`;
    exec(cmd, async (error) => {
      if (error) {
        await logAudit(req.user.id, req.user.username, req.user.role, 'SYSTEM_RESTORE_FAILED', `Restore failed for backup ${b.file_name}`, req);
        return res.status(500).json({ error:'Restore failed' });
      }
      await logAudit(req.user.id, req.user.username, req.user.role, 'SYSTEM_RESTORE', `Restored backup ${b.file_name}`, req);
      res.json({ success:true, message:'Database restored' });
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.delete('/api/backups/:id', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    const [[b]] = await getPool().query('SELECT file_name FROM backups WHERE id=?', [req.params.id]);
    if (!b) return res.status(404).json({ error:'Backup not found' });
    const filePath = path.join(__dirname, '..', 'server', 'backups', b.file_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await getPool().query('DELETE FROM backups WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_BACKUP', `Deleted backup ${b.file_name}`, req);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});


// ── Warehouses ────────────────────────────────────────────────
app.get('/api/warehouses', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM warehouses ORDER BY name ASC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/warehouses', requireAuth, requirePermission('system:configure'), async (req, res) => {
  const { code, name, address, manager_name } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Code and name are required' });
  try {
    const [r] = await getPool().query('INSERT INTO warehouses (code, name, address, manager_name) VALUES (?, ?, ?, ?)', [code, name, address||'', manager_name||'']);
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_WAREHOUSE', `Created warehouse ${name}`, req);
    res.json({ id: r.insertId, code, name, address, manager_name });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/warehouses/:id', requireAuth, requirePermission('system:configure'), async (req, res) => {
  const { code, name, address, manager_name } = req.body;
  try {
    await getPool().query('UPDATE warehouses SET code=?, name=?, address=?, manager_name=? WHERE id=?', [code, name, address||'', manager_name||'', req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_WAREHOUSE', `Updated warehouse #${req.params.id}`, req);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/warehouses/:id', requireAuth, requirePermission('system:configure'), async (req, res) => {
  try {
    await getPool().query('DELETE FROM warehouses WHERE id=?', [req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'DELETE_WAREHOUSE', `Deleted warehouse #${req.params.id}`, req);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Purchase Orders ───────────────────────────────────────────
app.get('/api/purchase-orders', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT po.*, s.name as supplier_name, u.full_name as creator_name 
      FROM purchase_orders po 
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by_id = u.id
      ORDER BY po.id DESC
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/purchase-orders/:id/items', requireAuth, async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT poi.*, m.name as material_name, m.material_code, m.unit_of_measure 
      FROM po_items poi 
      LEFT JOIN materials m ON poi.material_id = m.id
      WHERE poi.po_id = ?
    `, [req.params.id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/purchase-orders', requireAuth, async (req, res) => {
  const { supplier_id, expected_date, remarks, items } = req.body;
  if (!supplier_id || !items || !items.length) return res.status(400).json({ error: 'Supplier and items are required' });
  
  const po_number = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
  let total_amount = 0;
  items.forEach(item => total_amount += (item.quantity_ordered * item.unit_cost));
  
  try {
    const [r] = await getPool().query(`
      INSERT INTO purchase_orders (po_number, supplier_id, expected_date, remarks, total_amount, created_by_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Draft')
    `, [po_number, supplier_id, expected_date, remarks, total_amount, req.user.id]);
    
    const po_id = r.insertId;
    
    for (const item of items) {
      await getPool().query(`
        INSERT INTO po_items (po_id, material_id, quantity_ordered, unit_cost)
        VALUES (?, ?, ?, ?)
      `, [po_id, item.material_id, item.quantity_ordered, item.unit_cost]);
    }
    
    await logAudit(req.user.id, req.user.username, req.user.role, 'CREATE_PO', `Created Purchase Order ${po_number}`, req);
    res.json({ id: po_id, po_number, status: 'Draft' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/purchase-orders/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  try {
    await getPool().query('UPDATE purchase_orders SET status=? WHERE id=?', [status, req.params.id]);
    await logAudit(req.user.id, req.user.username, req.user.role, 'UPDATE_PO', `Updated PO #${req.params.id} to ${status}`, req);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Document Uploads (Transaction Attachments) ────────────────

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOADS_DIR); },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')); }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.originalname });
});

// ── Bulk Import (Materials) ───────────────────────────────────
app.post('/api/import/materials', requireAuth, requirePermission('material:create'), async (req, res) => {
  const { items } = req.body; // Array of objects
  if (!items || !items.length) return res.status(400).json({ error: 'No data provided' });
  let successCount = 0;
  let errors = [];
  try {
    for (const item of items) {
      try {
        await getPool().query(`
          INSERT INTO materials (material_code, name, category_id, unit_of_measure, min_stock_level, current_stock, unit_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [item.material_code, item.name, item.category_id || null, item.unit_of_measure || 'Pcs', item.min_stock_level || 0, item.current_stock || 0, item.unit_cost || 0]);
        successCount++;
      } catch (e) {
        errors.push({ code: item.material_code, error: e.message });
      }
    }
    await logAudit(req.user.id, req.user.username, req.user.role, 'BULK_IMPORT', `Imported ${successCount} materials`, req);
    res.json({ success: true, imported: successCount, errors });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DB Backup (mysqldump) ─────────────────────────────────────
app.post('/api/backup/trigger', requireAuth, requirePermission('system:configure'), (req, res) => {
  const backupDir = path.join(__dirname, '..', 'server', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const filename = `backup_${Date.now()}.sql`;
  const filepath = path.join(backupDir, filename);
  
  // Note: requires mysqldump in PATH. Hardcoding user/pass for local environment
  const cmd = `mysqldump -u root store_management_db > "${filepath}"`;
  exec(cmd, async (error) => {
    if (error) {
      console.error('Backup failed:', error);
      return res.status(500).json({ error: 'Backup failed' });
    }
    const { size } = fs.statSync(filepath);
    await getPool().query(
      'INSERT INTO backups (file_name,status,size_bytes,type,created_by) VALUES (?,\'Success\',?,\'Manual\',?)',
      [filename, size, req.user.id]
    );
    await logAudit(req.user.id, req.user.username, req.user.role, 'SYSTEM_BACKUP', 'Triggered database backup', req);
    res.json({ success: true, filename });
  });
});


// ── Error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status||500).json({ error:err.message||'Internal Server Error' });
});

// ── Start ─────────────────────────────────────────────────────
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Store Management API running on port ${PORT}`);
    const fallbackActive = getIsUsingFallback();
    console.log(`📊 DB Mode: ${fallbackActive ? 'Fallback JSON Store' : 'MySQL Connected'}`);
    if (fallbackActive) {
      console.log('⚠️ Running in fallback mode. Data is persisted to server/db/fallback-store.json until MySQL becomes available.');
    }
  });
});
