import { query, one, run, now } from '../config/db.js';

// Get all project IDs visible to this user
export async function projectIds(user) {
  if (user.role === 'Admin') {
    const rows = await query('SELECT project_id FROM projects');
    return rows.map(r => r.project_id);
  }
  const rows = await query(
    `SELECT project_id FROM team_members WHERE user_id = ?
     UNION
     SELECT project_id FROM projects WHERE manager_id = ?`,
    [user.id, user.id]
  );
  return rows.map(r => r.project_id);
}

// Build IN clause string safely
export function inClause(ids) {
  if (!ids || ids.length === 0) return '(0)';
  const safeIds = ids.map(i => parseInt(i, 10)).filter(n => Number.isInteger(n) && n > 0);
  if (safeIds.length === 0) return '(0)';
  return '(' + safeIds.join(',') + ')';
}

// Check user has access to a specific project
export async function checkProject(user, projectId) {
  const pid = parseInt(projectId, 10);
  if (isNaN(pid) || pid <= 0) {
    const err = new Error("Invalid project ID");
    err.statusCode = 400;
    throw err;
  }
  const ids = await projectIds(user);
  if (!ids.includes(pid)) {
    const err = new Error("You don't have access to this project");
    err.statusCode = 403;
    throw err;
  }
}

// Percentage helper
export function pct(done, total) {
  if (!total) return 0;
  return Math.round((100 * (done || 0)) / total);
}

// Common weak passwords to prohibit
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password123', 'admin123', '12345678', '123456789',
  'qwerty1234', 'devflow123', 'welcome123', 'administrator'
]);

// Validate email (RFC 5321 length bounded to 254 chars to prevent ReDoS)
export function validEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

// Validate password (8-128 chars, letters + numbers/symbols, no trivial weak passwords)
export function checkPassword(password) {
  if (!password || typeof password !== 'string') {
    const err = new Error('Password is required');
    err.statusCode = 400;
    throw err;
  }
  if (password.length < 8) {
    const err = new Error('Password must be at least 8 characters long');
    err.statusCode = 400;
    throw err;
  }
  if (password.length > 128) {
    const err = new Error('Password cannot exceed 128 characters');
    err.statusCode = 400;
    throw err;
  }
  if (!/[A-Za-z]/.test(password) || !/[\d\W_]/.test(password)) {
    const err = new Error('Password must contain both letters and at least one number or special character');
    err.statusCode = 400;
    throw err;
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    const err = new Error('Password is too common or easily guessable. Please choose a stronger password.');
    err.statusCode = 400;
    throw err;
  }
}


// Get setting value from DB
export async function getSetting(key, defaultVal = null) {
  const row = await one('SELECT value FROM settings WHERE `key` = ?', [key]);
  return row ? row.value : defaultVal;
}

// Create notification
export async function notify(userId, message, link = '') {
  if (!userId) return;
  await run(
    'INSERT INTO notifications (user_id, message, link, status, created_at) VALUES (?, ?, ?, ?, ?)',
    [userId, message, link, 'Unread', now()]
  );
}

// Log activity
export async function logActivity(user, projectId, action) {
  await run(
    'INSERT INTO activity (user_id, project_id, action, created_at) VALUES (?, ?, ?, ?)',
    [user.id, projectId, action, now()]
  );
}

// Need fields helper
export function need(body, ...keys) {
  for (const k of keys) {
    if (!String(body[k] ?? '').trim()) {
      const err = new Error(`${k.replace(/_/g, ' ')} is required`);
      err.statusCode = 400;
      throw err;
    }
  }
}

// Safe integer parse
export function toInt(v) {
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

// Role check
export function isMgr(user) {
  return user && (user.role === 'Admin' || user.role === 'Manager');
}

// Synchronize MongoDB User to MySQL users table for foreign-key relational integrity
export async function syncUserToMySQL(user) {
  if (!user || !user.email) return null;
  try {
    const existing = await one('SELECT user_id FROM users WHERE email = ?', [user.email]);
    const username = user.username || user.name || 'Member';
    const role = user.role || 'Member';
    const designation = user.designation || '';

    if (existing) {
      await run(
        'UPDATE users SET name = ?, role = ?, designation = ?, active = 1 WHERE user_id = ?',
        [username, role, designation, existing.user_id]
      );
      return existing.user_id;
    }

    const res = await run(
      'INSERT INTO users (name, email, password, role, designation, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [
        username,
        user.email,
        user.password || 'managed_by_mongo_auth',
        role,
        designation,
        now(),
      ]
    );
    return res.insertId;
  } catch (err) {
    console.error('MySQL user sync warning:', err.message);
    return null;
  }
}

export default { projectIds, inClause, checkProject, pct, validEmail, checkPassword, getSetting, notify, logActivity, need, toInt, isMgr, syncUserToMySQL };
