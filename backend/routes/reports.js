import express from 'express';
import { 
  projectReport, 
  getSettings, 
  updateSettings, 
  exportProjectCsv, 
  exportSprintCsv, 
  exportPaymentsCsv 
} from '../controllers/reportController.js';
import { sprintReport } from '../controllers/sprintController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { validateIntId } from '../middleware/validator.js';

const router = express.Router();

router.get('/reports/project/:id', validateIntId('id'), auth, projectReport);
router.get('/reports/project/:id/export', validateIntId('id'), auth, exportProjectCsv);
router.get('/reports/sprint/:id', validateIntId('id'), auth, sprintReport);
router.get('/reports/sprint/:id/export', validateIntId('id'), auth, exportSprintCsv);
router.get('/reports/payments/export', auth, requireRole('Admin'), exportPaymentsCsv);

router.get('/settings', auth, getSettings);
router.put('/settings', auth, requireRole('Admin'), updateSettings);

export default router;
