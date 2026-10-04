import { Router } from 'express';
import subscriptionController from '../controllers/subscriptionController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// All subscription operations require an authenticated user
router.get('/current', auth, subscriptionController.getCurrentSubscription);
router.post('/cancel', auth, subscriptionController.cancelSubscription);
router.post('/change-plan', auth, subscriptionController.changePlan);

export default router;
