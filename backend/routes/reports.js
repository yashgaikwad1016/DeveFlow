import express from 'express';
import { projectReport, getSettings, updateSettings } from '../controllers/reportController.js';
import { sprintReport } from '../controllers/sprintController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/reports/project/:id', auth, projectReport);
router.get('/reports/sprint/:id', auth, sprintReport);
router.get('/settings', auth, getSettings);
router.put('/settings', auth, requireRole('Admin'), updateSettings);

export default router;
