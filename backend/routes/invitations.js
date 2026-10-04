import express from 'express';
import invitationController from '../controllers/invitationController.js';
import { auth } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';

const router = express.Router();

// GET /api/invitations/:token (Check invitation validity)
router.get('/:token', invitationController.verifyInvitationToken);

// POST /api/invitations/accept (Accept invitation and join project)
router.post('/accept', auth, idempotency(), invitationController.acceptInvitation);

export default router;
