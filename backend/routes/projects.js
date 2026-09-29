import express from 'express';
import { listProjects, createProject, updateProject, deleteProject, listMembers, addMember, removeMember } from '../controllers/projectController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, listProjects);
router.post('/', auth, requireRole('Admin', 'Manager'), createProject);
router.put('/:id', auth, requireRole('Admin', 'Manager'), updateProject);
router.delete('/:id', auth, requireRole('Admin', 'Manager'), deleteProject);
router.get('/:id/members', auth, listMembers);
router.post('/:id/members', auth, requireRole('Admin', 'Manager'), addMember);
router.delete('/:id/members/:uid', auth, requireRole('Admin', 'Manager'), removeMember);

export default router;
