import crypto from 'crypto';
import { pool, query, one, run, now } from '../config/db.js';
import pricingService from '../services/pricingService.js';
import razorpayService from '../services/razorpayService.js';
import receiptService from '../services/receiptService.js';

// Helper to generate a unique SaaS receipt number
function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `DF-${year}-${rand}`;
}

export const paymentController = {
  /**
   * GET /api/payments/config
   * Returns public configuration required by client (Public Key ID, Currency, Plans)
   */
  async getConfig(req, res, next) {
    try {
      const currency = req.query.currency || pricingService.getCurrency();
      const plans = await pricingService.getActivePlans(currency);
      res.json({
        keyId: razorpayService.getPublicKeyId(),
        currency: pricingService.getCurrency(),
        plans,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/payments/plans
   * Returns active subscription plans
   */
  async getPlans(req, res, next) {
    try {
      const currency = req.query.currency || pricingService.getCurrency();
      const plans = await pricingService.getActivePlans(currency);
      res.json({ plans, currency });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/payments/create-order
   * Authenticates user, calculates price on backend, creates Razorpay order,
   * stores pending subscription & payment records in MySQL.
   */
  async createOrder(req, res, next) {
    const conn = await pool.getConnection();
    try {
      const userId = req.user.id;
      const { plan, memberCount, currency, paymentMethod } = req.body;

      if (!plan) {
        return res.status(400).json({ error: 'Please select a subscription plan' });
      }

      // ── CRITICAL: Independent backend price calculation ────────────────────
      // NEVER trust any price, amount, or currency sent by client!
      // If paymentMethod is UPI, currency is automatically pegged to INR
      const pricing = await pricingService.calculatePlanPrice(plan, memberCount, currency, paymentMethod);

      const receiptNumber = generateReceiptNumber();
      const shortReceipt = `rcpt_${Date.now()}_${userId}`.slice(0, 40);

      // Create Razorpay Order
      const rzpOrder = await razorpayService.createOrder({
        amountSubunits: pricing.amountSubunits,
        currency: pricing.currency,
        receipt: shortReceipt,
        notes: {
          userId: String(userId),
          userEmail: req.user.email,
          planCode: pricing.planCode,
          memberCount: String(pricing.memberCount),
          receiptNumber,
        },
      });

      await conn.beginTransaction();

      const currentTime = now();

      // Check if user already has an active subscription record or create a new one
      const [existingSub] = await conn.query(
        'SELECT * FROM subscriptions WHERE user_id = ? AND status = "Active" LIMIT 1',
        [userId]
      );

      let subscriptionId;
      if (existingSub && existingSub.length > 0) {
        // Prepare pending change subscription record or update existing
        const [subResult] = await conn.query(
          `INSERT INTO subscriptions (
            user_id, plan_id, razorpay_order_id, status, member_count, 
            amount, currency, billing_interval, created_at, updated_at
          ) VALUES (?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            pricing.planId,
            rzpOrder.id,
            pricing.memberCount,
            pricing.amount,
            pricing.currency,
            pricing.billingInterval,
            currentTime,
            currentTime,
          ]
        );
        subscriptionId = subResult.insertId;
      } else {
        const [subResult] = await conn.query(
          `INSERT INTO subscriptions (
            user_id, plan_id, razorpay_order_id, status, member_count, 
            amount, currency, billing_interval, created_at, updated_at
          ) VALUES (?, ?, ?, 'Created', ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            pricing.planId,
            rzpOrder.id,
            pricing.memberCount,
            pricing.amount,
            pricing.currency,
            pricing.billingInterval,
            currentTime,
            currentTime,
          ]
        );
        subscriptionId = subResult.insertId;
      }

      // Record pending payment in MySQL
      await conn.query(
        `INSERT INTO payments (
          user_id, subscription_id, razorpay_order_id, amount, currency, 
          status, receipt_number, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'Created', ?, ?, ?)`,
        [
          userId,
          subscriptionId,
          rzpOrder.id,
          pricing.amount,
          pricing.currency,
          receiptNumber,
          currentTime,
          currentTime,
        ]
      );

      await conn.commit();

      // Return only necessary checkout configuration to frontend
      res.json({
        orderId: rzpOrder.id,
        amount: pricing.amount,
        amountSubunits: pricing.amountSubunits,
        currency: pricing.currency,
        currencySymbol: pricing.currencySymbol,
        paymentMethod: pricing.paymentMethod,
        keyId: razorpayService.getPublicKeyId(),
        plan: {
          code: pricing.planCode,
          name: pricing.planName,
          memberCount: pricing.memberCount,
        },
        user: {
          name: req.user.name || req.user.username,
          email: req.user.email,
        },
        receiptNumber,
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  },

  /**
   * POST /api/payments/verify
   * Verifies Razorpay payment signature (HMAC SHA-256), validates order & amount,
   * updates payment & subscription records within a MySQL transaction.
   */
  async verifyPayment(req, res, next) {
    const conn = await pool.getConnection();
    try {
      const userId = req.user.id;
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing required Razorpay payment verification parameters' });
      }

      // ── Step 1: Server-side cryptographic HMAC SHA-256 signature verification
      const isValid = razorpayService.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        return res.status(400).json({
          error: 'Payment verification failed: Invalid signature. Possible tampering detected.',
        });
      }

      // ── Step 2: Fetch trusted payment record from Razorpay API
      const rzpPayment = await razorpayService.fetchPayment(razorpay_payment_id);
      if (!rzpPayment || rzpPayment.order_id !== razorpay_order_id) {
        return res.status(400).json({ error: 'Payment record does not match the specified order' });
      }

      if (rzpPayment.status !== 'captured' && rzpPayment.status !== 'authorized') {
        return res.status(400).json({
          error: `Payment is not in an authorized/captured state (current: ${rzpPayment.status})`,
        });
      }

      await conn.beginTransaction();

      // ── Step 3: Find corresponding payment in database
      const [payments] = await conn.query(
        'SELECT * FROM payments WHERE razorpay_order_id = ? AND user_id = ? FOR UPDATE',
        [razorpay_order_id, userId]
      );

      if (payments.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Payment record not found for this order' });
      }

      const payment = payments[0];

      // Prevent duplicate processing
      if (payment.status === 'Success') {
        await conn.commit();
        return res.json({
          success: true,
          message: 'Payment has already been verified and processed',
          paymentId: payment.payment_id,
          receiptNumber: payment.receipt_number,
        });
      }

      // ── Step 4: Verify expected amount against trusted Razorpay payment
      const expectedSubunits = Math.round(parseFloat(payment.amount) * 100);
      if (rzpPayment.amount !== expectedSubunits) {
        await conn.rollback();
        return res.status(400).json({
          error: `Payment amount mismatch: expected ${expectedSubunits} subunits, received ${rzpPayment.amount}`,
        });
      }

      const currentTime = now();
      const paymentMethod = rzpPayment.method || 'card';

      // ── Step 5: Update payment status to Success
      await conn.query(
        `UPDATE payments SET
          razorpay_payment_id = ?,
          razorpay_signature = ?,
          status = 'Success',
          payment_method = ?,
          payment_time = ?,
          updated_at = ?
         WHERE payment_id = ?`,
        [
          razorpay_payment_id,
          razorpay_signature,
          paymentMethod,
          currentTime,
          currentTime,
          payment.payment_id,
        ]
      );

      // ── Step 6: Activate subscription
      if (payment.subscription_id) {
        // Calculate period (30 days from now)
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 30);

        const periodStartStr = periodStart.toISOString().slice(0, 19).replace('T', ' ');
        const periodEndStr = periodEnd.toISOString().slice(0, 19).replace('T', ' ');

        // Deactivate previous active subscriptions for this user
        await conn.query(
          `UPDATE subscriptions 
           SET status = 'Expired', updated_at = ? 
           WHERE user_id = ? AND subscription_id != ? AND status = 'Active'`,
          [currentTime, userId, payment.subscription_id]
        );

        // Mark current subscription Active
        await conn.query(
          `UPDATE subscriptions SET
            status = 'Active',
            start_date = COALESCE(start_date, ?),
            current_period_start = ?,
            current_period_end = ?,
            cancel_at_period_end = 0,
            cancelled_at = NULL,
            updated_at = ?
           WHERE subscription_id = ?`,
          [
            currentTime,
            periodStartStr,
            periodEndStr,
            currentTime,
            payment.subscription_id,
          ]
        );
      }

      // ── Step 7: Record audit activity
      await conn.query(
        `INSERT INTO activity (user_id, action, created_at)
         VALUES (?, ?, ?)`,
        [
          userId,
          `Payment Verified: Successfully subscribed to plan. Receipt #: ${payment.receipt_number}, Amount: ${payment.currency} ${payment.amount}`,
          currentTime,
        ]
      );

      await conn.commit();

      res.json({
        success: true,
        message: 'Payment verified and DevFlow subscription activated successfully!',
        paymentId: payment.payment_id,
        receiptNumber: payment.receipt_number,
        amount: payment.amount,
        currency: payment.currency,
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  },

  /**
   * POST /api/payments/webhook
   * Handles incoming Razorpay webhooks with cryptographic signature verification
   * and idempotency via unique event_id constraint.
   */
  async handleWebhook(req, res, next) {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!signature) {
      return res.status(400).json({ error: 'Missing Razorpay webhook signature header' });
    }

    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('⚠️ Webhook signature validation failed');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody.toString());
    const eventId = event.event_id || event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const eventType = event.event;
    const entity = event.payload?.payment?.entity || event.payload?.order?.entity || {};

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Idempotency Check: check if event has already been recorded
      const [existingEvent] = await conn.query(
        'SELECT * FROM payment_events WHERE event_id = ? FOR UPDATE',
        [eventId]
      );

      if (existingEvent.length > 0) {
        await conn.commit();
        // Webhook already processed, safely return HTTP 200 (Idempotent response)
        return res.status(200).json({ status: 'ok', message: 'Event already processed' });
      }

      // Record event in payment_events table
      const currentTime = now();
      await conn.query(
        `INSERT INTO payment_events (event_id, event_type, razorpay_entity_id, payload, processed, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [
          eventId,
          eventType,
          entity.id || null,
          JSON.stringify(event),
          currentTime,
        ]
      );

      // Handle specific Razorpay webhook events
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const orderId = entity.order_id;
        const paymentId = entity.id;

        if (orderId) {
          const [pmts] = await conn.query(
            'SELECT * FROM payments WHERE razorpay_order_id = ? FOR UPDATE',
            [orderId]
          );

          if (pmts.length > 0) {
            const p = pmts[0];
            if (p.status !== 'Success') {
              const paymentMethod = entity.method || 'card';

              await conn.query(
                `UPDATE payments SET
                  razorpay_payment_id = ?,
                  status = 'Success',
                  payment_method = ?,
                  payment_time = ?,
                  updated_at = ?
                 WHERE payment_id = ?`,
                [paymentId, paymentMethod, currentTime, currentTime, p.payment_id]
              );

              if (p.subscription_id) {
                const periodStart = new Date();
                const periodEnd = new Date();
                periodEnd.setDate(periodEnd.getDate() + 30);

                await conn.query(
                  `UPDATE subscriptions SET
                    status = 'Active',
                    start_date = COALESCE(start_date, ?),
                    current_period_start = ?,
                    current_period_end = ?,
                    updated_at = ?
                   WHERE subscription_id = ?`,
                  [
                    currentTime,
                    periodStart.toISOString().slice(0, 19).replace('T', ' '),
                    periodEnd.toISOString().slice(0, 19).replace('T', ' '),
                    currentTime,
                    p.subscription_id,
                  ]
                );
              }
            }
          }
        }
      } else if (eventType === 'payment.failed') {
        const orderId = entity.order_id;
        const failureReason = entity.error_description || entity.error_reason || 'Payment failed';

        if (orderId) {
          await conn.query(
            `UPDATE payments SET
              status = 'Failed',
              failure_reason = ?,
              updated_at = ?
             WHERE razorpay_order_id = ? AND status != 'Success'`,
            [failureReason, currentTime, orderId]
          );
        }
      } else if (eventType === 'refund.processed' || eventType === 'payment.refunded') {
        const paymentId = entity.payment_id || entity.id;
        if (paymentId) {
          await conn.query(
            `UPDATE payments SET
              status = 'Refunded',
              updated_at = ?
             WHERE razorpay_payment_id = ?`,
            [currentTime, paymentId]
          );

          // Expire subscription if refunded
          const [pmts] = await conn.query('SELECT subscription_id FROM payments WHERE razorpay_payment_id = ?', [paymentId]);
          if (pmts.length > 0 && pmts[0].subscription_id) {
            await conn.query(
              `UPDATE subscriptions SET status = 'Expired', updated_at = ? WHERE subscription_id = ?`,
              [currentTime, pmts[0].subscription_id]
            );
          }
        }
      }

      // Mark event as processed
      await conn.query(
        'UPDATE payment_events SET processed = 1, processed_at = ? WHERE event_id = ?',
        [currentTime, eventId]
      );

      await conn.commit();
      res.status(200).json({ status: 'ok', message: 'Webhook processed successfully' });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  },

  /**
   * GET /api/payments/history
   * Returns authenticated user's own payment history
   */
  async getPaymentHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const payments = await query(
        `SELECT 
          p.payment_id,
          p.receipt_number,
          p.amount,
          p.currency,
          p.status,
          p.payment_method,
          p.payment_time,
          p.created_at,
          pl.name AS plan_name,
          pl.code AS plan_code,
          s.member_count,
          s.billing_interval
         FROM payments p
         LEFT JOIN subscriptions s ON p.subscription_id = s.subscription_id
         LEFT JOIN plans pl ON s.plan_id = pl.plan_id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC`,
        [userId]
      );

      res.json({ payments });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/payments/:paymentId
   * Return single payment details with user ownership validation
   */
  async getPaymentById(req, res, next) {
    try {
      const paymentId = req.params.paymentId;
      const userId = req.user.id;
      const isAdmin = (req.user.role || '').toLowerCase() === 'admin';

      const payment = await one(
        `SELECT 
          p.*,
          u.name AS user_name,
          u.email AS user_email,
          pl.name AS plan_name,
          pl.code AS plan_code,
          s.member_count,
          s.billing_interval
         FROM payments p
         JOIN users u ON p.user_id = u.user_id
         LEFT JOIN subscriptions s ON p.subscription_id = s.subscription_id
         LEFT JOIN plans pl ON s.plan_id = pl.plan_id
         WHERE p.payment_id = ?`,
        [paymentId]
      );

      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      // Authorization Check (Prevent IDOR)
      if (payment.user_id !== userId && !isAdmin) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view this payment' });
      }

      res.json({ payment });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/payments/:paymentId/receipt
   * Streams a downloadable professional PDF receipt.
   * Verifies that the authenticated user owns the receipt (or is Admin).
   */
  async downloadReceipt(req, res, next) {
    try {
      const paymentId = req.params.paymentId;
      const userId = req.user.id;
      const isAdmin = (req.user.role || '').toLowerCase() === 'admin';

      const payment = await one(
        `SELECT 
          p.*,
          u.name AS user_name,
          u.email AS user_email,
          u.designation,
          pl.name AS plan_name,
          pl.code AS plan_code,
          s.member_count,
          s.billing_interval
         FROM payments p
         JOIN users u ON p.user_id = u.user_id
         LEFT JOIN subscriptions s ON p.subscription_id = s.subscription_id
         LEFT JOIN plans pl ON s.plan_id = pl.plan_id
         WHERE p.payment_id = ?`,
        [paymentId]
      );

      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      // Ownership Authorization (Strict IDOR protection)
      if (payment.user_id !== userId && !isAdmin) {
        return res.status(403).json({ error: 'Access denied: You can only download your own receipts' });
      }

      if (payment.status !== 'Success') {
        return res.status(400).json({ error: 'Receipts can only be generated for successful payments' });
      }

      const filename = `DevFlow-Receipt-${payment.receipt_number}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      receiptService.generateReceiptPDF(payment, res);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/payments
   * Admin-only payment dashboard with server-side pagination, search,
   * filter by status/plan, sorting, and summary metrics.
   */
  async getAdminPayments(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const offset = (page - 1) * limit;

      const search = (req.query.search || '').trim();
      const status = (req.query.status || '').trim();
      const plan = (req.query.plan || '').trim();

      const allowedSort = ['payment_id', 'amount', 'created_at', 'status', 'receipt_number'];
      const sortCol = allowedSort.includes(req.query.sortBy) ? req.query.sortBy : 'p.created_at';
      const sortDir = req.query.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      let whereConditions = [];
      let queryParams = [];

      if (search) {
        whereConditions.push('(p.receipt_number LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR p.razorpay_payment_id LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (status) {
        whereConditions.push('p.status = ?');
        queryParams.push(status);
      }

      if (plan) {
        whereConditions.push('pl.code = ?');
        queryParams.push(plan);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count total records
      const countSql = `
        SELECT COUNT(*) AS total
        FROM payments p
        JOIN users u ON p.user_id = u.user_id
        LEFT JOIN subscriptions s ON p.subscription_id = s.subscription_id
        LEFT JOIN plans pl ON s.plan_id = pl.plan_id
        ${whereClause}
      `;
      const countResult = await query(countSql, queryParams);
      const totalRecords = countResult[0]?.total || 0;
      const totalPages = Math.ceil(totalRecords / limit);

      // Fetch paginated records
      const listSql = `
        SELECT 
          p.payment_id,
          p.receipt_number,
          p.amount,
          p.currency,
          p.status,
          p.payment_method,
          p.razorpay_payment_id,
          p.razorpay_order_id,
          p.payment_time,
          p.created_at,
          u.user_id,
          u.name AS user_name,
          u.email AS user_email,
          pl.name AS plan_name,
          pl.code AS plan_code,
          s.member_count,
          s.status AS subscription_status
        FROM payments p
        JOIN users u ON p.user_id = u.user_id
        LEFT JOIN subscriptions s ON p.subscription_id = s.subscription_id
        LEFT JOIN plans pl ON s.plan_id = pl.plan_id
        ${whereClause}
        ORDER BY ${sortCol.includes('.') ? sortCol : 'p.' + sortCol} ${sortDir}
        LIMIT ? OFFSET ?
      `;

      const payments = await query(listSql, [...queryParams, limit, offset]);

      // Summary Statistics calculated directly in MySQL
      const statsSql = `
        SELECT 
          COUNT(*) AS total_payments,
          SUM(CASE WHEN status = 'Success' THEN 1 ELSE 0 END) AS successful_payments,
          SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) AS failed_payments,
          SUM(CASE WHEN status = 'Success' THEN amount ELSE 0 END) AS total_revenue
        FROM payments
      `;
      const [stats] = await query(statsSql);

      const [subStats] = await query(`
        SELECT COUNT(*) AS active_subscriptions 
        FROM subscriptions 
        WHERE status = 'Active'
      `);

      res.json({
        payments,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,
        },
        summary: {
          totalPayments: stats.total_payments || 0,
          successfulPayments: stats.successful_payments || 0,
          failedPayments: stats.failed_payments || 0,
          totalRevenue: parseFloat(stats.total_revenue || 0).toFixed(2),
          activeSubscriptions: subStats.active_subscriptions || 0,
          currency: pricingService.getCurrency(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

export default paymentController;
