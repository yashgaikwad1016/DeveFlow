import express from 'express';
import { listSprints, createSprint, updateSprint, deleteSprint, sprintReport } from '../controllers/sprintController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { validateSprint, validateIntId } from '../middleware/validator.js';
import { idempotency } from '../middleware/idempotency.js';

const router = express.Router();

router.get('/', auth, listSprints);
router.post('/', auth, requireRole('Admin', 'Manager'), idempotency(), validateSprint(true), createSprint);
router.put('/:id', validateIntId('id'), auth, requireRole('Admin', 'Manager'), validateSprint(false), updateSprint);
router.delete('/:id', validateIntId('id'), auth, requireRole('Admin', 'Manager'), deleteSprint);
router.get('/:id/report', validateIntId('id'), auth, sprintReport);


export default router;

