import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import userModel from '../models/user.model.js';
import { syncUserToMySQL } from '../utils/helpers.js';

export async function auth(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const parts = authHeader.trim().split(/\s+/);
      if (parts.length === 2) {
        token = parts[1];
      }
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await userModel.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }

    const mysqlId = decoded.mysql_id || (await syncUserToMySQL(user));

    req.user = {
      id: mysqlId || user._id,
      user_id: mysqlId || user._id,
      mongo_id: user._id,
      username: user.username,
      name: user.username,
      email: user.email,
      role: user.role || 'Member',
      designation: user.designation || '',
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', message: err.message });
  }
}

export function requireRole(...roles) {
  const allowed = roles.map(r => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userRole = (req.user.role || '').toLowerCase();
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}
