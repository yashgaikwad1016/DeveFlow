import express from 'express';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/userController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, listUsers);
router.post('/', auth, requireRole('Admin'), createUser);
router.put('/:id', auth, requireRole('Admin'), updateUser);
router.delete('/:id', auth, requireRole('Admin'), deleteUser);

export default router;
