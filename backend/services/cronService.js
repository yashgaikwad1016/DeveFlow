import cron from 'node-cron';
import { query, run, now } from '../config/db.js';
import { sendEmail } from './email.service.js';
import config from '../config/config.js';

export const cronService = {
  /**
   * Scans active subscriptions whose period has elapsed (current_period_end < NOW()).
   * Transitions them to 'Expired' (or 'Cancelled' if marked to cancel at period end).
   */
  async processExpiredSubscriptions() {
    try {
      const currentTime = now();
      const expiredSubs = await query(
        `SELECT 
          s.subscription_id, 
          s.user_id, 
          s.cancel_at_period_end,
          u.name AS user_name,
          u.email AS user_email,
          pl.name AS plan_name
         FROM subscriptions s
         JOIN users u ON s.user_id = u.user_id
         JOIN plans pl ON s.plan_id = pl.plan_id
         WHERE s.status = 'Active' 
           AND s.current_period_end IS NOT NULL 
           AND s.current_period_end < NOW()`
      );

      if (!expiredSubs || expiredSubs.length === 0) {
        return 0;
      }

      console.log(`⏰ Cron: Found ${expiredSubs.length} expired subscription(s) to process.`);

      for (const sub of expiredSubs) {
        const nextStatus = sub.cancel_at_period_end ? 'Cancelled' : 'Expired';
        await run(
          `UPDATE subscriptions SET status = ?, updated_at = ? WHERE subscription_id = ?`,
          [nextStatus, currentTime, sub.subscription_id]
        );

        // Record activity log
        await run(
          `INSERT INTO activity (user_id, action, created_at) VALUES (?, ?, ?)`,
          [
            sub.user_id,
            `Subscription ${nextStatus}: Your ${sub.plan_name} plan has completed its billing cycle. Workspace reverted to Starter limits.`,
            currentTime,
          ]
        );

        // Send friendly notification email
        if (sub.user_email) {
          try {
            const subject = `Your DevFlow ${sub.plan_name} subscription has expired`;
            const html = `
              <div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
                <h2>Your DevFlow Subscription Has Expired</h2>
                <p>Hi ${sub.user_name || 'there'},</p>
                <p>Your subscription to <strong>${sub.plan_name}</strong> has ended its billing period.</p>
                <p>Your account is now on the Starter tier. To restore unlimited members and premium AI features, you can renew anytime:</p>
                <p><a href="${config.CLIENT_URL || 'http://localhost:5173'}/dashboard/settings" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">Renew Subscription</a></p>
                <p>Thanks,<br/>DevFlow Team</p>
              </div>
            `;
            await sendEmail(sub.user_email, subject, `Your ${sub.plan_name} subscription has expired.`, html);
          } catch (emailErr) {
            console.warn(`Failed to send expiry email to ${sub.user_email}:`, emailErr.message);
          }
        }
      }

      return expiredSubs.length;
    } catch (err) {
      console.error('❌ Error processing expired subscriptions in cron:', err.message);
      return 0;
    }
  },

  /**
   * Scans project invitations that have expired without being accepted.
   */
  async processExpiredInvitations() {
    try {
      const result = await run(
        `UPDATE project_invitations 
         SET status = 'Expired' 
         WHERE status = 'Pending' AND expires_at < NOW()`
      );
      return result.affectedRows || 0;
    } catch (err) {
      // Table might not exist yet if invitations haven't been seeded, silently ignore
      return 0;
    }
  },

  /**
   * Initializes the scheduled cron jobs.
   * Runs daily at midnight ('0 0 * * *') and runs once on server startup.
   */
  initCronJobs() {
    console.log('⏰ Initializing DevFlow automated background workers...');

    // Run once on startup after a 5-second delay so DB connections are fully ready
    setTimeout(async () => {
      try {
        const expiredCount = await cronService.processExpiredSubscriptions();
        if (expiredCount > 0) {
          console.log(`✅ Startup check: Processed ${expiredCount} expired subscription(s).`);
        }
      } catch (err) {
        console.error('Error during startup subscription expiry check:', err.message);
      }
    }, 5000);

    // Schedule daily check at midnight
    const task = cron.schedule('0 0 * * *', async () => {
      console.log('⏰ Executing daily scheduled subscription & invitation expiry check...');
      await cronService.processExpiredSubscriptions();
      await cronService.processExpiredInvitations();
    });

    return task;
  },
};

export default cronService;
