import express from 'express';
import { dashboard, search } from '../controllers/dashboardController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/dashboard', auth, dashboard);
router.get('/search', auth, search);

export default router;
