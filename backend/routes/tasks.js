import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { listTasks, getTaskDetail, createTask, updateTask, deleteTask, addComment, addAttachment } from '../controllers/taskController.js';
import { auth, requireRole } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const ALLOWED_TASK_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.zip'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_TASK_EXTS.includes(ext)) {
      return cb(new Error(`File type '${ext}' is not permitted for security reasons.`));
    }
    cb(null, true);
  },
});

import { validateTask, validateIntId } from '../middleware/validator.js';
import { idempotency } from '../middleware/idempotency.js';

router.get('/', auth, requireRole('Admin'), listTasks);
router.get('/:id', validateIntId('id'), auth, requireRole('Admin'), getTaskDetail);
router.post('/', auth, requireRole('Admin'), idempotency(), validateTask(true), createTask);
router.put('/:id', validateIntId('id'), auth, requireRole('Admin'), validateTask(false), updateTask);
router.delete('/:id', validateIntId('id'), auth, requireRole('Admin'), deleteTask);
router.post('/:id/comments', validateIntId('id'), auth, requireRole('Admin'), idempotency(), addComment);
router.post('/:id/attachments', validateIntId('id'), auth, requireRole('Admin'), upload.single('file'), addAttachment);

export default router;


