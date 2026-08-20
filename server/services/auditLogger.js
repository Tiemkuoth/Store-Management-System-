import { getPool } from '../db/db.js';

function extractIpAddress(req) {
  if (!req) return '127.0.0.1';
  const fwd = req.headers?.['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

export async function logAudit(userId, username, role, actionType, description, req = null) {
  const requiredValues = { userId, username, role, actionType, description };
  const missingField = Object.entries(requiredValues).find(([, value]) =>
    value === undefined || value === null || String(value).trim() === ''
  );
  if (missingField) {
    console.error(`Audit log skipped: ${missingField[0]} is required`);
    return false;
  }

  const ip = extractIpAddress(req);
  try {
    await getPool().query(
      'INSERT INTO audit_logs (user_id,username,user_role,action_type,description,ip_address) VALUES (?,?,?,?,?,?)',
      [userId, username, role, actionType, description, ip]
    );
    return true;
  } catch (e) {
    console.error('Audit log failed:', e.message);
    return false;
  }
}

export { extractIpAddress };
