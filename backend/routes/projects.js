import express from 'express';
import { listProjects, createProject, updateProject, deleteProject, listMembers, addMember, removeMember } from '../controllers/projectController.js';
import invitationController from '../controllers/invitationController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { validateProject, validateIntId } from '../middleware/validator.js';
import { idempotency } from '../middleware/idempotency.js';

const router = express.Router();

router.get('/', auth, listProjects);
router.post('/', auth, requireRole('Admin', 'Manager'), idempotency(), validateProject(true), createProject);
router.put('/:id', validateIntId('id'), auth, requireRole('Admin', 'Manager'), validateProject(false), updateProject);
router.delete('/:id', validateIntId('id'), auth, requireRole('Admin', 'Manager'), deleteProject);
router.get('/:id/members', validateIntId('id'), auth, listMembers);
router.post('/:id/members', validateIntId('id'), auth, requireRole('Admin', 'Manager'), idempotency(), addMember);
router.delete('/:id/members/:uid', validateIntId('id'), validateIntId('uid'), auth, requireRole('Admin', 'Manager'), removeMember);

// Project Invitation Management
router.get('/:id/invitations', validateIntId('id'), auth, requireRole('Admin', 'Manager'), invitationController.listInvitations);
router.post('/:id/invitations', validateIntId('id'), auth, requireRole('Admin', 'Manager'), idempotency(), invitationController.createInvitation);
router.delete('/:id/invitations/:inviteId', validateIntId('id'), validateIntId('inviteId'), auth, requireRole('Admin', 'Manager'), invitationController.revokeInvitation);

export default router;


