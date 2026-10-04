import express from 'express';
import { aiPriority, aiPredict, aiPerformance, aiApply } from '../controllers/aiController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscriptionGuard.js';

const router = express.Router();

// AI features require an active DevFlow subscription
router.get('/priority', auth, requireActiveSubscription(), aiPriority);
router.get('/predict', auth, requireActiveSubscription(), aiPredict);
router.get('/performance', auth, requireActiveSubscription(), aiPerformance);
router.post('/apply/:id', auth, requireRole('Admin', 'Manager'), requireActiveSubscription(), aiApply);

export default router;
