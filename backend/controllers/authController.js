const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, one, run, now } = require('../config/db');
const { need, validEmail, checkPassword, getSetting, notify } = require('../utils/helpers');

const USER_COLS = 'user_id, name, email, role, designation, active, must_change, created_at, last_login';

// GET /api/status
async function status(req, res) {
  const needsSetup = !(await one("SELECT 1 AS x FROM users WHERE role = 'Admin' LIMIT 1"));
  const appName = await getSetting('app_name', 'DevFlow');
  const orgName = await getSetting('org_name', '');
  res.json({ needs_setup: !!needsSetup, app_name: appName, org_name: orgName });
}

// POST /api/setup
async function setup(req, res) {
  const b = req.body;
  const alreadyDone = await one("SELECT 1 AS x FROM users WHERE role = 'Admin' LIMIT 1");
  if (alreadyDone) return res.status(400).json({ error: 'Setup already completed' });
  need(b, 'org_name', 'name', 'email', 'password');
  if (!validEmail(b.email)) return res.status(400).json({ error: 'Invalid email address' });
  checkPassword(b.password);
  const hash = await bcrypt.hash(b.password, 12);
  await run("INSERT INTO settings (`key`, value) VALUES ('org_name', ?) ON DUPLICATE KEY UPDATE value = ?", [b.org_name.trim(), b.org_name.trim()]);
  await run(
    'INSERT INTO users (name, email, password, role, designation, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [b.name.trim(), b.email.trim().toLowerCase(), hash, 'Admin', 'Administrator', now()]
  );
  res.json({ message: 'Organization created. Please sign in.' });
}

// POST /api/login
async function login(req, res) {
  const b = req.body;
  need(b, 'email', 'password');
  const user = await one('SELECT * FROM users WHERE email = ?', [b.email.trim().toLowerCase()]);
  if (!user || !(await bcrypt.compare(b.password, user.password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.active) return res.status(403).json({ error: 'Your account is deactivated. Contact your administrator.' });
  await run('UPDATE users SET last_login = ? WHERE user_id = ?', [now(), user.user_id]);
  const token = jwt.sign({ id: user.user_id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  res.json({
    token,
    user: {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation,
      must_change: user.must_change,
    },
  });
}

// POST /api/forgot
async function forgot(req, res) {
  const b = req.body;
  need(b, 'email');
  const user = await one('SELECT user_id, name FROM users WHERE email = ?', [b.email.trim().toLowerCase()]);
  if (user) {
    const admins = await query("SELECT user_id FROM users WHERE role = 'Admin' AND active = 1");
    for (const a of admins) {
      await notify(a.user_id, `🔑 ${user.name} (${b.email}) requested a password reset`, 'users');
    }
  }
  res.json({ message: 'Request sent. Your administrator will reset your password and share it with you.' });
}

// GET /api/me
async function getMe(req, res) {
  const user = await one(`SELECT ${USER_COLS} FROM users WHERE user_id = ?`, [req.user.id]);
  res.json(user);
}

// PUT /api/me
async function updateMe(req, res) {
  const b = req.body;
  const uid = req.user.id;
  if (b.name?.trim()) await run('UPDATE users SET name = ? WHERE user_id = ?', [b.name.trim(), uid]);
  if ('designation' in b) await run('UPDATE users SET designation = ? WHERE user_id = ?', [b.designation?.trim() || null, uid]);
  if (b.new_password) {
    const cur = await one('SELECT password FROM users WHERE user_id = ?', [uid]);
    if (!(await bcrypt.compare(b.current_password || '', cur.password))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    checkPassword(b.new_password);
    const hash = await bcrypt.hash(b.new_password, 12);
    await run('UPDATE users SET password = ?, must_change = 0 WHERE user_id = ?', [hash, uid]);
  }
  const updated = await one(`SELECT ${USER_COLS} FROM users WHERE user_id = ?`, [uid]);
  res.json({ message: 'Profile updated', user: updated });
}

module.exports = { status, setup, login, forgot, getMe, updateMe };
