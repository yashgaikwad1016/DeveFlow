import express from 'express';
import { listSprints, createSprint, updateSprint, deleteSprint, sprintReport } from '../controllers/sprintController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, listSprints);
router.post('/', auth, requireRole('Admin', 'Manager'), createSprint);
router.put('/:id', auth, requireRole('Admin', 'Manager'), updateSprint);
router.delete('/:id', auth, requireRole('Admin', 'Manager'), deleteSprint);
router.get('/:id/report', auth, sprintReport);

export default router;
