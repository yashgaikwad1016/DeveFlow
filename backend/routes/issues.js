import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { listIssues, createIssue, updateIssue, deleteIssue } from '../controllers/issueController.js';
import { auth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const ALLOWED_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `issue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      return cb(new Error(`File type '${ext}' is not permitted. Only image files (${ALLOWED_IMAGE_EXTS.join(', ')}) are accepted.`));
    }
    cb(null, true);
  },
});

import { validateIssue, validateIntId } from '../middleware/validator.js';
import { idempotency } from '../middleware/idempotency.js';

router.get('/', auth, listIssues);
router.post('/', auth, idempotency(), upload.single('screenshot'), validateIssue(true), createIssue);
router.put('/:id', validateIntId('id'), auth, validateIssue(false), updateIssue);
router.delete('/:id', validateIntId('id'), auth, deleteIssue);


export default router;

