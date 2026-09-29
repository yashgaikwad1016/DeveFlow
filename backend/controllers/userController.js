import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import userModel from '../models/user.model.js';
import { query, one, run, now } from '../config/db.js';
import { need, validEmail } from '../utils/helpers.js';

// GET /api/users
export async function listUsers(req, res) {
  try {
    // Fetch users from MongoDB
    const mongoUsers = await userModel.find({}).select('-password').sort({ createdAt: -1 });
    
    // Also try to sync or fetch with MySQL
    let mysqlUsers = [];
    try {
      mysqlUsers = await query('SELECT * FROM users');
    } catch (e) {}

    const users = mongoUsers.map(u => ({
      user_id: u._id,
      id: u._id,
      name: u.username,
      username: u.username,
      email: u.email,
      role: u.role || 'Member',
      designation: u.designation || '',
      active: u.verified !== false ? 1 : 0,
      verified: u.verified,
      created_at: u.createdAt,
    }));

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/users
export async function createUser(req, res) {
  try {
    const b = req.body;
    need(b, 'name', 'email', 'password');
    const email = b.email.trim().toLowerCase();
    const username = b.name.trim();
    const role = b.role || 'Member';

    const existing = await userModel.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(b.password, 10);

    const newUser = await userModel.create({
      username,
      email,
      password: hashedPassword,
      role,
      designation: b.designation?.trim() || '',
      verified: true, // Admin-created user is auto-verified
    });

    // Also mirror into MySQL users table if available for foreign key relations
    try {
      await run(
        'INSERT IGNORE INTO users (name, email, password, role, designation, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
        [username, email, hashedPassword, role, b.designation?.trim() || '', now()]
      );
    } catch (e) {}

    res.json({ message: 'User created successfully', user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/users/:id
export async function updateUser(req, res) {
  try {
    const uid = req.params.id;
    const b = req.body;

    const user = await userModel.findById(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (b.name?.trim()) user.username = b.name.trim();
    if (b.designation !== undefined) user.designation = b.designation.trim();
    if (b.role && ['Admin', 'Manager', 'Member'].includes(b.role)) user.role = b.role;
    if (b.active !== undefined) user.verified = Boolean(b.active);

    if (b.password) {
      user.password = await bcrypt.hash(b.password, 10);
    }

    await user.save();
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/users/:id
export async function deleteUser(req, res) {
  try {
    const uid = req.params.id;
    const currentUid = req.user.user_id || req.user.id;
    if (String(uid) === String(currentUid)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    await userModel.findByIdAndDelete(uid);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export default { listUsers, createUser, updateUser, deleteUser };
