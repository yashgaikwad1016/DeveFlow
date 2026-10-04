import Razorpay from 'razorpay';
import crypto from 'crypto';
import config from '../config/config.js';

class RazorpayService {
  constructor() {
    this.keyId = config.RAZORPAY_KEY_ID;
    this.keySecret = config.RAZORPAY_KEY_SECRET;
    this.webhookSecret = config.RAZORPAY_WEBHOOK_SECRET;

    if (!this.keyId || !this.keySecret) {
      console.warn('⚠️ Razorpay API keys are not configured properly');
    }

    this.client = new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });
  }

  /**
   * Return the public Key ID for client checkout initialization
   */
  getPublicKeyId() {
    return this.keyId;
  }

  /**
   * Create a server-side Razorpay Order.
   *
   * @param {object} params
   * @param {number} params.amountSubunits - Amount in cents/paise (e.g., 500 for $5.00)
   * @param {string} params.currency - Currency code (e.g., 'USD', 'INR')
   * @param {string} params.receipt - Short receipt identifier (<= 40 chars)
   * @param {object} [params.notes] - Key-value metadata notes
   * @returns {Promise<object>} Razorpay Order object
   */
  async createOrder({ amountSubunits, currency, receipt, notes = {} }) {
    if (!amountSubunits || amountSubunits <= 0) {
      throw new Error('Invalid order amount');
    }

    const options = {
      amount: amountSubunits,
      currency: currency || 'USD',
      receipt: receipt.slice(0, 40), // Razorpay limits receipt to 40 characters
      notes: {
        platform: 'DevFlow Agile Workspace',
        ...notes,
      },
    };

    try {
      const order = await this.client.orders.create(options);
      return order;
    } catch (err) {
      console.error('Razorpay createOrder error:', err);
      const message = err.error?.description || err.message || 'Failed to create Razorpay order';
      const error = new Error(message);
      error.statusCode = 502;
      throw error;
    }
  }

  /**
   * Fetch payment details directly from Razorpay API.
   *
   * @param {string} paymentId
   * @returns {Promise<object>}
   */
  async fetchPayment(paymentId) {
    if (!paymentId) throw new Error('Payment ID is required');
    try {
      return await this.client.payments.fetch(paymentId);
    } catch (err) {
      console.error('Razorpay fetchPayment error:', err);
      throw err;
    }
  }

  /**
   * Verify Razorpay Payment Signature (HMAC SHA-256)
   * Prevents fraudulent client payment confirmation reports.
   *
   * @param {string} orderId
   * @param {string} paymentId
   * @param {string} signature
   * @returns {boolean}
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    if (!orderId || !paymentId || !signature) {
      return false;
    }

    try {
      const generatedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const genBuf = Buffer.from(generatedSignature, 'utf-8');
      const sigBuf = Buffer.from(signature, 'utf-8');

      if (genBuf.length !== sigBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(genBuf, sigBuf);
    } catch (e) {
      console.error('Signature verification error:', e.message);
      return false;
    }
  }

  /**
   * Verify Razorpay Webhook Signature using raw payload buffer
   *
   * @param {Buffer|string} rawBody - Raw unparsed webhook body
   * @param {string} signature - Value from 'x-razorpay-signature' header
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!rawBody || !signature || !this.webhookSecret) {
      return false;
    }

    try {
      const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');

      const expBuf = Buffer.from(expectedSignature, 'utf-8');
      const sigBuf = Buffer.from(signature, 'utf-8');

      if (expBuf.length !== sigBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expBuf, sigBuf);
    } catch (e) {
      console.error('Webhook signature verification error:', e.message);
      return false;
    }
  }
}

export const razorpayService = new RazorpayService();
export default razorpayService;
