import express from 'express';
import { aiPriority, aiPredict, aiPerformance, aiApply } from '../controllers/aiController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/priority', auth, aiPriority);
router.get('/predict', auth, aiPredict);
router.get('/performance', auth, aiPerformance);
router.post('/apply/:id', auth, requireRole('Admin', 'Manager'), aiApply);

export default router;
