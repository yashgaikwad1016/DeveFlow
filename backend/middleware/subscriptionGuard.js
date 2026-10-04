import { query, one } from '../config/db.js';

/**
 * Fetch the active subscription and entitlement limits for a given user.
 * @param {number} userId
 * @returns {Promise<{ hasActiveSub: boolean, planCode: string, planName: string, memberLimit: number, status: string }>}
 */
export async function getUserSubscription(userId) {
  if (!userId) {
    return {
      hasActiveSub: false,
      planCode: 'free',
      planName: 'Starter Free',
      memberLimit: 1,
      status: 'None',
    };
  }

  const sub = await one(
    `SELECT 
      s.subscription_id,
      s.status,
      s.member_count,
      s.current_period_end,
      p.code AS plan_code,
      p.name AS plan_name
     FROM subscriptions s
     JOIN plans p ON s.plan_id = p.plan_id
     WHERE s.user_id = ? AND s.status = 'Active'
     ORDER BY s.subscription_id DESC
     LIMIT 1`,
    [userId]
  );

  if (!sub) {
    return {
      hasActiveSub: false,
      planCode: 'free',
      planName: 'Starter Free',
      memberLimit: 1,
      status: 'Free',
    };
  }

  // Check if period has ended
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
    return {
      hasActiveSub: false,
      planCode: sub.plan_code,
      planName: sub.plan_name,
      memberLimit: 1,
      status: 'Expired',
    };
  }

  return {
    hasActiveSub: true,
    subscriptionId: sub.subscription_id,
    planCode: sub.plan_code,
    planName: sub.plan_name,
    memberLimit: sub.plan_code === 'business' ? 999 : (sub.member_count || 1),
    status: sub.status,
  };
}

/**
 * Middleware: Requires an active paid subscription (any active plan)
 */
export function requireActiveSubscription() {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Authentication required' });

      // Admins bypass subscription checks for platform operations
      if (user.role === 'Admin') return next();

      const sub = await getUserSubscription(user.id || user.user_id);
      if (!sub.hasActiveSub) {
        return res.status(403).json({
          error: 'This feature requires an active DevFlow subscription. Please upgrade your plan.',
          code: 'SUBSCRIPTION_REQUIRED',
          plan: sub.planName,
        });
      }

      req.subscription = sub;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: Requires a specific plan tier (e.g. 'team', 'business')
 */
export function requirePlan(...allowedPlanCodes) {
  const allowed = allowedPlanCodes.map(p => p.toLowerCase());
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Authentication required' });

      if (user.role === 'Admin') return next();

      const sub = await getUserSubscription(user.id || user.user_id);
      if (!sub.hasActiveSub || !allowed.includes(sub.planCode.toLowerCase())) {
        return res.status(403).json({
          error: `This feature requires a ${allowedPlanCodes.join(' or ')} plan. Your current plan: ${sub.planName}.`,
          code: 'UPGRADE_REQUIRED',
          requiredPlans: allowedPlanCodes,
          currentPlan: sub.planCode,
        });
      }

      req.subscription = sub;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Validates whether adding a member to a project violates the manager's subscription seat limit.
 * @param {number} projectId
 * @param {number} managerId
 * @returns {Promise<{ allowed: boolean, currentCount: number, limit: number, error?: string }>}
 */
export async function verifyProjectSeatLimit(projectId, managerId) {
  // Get manager's subscription entitlement
  const sub = await getUserSubscription(managerId);
  const limit = sub.memberLimit;

  // Count current active members in the project
  const [result] = await query(
    'SELECT COUNT(DISTINCT user_id) AS count FROM team_members WHERE project_id = ?',
    [projectId]
  );

  const currentCount = result?.count || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      currentCount,
      limit,
      planName: sub.planName,
      error: `Seat limit reached: Your current ${sub.planName} plan allows a maximum of ${limit} member${limit > 1 ? 's' : ''}. You currently have ${currentCount}. Please upgrade your Team plan seats in Billing.`,
    };
  }

  return {
    allowed: true,
    currentCount,
    limit,
    planName: sub.planName,
  };
}

export default {
  getUserSubscription,
  requireActiveSubscription,
  requirePlan,
  verifyProjectSeatLimit,
};
