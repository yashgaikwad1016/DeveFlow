import { pool } from './db.js';

export async function initPaymentSchema() {
  const conn = await pool.getConnection();
  try {
    console.log('🔄 Initializing payment and subscription database tables...');

    // 1. plans table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS plans (
        plan_id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
        base_price DECIMAL(10,2) NOT NULL,
        per_member_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        min_members INT NOT NULL DEFAULT 1,
        max_members INT NOT NULL DEFAULT 1,
        razorpay_plan_id VARCHAR(100) NULL,
        features JSON NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME,
        updated_at DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. subscriptions table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        subscription_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        razorpay_subscription_id VARCHAR(100) NULL,
        razorpay_order_id VARCHAR(100) NULL,
        status ENUM('Created', 'Active', 'Pending', 'Past Due', 'Cancelled', 'Expired') NOT NULL DEFAULT 'Created',
        member_count INT NOT NULL DEFAULT 1,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
        start_date DATETIME NULL,
        current_period_start DATETIME NULL,
        current_period_end DATETIME NULL,
        cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
        cancelled_at DATETIME NULL,
        created_at DATETIME,
        updated_at DATETIME,
        INDEX idx_sub_user (user_id),
        INDEX idx_sub_status (status),
        INDEX idx_sub_rzp_sub (razorpay_subscription_id),
        INDEX idx_sub_rzp_order (razorpay_order_id),
        CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. payments table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        subscription_id INT NULL,
        razorpay_payment_id VARCHAR(100) UNIQUE NULL,
        razorpay_order_id VARCHAR(100) NOT NULL,
        razorpay_signature VARCHAR(255) NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        status ENUM('Created', 'Pending', 'Success', 'Completed', 'Failed', 'Refunded', 'Reversed') NOT NULL DEFAULT 'Created',
        payment_method VARCHAR(50) NULL,
        payment_reference VARCHAR(100) NULL,
        payment_time DATETIME NULL,
        failure_reason TEXT NULL,
        receipt_number VARCHAR(100) UNIQUE NOT NULL,
        idempotency_key VARCHAR(100) NULL,
        created_at DATETIME,
        updated_at DATETIME,
        INDEX idx_pmt_user (user_id),
        INDEX idx_pmt_order (razorpay_order_id),
        INDEX idx_pmt_status (status),
        INDEX idx_pmt_receipt (receipt_number),
        CONSTRAINT fk_pmt_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_pmt_sub FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure status enum on existing payments table supports both standard and banking status names
    try {
      await conn.query(`
        ALTER TABLE payments MODIFY COLUMN status 
        ENUM('Created', 'Pending', 'Success', 'Completed', 'Failed', 'Refunded', 'Reversed') 
        NOT NULL DEFAULT 'Created'
      `);
    } catch (e) {
      // Ignored if table was just created
    }

    // 4. payment_events table (Webhooks & audit log)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_events (
        event_id VARCHAR(100) PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        razorpay_entity_id VARCHAR(100) NULL,
        payload_hash VARCHAR(64) NULL,
        payload JSON NULL,
        processed TINYINT(1) NOT NULL DEFAULT 0,
        processed_at DATETIME NULL,
        created_at DATETIME,
        INDEX idx_evt_type (event_type),
        INDEX idx_evt_entity (razorpay_entity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default plans if not already populated
    const [existingPlans] = await conn.query('SELECT COUNT(*) AS count FROM plans');
    if (existingPlans[0].count === 0) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await conn.query(`
        INSERT INTO plans (code, name, billing_interval, base_price, per_member_price, currency, min_members, max_members, features, is_active, created_at, updated_at)
        VALUES
        ('individual', 'Individual', 'monthly', 5.00, 0.00, 'USD', 1, 1, 
         JSON_ARRAY('Single developer workspace', 'Unlimited tasks & issues', 'Sprint agile boards', 'Standard email support'), 1, ?, ?),
        ('team', 'Team', 'monthly', 0.00, 3.00, 'USD', 2, 50, 
         JSON_ARRAY('Collaborative agile teams (min 2 members)', 'Calculated dynamically: $3/member', 'Real-time sprint boards & burndown', 'Team activity logs & reports', 'Priority support'), 1, ?, ?),
        ('business', 'Business', 'monthly', 29.00, 0.00, 'USD', 1, 999, 
         JSON_ARRAY('Unlimited team members & projects', 'Advanced AI insights & predictive analytics', 'Enterprise audit logging & security', 'Dedicated account manager', '24/7 Priority SLA'), 1, ?, ?)
      `, [now, now, now, now, now, now]);
      console.log('✅ Default DevFlow subscription plans seeded successfully!');
    }

    console.log('✅ Payment and subscription database schema initialized successfully!');
  } catch (err) {
    console.error('❌ Failed to initialize payment database schema:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('paymentSchema.js')) {
  initPaymentSchema().then(() => process.exit(0)).catch(() => process.exit(1));
}
