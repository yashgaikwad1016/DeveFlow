const express = require('express');
const router = express.Router();
const { status, setup, login, forgot, getMe, updateMe } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.get('/status', status);
router.post('/setup', setup);
router.post('/login', login);
router.post('/forgot', forgot);
router.get('/me', auth, getMe);
router.put('/me', auth, updateMe);

module.exports = router;
