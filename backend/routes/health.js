import express from 'express';
import mongoose from 'mongoose';
import { query } from '../config/db.js';
import config from '../config/config.js';

const router = express.Router();

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const checks = {
    mysql: { status: 'down', latencyMs: 0 },
    mongodb: { status: 'down' },
    razorpay: { status: 'unconfigured' },
    email: { status: 'unconfigured' },
  };

  // 1. MySQL Health Check
  const mySqlStart = Date.now();
  try {
    const rows = await query('SELECT 1 AS alive');
    if (rows && rows[0]?.alive === 1) {
      checks.mysql = {
        status: 'up',
        latencyMs: Date.now() - mySqlStart,
      };
    }
  } catch (err) {
    checks.mysql = {
      status: 'down',
      error: err.message,
    };
  }

  // 2. MongoDB Health Check
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    checks.mongodb = {
      status: mongoState === 1 ? 'up' : 'down',
      state: mongoStates[mongoState] || 'unknown',
    };
  } catch (err) {
    checks.mongodb = {
      status: 'down',
      error: err.message,
    };
  }

  // 3. Razorpay Configuration Check
  if (config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET) {
    checks.razorpay = {
      status: 'ready',
      keyIdPrefix: config.RAZORPAY_KEY_ID.substring(0, 8) + '...',
      currency: config.RAZORPAY_CURRENCY || 'INR',
    };
  }

  // 4. Email Configuration Check
  if (config.EMAIL_USER || (config.GOOGLE_CLIENT_ID && config.GOOGLE_REFRESH_TOKEN)) {
    checks.email = {
      status: 'configured',
      sender: config.GOOGLE_USER || config.EMAIL_USER || 'configured',
    };
  }

  // Overall Status
  const isHealthy = checks.mysql.status === 'up' && checks.mongodb.status === 'up';
  const mem = process.memoryUsage();
  const uptimeSeconds = process.uptime();

  const responsePayload = {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'DevFlow Agile Workspace Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: formatUptime(uptimeSeconds),
    uptimeSeconds: Math.floor(uptimeSeconds),
    responseTimeMs: Date.now() - startTime,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rssMB: (mem.rss / 1024 / 1024).toFixed(2),
        heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(2),
      },
    },
    dependencies: checks,
  };

  res.status(isHealthy ? 200 : 503).json(responsePayload);
});

export default router;
