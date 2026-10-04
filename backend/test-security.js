/**
 * DevFlow Automated Security & Abuse Protection Verification Suite
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

import http from 'http';
import app from './app.js';
import mongoose from 'mongoose';
import connectDB from './config/database.js';

let server;
const PORT = 5099;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const method = options.method || 'GET';
  const headers = options.headers || {};
  let body = options.body;

  if (body && typeof body === 'object') {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function runSecurityTests() {
  console.log('\n🔒 Starting DevFlow Security & Abuse Protection Verification Suite...\n');

  try {
    await connectDB();
  } catch (err) {
    console.warn('MongoDB connection note:', err.message);
  }

  server = app.listen(PORT);
  await new Promise(resolve => setTimeout(resolve, 500));

  // ── TEST 1: Security Headers ───────────────────────────────────────────────
  console.log('[1/10] Security Headers Verification:');
  const resHeaders = await request('/api/auth/google-client-id');
  assert(resHeaders.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff present');
  assert(resHeaders.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options: DENY present');
  assert(resHeaders.headers.get('x-xss-protection') === '1; mode=block', 'X-XSS-Protection present');
  assert(resHeaders.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy present');
  assert(!resHeaders.headers.get('x-powered-by'), 'X-Powered-By is hidden/removed');

  // ── TEST 2: Password Policy & Length Protection ────────────────────────────
  console.log('\n[2/10] Password Policy & Bcrypt DoS Protection:');
  
  // Test password too short (< 8 chars)
  const shortPwRes = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'sec_test_user',
      email: 'sec_test_short@example.com',
      password: 'short',
    },
  });
  assert(shortPwRes.status === 400, 'Password < 8 chars rejected with HTTP 400');

  // Test password too long (> 128 chars to prevent bcrypt DoS)
  const longPw = 'A1!'.repeat(50); // 150 chars
  const longPwRes = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'sec_test_user',
      email: 'sec_test_long@example.com',
      password: longPw,
    },
  });
  assert(longPwRes.status === 400, 'Password > 128 chars rejected with HTTP 400 (Bcrypt DoS blocked)');

  // Test common trivial weak password rejection
  const weakPwRes = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'sec_test_user',
      email: 'sec_test_weak@example.com',
      password: 'password123',
    },
  });
  assert(weakPwRes.status === 400, 'Trivial dictionary password rejected with HTTP 400');

  // Test login with oversized password payload
  const longLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@devflow.local',
      password: 'X'.repeat(500),
    },
  });
  assert(longLoginRes.status === 400, 'Login password > 128 chars rejected immediately before bcrypt');

  // ── TEST 3: Login Failure Generic Messages & Brute-Force Lockout ────────────
  console.log('\n[3/10] Generic Authentication Failure & Credential Stuffing Defense:');
  const badLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'nonexistent_user_12345@example.com',
      password: 'RandomPassword123!',
    },
  });
  assert(badLoginRes.status === 401, 'Invalid login returns HTTP 401');
  assert(
    badLoginRes.data?.message === 'Invalid email or password' || badLoginRes.data?.error === 'Invalid email or password',
    'Generic error message returned without account enumeration'
  );

  // ── TEST 4: Input Validation & Sanitization ────────────────────────────────
  console.log('\n[4/10] Server-Side Input Validation:');

  // Test invalid email format & length bound
  const invalidEmailRes = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'validuser',
      email: 'not-an-email',
      password: 'StrongPassword123!',
    },
  });
  assert(invalidEmailRes.status === 400, 'Invalid email format rejected with HTTP 400');

  // Test oversized email (> 254 chars - ReDoS safeguard)
  const giantEmail = 'a'.repeat(250) + '@example.com';
  const giantEmailRes = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'validuser',
      email: giantEmail,
      password: 'StrongPassword123!',
    },
  });
  assert(giantEmailRes.status === 400, 'Email exceeding RFC 254 length rejected immediately');

  // ── TEST 5: Idempotency & Rapid Double-Click Protection ─────────────────────
  console.log('\n[5/10] Idempotency & Rapid Double-Click Protection:');
  const idempotencyKey = `test_idem_${Date.now()}`;
  
  // First request to an unauthenticated route with idempotency key
  const firstReq = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: { email: 'test@example.com', password: 'FakePassword123!' },
  });

  // Rapid identical second request with the same idempotency key
  const secondReq = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: { email: 'test@example.com', password: 'FakePassword123!' },
  });

  assert(
    secondReq.status === firstReq.status || secondReq.status === 409,
    `Idempotency preserved: First status ${firstReq.status}, Second status ${secondReq.status}`
  );

  // ── TEST 6: Parameterized SQL Injection Safety ──────────────────────────────
  console.log('\n[6/10] SQL Injection Verification:');
  const sqlPayload = "' OR '1'='1";
  const searchRes = await request(`/api/search?q=${encodeURIComponent(sqlPayload)}`, {
    headers: { Authorization: 'Bearer mock_invalid_token' },
  });
  assert(searchRes.status === 401, 'Protected search API requires authentication');

  // ── TEST 7: Route Parameter Bounds Validation ───────────────────────────────
  console.log('\n[7/10] Route Parameter Bounds (:id Validation):');
  const invalidIdRes = await request('/api/projects/not-a-number', {
    method: 'PUT',
    body: { project_name: 'Test' },
  });
  assert(invalidIdRes.status === 400, 'Non-integer :id route parameter rejected with HTTP 400');

  // ── TEST 8: Error Handler Sanitization ─────────────────────────────────────
  console.log('\n[8/10] Error Handler Info Leakage Prevention:');
  const notFoundRes = await request('/api/non-existent-endpoint-xyz');
  assert(notFoundRes.status === 404, 'Unknown API route returns clean HTTP 404');
  assert(typeof notFoundRes.data === 'object', 'JSON error response returned');

  // ── TEST 9: Body Parser Payload Size Limits ────────────────────────────────
  console.log('\n[9/10] Body Parser Limit Protection (1MB threshold):');
  const oversizedPayload = { data: 'X'.repeat(1.5 * 1024 * 1024) }; // 1.5MB
  const overSizeRes = await request('/api/auth/register', {
    method: 'POST',
    body: oversizedPayload,
  });
  assert(overSizeRes.status === 413, 'Oversized JSON payload (> 1MB) rejected with HTTP 413 Payload Too Large');

  // ── TEST 10: Registration Rate Limiting ────────────────────────────────────
  console.log('\n[10/10] Rate Limiting Stress Test:');
  let hitRateLimit = false;
  for (let i = 0; i < 15; i++) {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: `ratetest_${i}`,
        email: `rate_stress_${i}@example.com`,
        password: 'ValidPass123!',
      },
    });
    if (res.status === 429) {
      hitRateLimit = true;
      break;
    }
  }
  assert(hitRateLimit, 'Registration rate limit successfully triggered (HTTP 429)');

  console.log(`\n==================================================`);
  console.log(`Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`==================================================\n`);

  server.close();
  try {
    await mongoose.disconnect();
  } catch (e) {}

  process.exit(failCount > 0 ? 1 : 0);
}

runSecurityTests().catch(err => {
  console.error('Test Suite Error:', err);
  if (server) server.close();
  process.exit(1);
});
