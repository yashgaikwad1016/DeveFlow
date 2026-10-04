import config from '../config/config.js';
import { query, one } from '../config/db.js';

export class PricingService {
  /**
   * Get configured default currency (e.g. 'USD' or 'INR')
   */
  static getCurrency() {
    return (config.PAYMENT_CURRENCY || 'USD').toUpperCase();
  }

  /**
   * Get all active subscription plans from database with dynamic pricing metadata
   *
   * @param {string} [targetCurrency] - Optional currency ('USD' | 'INR')
   */
  static async getActivePlans(targetCurrency = null) {
    const currency = (targetCurrency || this.getCurrency()).toUpperCase();
    const rows = await query(
      'SELECT * FROM plans WHERE is_active = 1 ORDER BY plan_id ASC'
    );

    return rows.map((plan) => {
      let features = plan.features;
      if (typeof features === 'string') {
        try {
          features = JSON.parse(features);
        } catch (e) {
          features = [];
        }
      }

      const isINR = currency === 'INR';
      const basePrice = isINR
        ? plan.code === 'individual'
          ? 400
          : 2400
        : parseFloat(plan.base_price) || 0;

      const perMemberPrice = isINR
        ? 250
        : parseFloat(plan.per_member_price) || 3.0;

      const symbol = isINR ? '₹' : '$';

      return {
        id: plan.plan_id,
        code: plan.code,
        name: plan.name,
        billingInterval: plan.billing_interval,
        basePrice,
        perMemberPrice,
        currency,
        currencySymbol: symbol,
        minMembers: plan.min_members,
        maxMembers: plan.max_members,
        features: Array.isArray(features) ? features : [],
        // Pricing description for UI
        priceDisplay:
          plan.code === 'team'
            ? `${symbol}${perMemberPrice}/member/mo`
            : `${symbol}${basePrice}/mo`,
      };
    });
  }

  /**
   * Independently calculate and validate plan pricing on the server side.
   * NEVER trusts client-submitted amount or price.
   *
   * @param {string} planCode - 'individual' | 'team' | 'business'
   * @param {number} memberCount - Requested member count
   * @param {string} [targetCurrency] - 'USD' | 'INR'
   * @param {string} [paymentMethod] - 'upi' | 'card' | etc.
   * @returns {Promise<{ planId: number, planCode: string, planName: string, memberCount: number, amount: number, amountSubunits: number, currency: string, currencySymbol: string }>}
   */
  static async calculatePlanPrice(planCode, memberCount = 1, targetCurrency = null, paymentMethod = null) {
    if (!planCode || typeof planCode !== 'string') {
      const err = new Error('Invalid plan selection');
      err.statusCode = 400;
      throw err;
    }

    const cleanCode = planCode.trim().toLowerCase();
    const plan = await one(
      'SELECT * FROM plans WHERE code = ? AND is_active = 1',
      [cleanCode]
    );

    if (!plan) {
      const err = new Error(`Plan '${planCode}' does not exist or is inactive`);
      err.statusCode = 400;
      throw err;
    }

    // UPI is strictly an Indian INR payment rail; force INR when UPI is selected
    let currency = (targetCurrency || this.getCurrency()).toUpperCase();
    if (paymentMethod && paymentMethod.toLowerCase() === 'upi') {
      currency = 'INR';
    }

    const isINR = currency === 'INR';
    const symbol = isINR ? '₹' : '$';
    const parsedMembers = parseInt(memberCount, 10);
    let finalMembers = 1;
    let finalAmount = 0;

    if (cleanCode === 'individual') {
      finalMembers = 1;
      finalAmount = isINR ? 400.0 : 5.0; // ₹400 or $5/month
    } else if (cleanCode === 'team') {
      if (isNaN(parsedMembers) || parsedMembers < 2) {
        const err = new Error('Team plan requires a minimum of 2 members');
        err.statusCode = 400;
        throw err;
      }
      if (parsedMembers > 50) {
        const err = new Error('Team plan allows a maximum of 50 members. For larger teams, please choose Business.');
        err.statusCode = 400;
        throw err;
      }
      finalMembers = parsedMembers;
      // Formula:
      // USD: team_price = member_count × $3
      // INR: team_price = member_count × ₹250
      const perMember = isINR ? 250.0 : parseFloat(plan.per_member_price) || 3.0;
      finalAmount = Number((finalMembers * perMember).toFixed(2));
    } else if (cleanCode === 'business') {
      finalMembers = isNaN(parsedMembers) || parsedMembers < 1 ? 1 : parsedMembers;
      finalAmount = isINR ? 2400.0 : 29.0; // ₹2400 or $29/month
    } else {
      const err = new Error(`Unknown plan code: ${planCode}`);
      err.statusCode = 400;
      throw err;
    }

    // Convert to smallest currency unit (cents or paise)
    const amountSubunits = Math.round(finalAmount * 100);

    return {
      planId: plan.plan_id,
      planCode: plan.code,
      planName: plan.name,
      memberCount: finalMembers,
      amount: finalAmount,
      amountSubunits,
      currency,
      currencySymbol: symbol,
      billingInterval: plan.billing_interval || 'monthly',
      paymentMethod: paymentMethod || (isINR ? 'upi' : 'card'),
    };
  }
}

export default PricingService;
