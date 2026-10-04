import { pool, query, one, run, now } from '../config/db.js';
import pricingService from '../services/pricingService.js';
import razorpayService from '../services/razorpayService.js';
import crypto from 'crypto';

export const subscriptionController = {
  /**
   * GET /api/subscriptions/current
   * Returns authenticated user's current subscription & active plan details
   */
  async getCurrentSubscription(req, res, next) {
    try {
      const userId = req.user.id;

      // Find active or most recent subscription
      const sub = await one(
        `SELECT 
          s.*,
          p.code AS plan_code,
          p.name AS plan_name,
          p.base_price,
          p.per_member_price,
          p.features
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.plan_id
         WHERE s.user_id = ?
         ORDER BY (s.status = 'Active') DESC, s.created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (!sub) {
        return res.json({
          hasSubscription: false,
          subscription: null,
          plan: {
            code: 'free',
            name: 'Free Starter',
            memberCount: 1,
            features: [
              'Basic project tracking',
              'Single user access',
              'Community support',
            ],
          },
        });
      }

      let features = sub.features;
      if (typeof features === 'string') {
        try {
          features = JSON.parse(features);
        } catch (e) {
          features = [];
        }
      }

      res.json({
        hasSubscription: sub.status === 'Active',
        subscription: {
          id: sub.subscription_id,
          status: sub.status,
          planCode: sub.plan_code,
          planName: sub.plan_name,
          memberCount: sub.member_count,
          amount: sub.amount,
          currency: sub.currency,
          billingInterval: sub.billing_interval,
          startDate: sub.start_date,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          cancelledAt: sub.cancelled_at,
          features: Array.isArray(features) ? features : [],
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/subscriptions/cancel
   * Safely cancels the active subscription without deleting audit history
   */
  async cancelSubscription(req, res, next) {
    const conn = await pool.getConnection();
    try {
      const userId = req.user.id;

      await conn.beginTransaction();

      const [subs] = await conn.query(
        'SELECT * FROM subscriptions WHERE user_id = ? AND status = "Active" FOR UPDATE',
        [userId]
      );

      if (subs.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'No active subscription found to cancel' });
      }

      const activeSub = subs[0];
      const currentTime = now();

      // Mark cancelled at period end to honor the paid period, or Cancelled immediately
      await conn.query(
        `UPDATE subscriptions SET
          cancel_at_period_end = 1,
          cancelled_at = ?,
          status = 'Cancelled',
          updated_at = ?
         WHERE subscription_id = ?`,
        [currentTime, currentTime, activeSub.subscription_id]
      );

      // Audit activity
      await conn.query(
        `INSERT INTO activity (user_id, action, created_at)
         VALUES (?, ?, ?)`,
        [
          userId,
          `Cancelled DevFlow subscription (ID: ${activeSub.subscription_id})`,
          currentTime,
        ]
      );

      await conn.commit();

      res.json({
        success: true,
        message: 'Your DevFlow subscription has been cancelled. You will retain access until the end of your billing cycle.',
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  },

  /**
   * POST /api/subscriptions/change-plan
   * Initiates a plan change (upgrade, downgrade, or member count adjustment)
   */
  async changePlan(req, res, next) {
    const conn = await pool.getConnection();
    try {
      const userId = req.user.id;
      const { newPlan, memberCount } = req.body;

      if (!newPlan) {
        return res.status(400).json({ error: 'Please specify the new subscription plan' });
      }

      // Independent pricing calculation
      const pricing = await pricingService.calculatePlanPrice(newPlan, memberCount);
      const receiptNumber = `DF-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const shortReceipt = `rcpt_chg_${Date.now()}_${userId}`.slice(0, 40);

      // Create Razorpay Order for the change
      const rzpOrder = await razorpayService.createOrder({
        amountSubunits: pricing.amountSubunits,
        currency: pricing.currency,
        receipt: shortReceipt,
        notes: {
          userId: String(userId),
          planCode: pricing.planCode,
          memberCount: String(pricing.memberCount),
          action: 'plan_change',
        },
      });

      await conn.beginTransaction();

      const currentTime = now();

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

      await conn.query(
        `INSERT INTO payments (
          user_id, subscription_id, razorpay_order_id, amount, currency, 
          status, receipt_number, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'Created', ?, ?, ?)`,
        [
          userId,
          subResult.insertId,
          rzpOrder.id,
          pricing.amount,
          pricing.currency,
          receiptNumber,
          currentTime,
          currentTime,
        ]
      );

      await conn.commit();

      res.json({
        orderId: rzpOrder.id,
        amount: pricing.amount,
        amountSubunits: pricing.amountSubunits,
        currency: pricing.currency,
        keyId: razorpayService.getPublicKeyId(),
        plan: {
          code: pricing.planCode,
          name: pricing.planName,
          memberCount: pricing.memberCount,
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
};

export default subscriptionController;
