import { Router } from 'express';
import paymentController from '../controllers/paymentController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = Router();

// Public plans endpoint
router.get('/plans', paymentController.getPlans);

// Webhook endpoint (strictly public for Razorpay incoming webhooks, verified via HMAC signature)
router.post('/webhook', paymentController.handleWebhook);

// Protected payment endpoints (require authenticated user session)
router.get('/config', auth, paymentController.getConfig);
router.post('/create-order', auth, paymentController.createOrder);
router.post('/verify', auth, paymentController.verifyPayment);
router.get('/history', auth, paymentController.getPaymentHistory);
router.get('/:paymentId', auth, paymentController.getPaymentById);
router.get('/:paymentId/receipt', auth, paymentController.downloadReceipt);

// Admin-only payment endpoints (Strict Authentication + Authorization check)
router.get('/admin/logs', auth, requireRole('Admin'), paymentController.getAdminPayments);

export default router;
