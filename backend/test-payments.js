import assert from 'assert';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import http from 'http';
import app from './app.js';
import config from './config/config.js';
import connectDB from './config/database.js';
import { pool, query, one, run, now } from './config/db.js';
import pricingService from './services/pricingService.js';
import razorpayService from './services/razorpayService.js';
import receiptService from './services/receiptService.js';
import { initPaymentSchema } from './config/paymentSchema.js';

async function runPaymentTestSuite() {
  console.log('🧪 Starting DevFlow Complete Subscription & Payment Integration Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
      }
    })();
  }

  // Ensure database connections & schema are initialized
  await connectDB();
  await initPaymentSchema();

  // Start temporary test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // JWT Tokens for testing
  const adminToken = jwt.sign(
    { id: '6abbda4017de36301969307f', role: 'Admin', email: 'devflow5173@admin.com', username: 'admin_devflow' },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const memberToken = jwt.sign(
    { id: '6abd481477fc74c31fe4d896', role: 'Member', email: 'yashgaikwad0108@gmail.com', username: 'yashgaikwad' },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const memberToken2 = jwt.sign(
    { id: '6abbc1fb676bc4454156848f', role: 'Member', email: 'yashrajaram.gaikwad@matoshri.edu.in', username: 'Yash_Gaik' },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    // ── STEP 6 & 27: Team Member Pricing & Pricing Service ───────────────────
    await test('STEP 6/27: Team pricing formula team_price = member_count × 3', async () => {
      const cases = [
        { count: 2, expected: 6.0, subunits: 600 },
        { count: 3, expected: 9.0, subunits: 900 },
        { count: 4, expected: 12.0, subunits: 1200 },
        { count: 5, expected: 15.0, subunits: 1500 },
        { count: 6, expected: 18.0, subunits: 1800 },
        { count: 7, expected: 21.0, subunits: 2100 },
        { count: 8, expected: 24.0, subunits: 2400 },
        { count: 9, expected: 27.0, subunits: 2700 },
        { count: 10, expected: 30.0, subunits: 3000 },
      ];

      for (const c of cases) {
        const res = await pricingService.calculatePlanPrice('team', c.count);
        assert.strictEqual(res.memberCount, c.count);
        assert.strictEqual(res.amount, c.expected);
        assert.strictEqual(res.amountSubunits, c.subunits);
        assert.strictEqual(res.currency, 'USD');
      }
    });

    await test('STEP 6/27: Individual and Business plan fixed pricing validation', async () => {
      const indiv = await pricingService.calculatePlanPrice('individual', 1);
      assert.strictEqual(indiv.amount, 5.0);
      assert.strictEqual(indiv.amountSubunits, 500);

      const biz = await pricingService.calculatePlanPrice('business');
      assert.strictEqual(biz.amount, 29.0);
      assert.strictEqual(biz.amountSubunits, 2900);
    });

    // ── STEP 12 & 26: Price Manipulation Protection ──────────────────────────
    await test('STEP 12/26: Price manipulation immunity (client amount is strictly rejected)', async () => {
      const res = await fetch(`${baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({ plan: 'business', amount: 1.0, price: 1.0 }), // Malicious attempt to pay $1 for $29 plan
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      // Canonical backend price must be $29 (2900 subunits), NEVER $1
      assert.strictEqual(data.amount, 29.0);
      assert.strictEqual(data.amountSubunits, 2900);
      assert.notStrictEqual(data.amount, 1.0);
    });

    // ── STEP 8 & 9: Razorpay Order Creation in Test Mode ─────────────────────
    let createdOrder = null;
    await test('STEP 8/9: Razorpay Order creation with correct receipt & subunits', async () => {
      const res = await fetch(`${baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({ plan: 'team', memberCount: 5 }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(data.orderId.startsWith('order_'));
      assert.strictEqual(data.amount, 15.0);
      assert.strictEqual(data.amountSubunits, 1500);
      assert.strictEqual(data.currency, 'USD');
      assert.ok(data.receiptNumber.startsWith('DF-'));
      createdOrder = data;
    });

    await test('UPI Order Creation: Enforces INR currency, ₹250/member team pricing, and paise subunits', async () => {
      const res = await fetch(`${baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({ plan: 'team', memberCount: 5, paymentMethod: 'upi' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.currency, 'INR');
      assert.strictEqual(data.amount, 1250.0); // 5 members × ₹250 = ₹1250
      assert.strictEqual(data.amountSubunits, 125000); // in paise
      assert.strictEqual(data.currencySymbol, '₹');
    });

    // ── STEP 10: Cryptographic Signature Verification ────────────────────────
    await test('STEP 10: Payment verification rejects forged signatures', async () => {
      const res = await fetch(`${baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({
          razorpay_order_id: createdOrder.orderId,
          razorpay_payment_id: 'pay_tampered_123',
          razorpay_signature: 'fake_signature_abc123',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.match(data.error, /invalid signature|possible tampering/i);
    });

    // ── STEP 11 & 23: Razorpay Webhook Processing & Idempotency ──────────────
    const testWebhookEventId = `evt_test_${Date.now()}`;
    await test('STEP 11/23: Webhook signature verification and duplicate idempotency', async () => {
      const payload = {
        entity: 'event',
        event_id: testWebhookEventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_webhook_${Date.now()}`,
              order_id: createdOrder.orderId,
              status: 'captured',
              amount: 1500,
              currency: 'USD',
              method: 'upi',
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      // First webhook delivery
      const res1 = await fetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
        },
        body: rawBody,
      });
      const data1 = await res1.json();
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(data1.status, 'ok');

      // Verify payment was marked 'Success' in MySQL
      const pmt = await one('SELECT * FROM payments WHERE razorpay_order_id = ?', [createdOrder.orderId]);
      assert.ok(pmt);
      assert.strictEqual(pmt.status, 'Success');
      assert.strictEqual(pmt.payment_method, 'upi');

      // Second (duplicate) webhook delivery with same event_id
      const res2 = await fetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
        },
        body: rawBody,
      });
      const data2 = await res2.json();
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(data2.message, 'Event already processed');

      // Verify payment record was not duplicated
      const pmtCount = await query('SELECT COUNT(*) AS count FROM payments WHERE razorpay_order_id = ?', [createdOrder.orderId]);
      assert.strictEqual(pmtCount[0].count, 1);
    });

    // ── STEP 13 & 14 & 15 & 25: Receipt Download & IDOR Security ─────────────
    let verifiedPaymentId = null;
    await test('STEP 13/14/15/25: Receipt generation & IDOR authorization check', async () => {
      const pmt = await one('SELECT payment_id, user_id FROM payments WHERE razorpay_order_id = ?', [createdOrder.orderId]);
      assert.ok(pmt);
      verifiedPaymentId = pmt.payment_id;

      // 1. Owner requests their receipt -> Must succeed and return application/pdf
      const ownerRes = await fetch(`${baseUrl}/api/payments/${verifiedPaymentId}/receipt`, {
        headers: { Authorization: `Bearer ${memberToken}` },
      });
      assert.strictEqual(ownerRes.status, 200);
      assert.strictEqual(ownerRes.headers.get('content-type'), 'application/pdf');
      const blob = await ownerRes.arrayBuffer();
      const pdfHeader = Buffer.from(blob).slice(0, 5).toString('ascii');
      assert.strictEqual(pdfHeader, '%PDF-');

      // 2. Non-owner (different authenticated user) requests receipt -> Must be rejected with 403 Forbidden (IDOR Defense)
      const attackerRes = await fetch(`${baseUrl}/api/payments/${verifiedPaymentId}/receipt`, {
        headers: { Authorization: `Bearer ${memberToken2}` },
      });
      assert.strictEqual(attackerRes.status, 403);
      const attackerData = await attackerRes.json();
      assert.match(attackerData.error, /only download your own receipts|access denied/i);
    });

    // ── STEP 16 & 24: Admin Payment Dashboard Authorization & Pagination ──────
    await test('STEP 16/24: Unauthorized access to Admin payments is strictly blocked', async () => {
      // Non-admin user
      const memberRes = await fetch(`${baseUrl}/api/admin/payments`, {
        headers: { Authorization: `Bearer ${memberToken}` },
      });
      assert.strictEqual(memberRes.status, 403);
    });

    await test('STEP 16: Admin payment logs pagination, search, and revenue summary', async () => {
      const adminRes = await fetch(`${baseUrl}/api/admin/payments?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(adminRes.status, 200);
      const data = await adminRes.json();
      assert.ok(Array.isArray(data.payments));
      assert.ok(data.pagination);
      assert.ok(data.summary);
      assert.ok(Number(data.summary.totalRevenue) >= 15.0);
      assert.ok(data.summary.successfulPayments >= 1);
    });

    // ── STEP 12 & 14: Subscription Cancellation ──────────────────────────────
    await test('STEP 12/14: Subscription cancellation updates state and preserves audit log', async () => {
      const cancelRes = await fetch(`${baseUrl}/api/subscriptions/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${memberToken}` },
      });
      assert.strictEqual(cancelRes.status, 200);
      const cancelData = await cancelRes.json();
      assert.strictEqual(cancelData.success, true);

      // Verify payment history still intact
      const historyRes = await fetch(`${baseUrl}/api/payments/history`, {
        headers: { Authorization: `Bearer ${memberToken}` },
      });
      const historyData = await historyRes.json();
      assert.ok(historyData.payments.length > 0);
    });

  } finally {
    server.close();
  }

  console.log(`\n==================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPaymentTestSuite().then(() => process.exit(0)).catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
