import express from 'express';
import rateLimit from 'express-rate-limit';
import { getProfile, updateProfile } from '../controllers/profileController.js';
import { auth } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';

const router = express.Router();

const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many profile update requests, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/me', auth, getProfile);
router.put('/me', auth, profileLimiter, idempotency({ debounceWindowMs: 2000 }), updateProfile);

export default router;
