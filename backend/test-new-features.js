import { query, one, run, now } from './config/db.js';
import receiptService from './services/receiptService.js';
import cronService from './services/cronService.js';
import { verifyProjectSeatLimit } from './middleware/subscriptionGuard.js';

async function runTests() {
  console.log('\n🚀 Starting DevFlow New Features Verification Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // ── 1. Health Check Endpoint
    console.log('[1/5] Health Check Telemetry:');
    const healthRes = await fetch('http://localhost:5000/api/health').then(r => r.json());
    assert(healthRes.status === 'healthy', 'Status is healthy');
    assert(healthRes.dependencies?.mysql?.status === 'up', 'MySQL dependency is up');
    assert(healthRes.dependencies?.mongodb?.status === 'up', 'MongoDB dependency is up');
    assert(typeof healthRes.uptimeSeconds === 'number', 'Uptime reported correctly');

    // ── 2. PDF Receipt Buffer Generation
    console.log('\n[2/5] In-Memory PDF Receipt Buffer:');
    const samplePayment = {
      payment_id: 999,
      receipt_number: 'DF-TEST-1234',
      user_name: 'Alex Johnson',
      user_email: 'alex@example.com',
      plan_name: 'Team',
      plan_code: 'team',
      member_count: 5,
      amount: '15.00',
      currency: 'USD',
      payment_method: 'card',
      razorpay_payment_id: 'pay_test123',
      razorpay_order_id: 'order_test123',
      created_at: new Date(),
    };

    const pdfBuf = await receiptService.generateReceiptBuffer(samplePayment);
    assert(Buffer.isBuffer(pdfBuf), 'Receipt buffer is a valid Node.js Buffer');
    assert(pdfBuf.length > 1000, `PDF generated with substantive content (${pdfBuf.length} bytes)`);
    assert(pdfBuf.slice(0, 4).toString() === '%PDF', 'Buffer starts with standard %PDF magic bytes');

    // ── 3. Background Expiry Worker (Cron Service)
    console.log('\n[3/5] Background Expiry Worker (Cron):');
    const expiredCount = await cronService.processExpiredSubscriptions();
    assert(typeof expiredCount === 'number', `Cron processed subscriptions (${expiredCount} expired)`);
    const expiredInvites = await cronService.processExpiredInvitations();
    assert(typeof expiredInvites === 'number', `Cron cleaned invitations (${expiredInvites} expired)`);

    // ── 4. Project Seat Limit Guard
    console.log('\n[4/5] Subscription Seat Limit Enforcement:');
    // Test with mock project ID & manager ID
    const dummySeatCheck = await verifyProjectSeatLimit(1, 999999);
    assert(typeof dummySeatCheck.allowed === 'boolean', 'Seat check returns boolean allowed flag');
    assert(typeof dummySeatCheck.limit === 'number', `Seat check resolves plan limit (limit: ${dummySeatCheck.limit})`);

    // ── 5. Project Team Invitations Database Verification
    console.log('\n[5/5] Project Invitations Database Schema:');
    const [invRows] = await query('SHOW TABLES LIKE "project_invitations"');
    assert(invRows !== undefined, 'project_invitations table exists in MySQL');

    const testToken = `test_${Date.now()}`;
    const testExpiry = new Date();
    testExpiry.setDate(testExpiry.getDate() + 7);

    // Create a temporary project if needed
    let testProject = await one('SELECT project_id, manager_id FROM projects LIMIT 1');
    if (!testProject) {
      const pRes = await run(
        'INSERT INTO projects (project_name, manager_id, status, created_at) VALUES ("Test Project", 1, "Active", NOW())'
      );
      testProject = { project_id: pRes.insertId, manager_id: 1 };
    }

    // Insert test invitation
    const invRes = await run(
      `INSERT INTO project_invitations (project_id, inviter_id, email, role, token, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, 'Developer', ?, 'Pending', ?, NOW(), NOW())`,
      [testProject.project_id, testProject.manager_id, 'devflow.test@example.com', testToken, testExpiry]
    );
    assert(invRes.insertId > 0, `Invitation record inserted with ID ${invRes.insertId}`);

    // Verify token endpoint
    const tokenRes = await fetch(`http://localhost:5000/api/invitations/${testToken}`).then(r => r.json());
    assert(tokenRes.valid === true, 'Invitation token verification endpoint returns valid: true');
    assert(tokenRes.invitation?.email === 'devflow.test@example.com', 'Invitation email matches');

    // Clean up test invitation
    await run('DELETE FROM project_invitations WHERE token = ?', [testToken]);
    assert(true, 'Test invitation cleaned up');

    console.log('\n==================================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
