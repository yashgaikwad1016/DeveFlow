import express from 'express';
import { listNotifications, markAllRead, listActivity } from '../controllers/notificationController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/notifications', auth, listNotifications);
router.put('/notifications/read', auth, markAllRead);
router.get('/activity', auth, listActivity);

export default router;
