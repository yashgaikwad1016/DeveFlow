import bcrypt from 'bcryptjs';
import userModel from '../models/user.model.js';
import { query, one, run } from '../config/db.js';
import { checkPassword, syncUserToMySQL } from '../utils/helpers.js';

const USER_COLS = 'user_id, name, email, role, designation, active, created_at, last_login';

/**
 * GET /api/me
 * Retrieves authenticated user profile
 */
export async function getProfile(req, res) {
  try {
    const mongoId = req.user.mongo_id || req.user.id;
    const user = await userModel.findById(mongoId).select('-password -passwordHistory');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mysqlId = req.user.user_id || req.user.id;
    let mysqlUser = null;
    try {
      mysqlUser = await one(`SELECT ${USER_COLS} FROM users WHERE user_id = ?`, [mysqlId]);
    } catch (e) {}

    res.json({
      user_id: mysqlId,
      id: mysqlId,
      mongo_id: user._id,
      name: user.username,
      username: user.username,
      email: user.email,
      role: user.role || 'Member',
      designation: user.designation || mysqlUser?.designation || '',
      verified: user.verified,
      created_at: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/me
 * Updates profile details and handles password change with reuse prevention
 */
export async function updateProfile(req, res) {
  try {
    const mongoId = req.user.mongo_id || req.user.id;
    const mysqlId = req.user.user_id || req.user.id;
    const b = req.body || {};

    const user = await userModel.findById(mongoId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let profileUpdated = false;

    if (b.name && typeof b.name === 'string') {
      const trimmedName = b.name.trim();
      if (trimmedName.length >= 2 && trimmedName.length <= 100) {
        user.username = trimmedName;
        profileUpdated = true;
      }
    }

    if (b.designation !== undefined && typeof b.designation === 'string') {
      user.designation = b.designation.trim().slice(0, 100);
      profileUpdated = true;
    }

    // Password change flow
    if (b.new_password) {
      if (!b.current_password || typeof b.current_password !== 'string') {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }

      // Verify current password
      let isCurrentValid = false;
      if (user.password.startsWith('$2')) {
        isCurrentValid = await bcrypt.compare(b.current_password, user.password);
      } else {
        // Fallback for legacy hashes
        const crypto = (await import('crypto')).default;
        const hashed = crypto.createHash('sha256').update(b.current_password).digest('hex');
        isCurrentValid = (hashed === user.password);
      }

      if (!isCurrentValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Validate new password rules (min 8, max 128, complexity, common weak passwords)
      checkPassword(b.new_password);

      // Check against current password
      const isSameAsCurrent = await bcrypt.compare(b.new_password, user.password);
      if (isSameAsCurrent) {
        return res.status(400).json({ error: 'New password cannot be the same as your current password' });
      }

      // Check password history (last 5 passwords) to prevent reuse
      const history = Array.isArray(user.passwordHistory) ? user.passwordHistory : [];
      for (const oldHash of history) {
        if (oldHash && oldHash.startsWith('$2')) {
          const matchesOld = await bcrypt.compare(b.new_password, oldHash);
          if (matchesOld) {
            return res.status(400).json({
              error: 'Password has been used recently. You cannot reuse any of your last 5 passwords.'
            });
          }
        }
      }

      // Hash new password
      const newHash = await bcrypt.hash(b.new_password, 10);
      user.password = newHash;

      // Update password history (keep max 5 hashes)
      const updatedHistory = [newHash, ...history.slice(0, 4)];
      user.passwordHistory = updatedHistory;
      profileUpdated = true;

      // Update MySQL users table password if exists
      try {
        await run('UPDATE users SET password = ?, must_change = 0 WHERE user_id = ?', [newHash, mysqlId]);
      } catch (e) {}
    }

    if (profileUpdated) {
      await user.save();
      // Sync name & designation to MySQL
      try {
        await run(
          'UPDATE users SET name = ?, designation = ? WHERE user_id = ?',
          [user.username, user.designation, mysqlId]
        );
      } catch (e) {}
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: mysqlId,
        user_id: mysqlId,
        name: user.username,
        email: user.email,
        role: user.role,
        designation: user.designation,
      }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

export default { getProfile, updateProfile };
