const express = require('express');
const router = express.Router();
const { register, login, getMe, sendVerificationCode } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

/**
 * Send verification code
 */
router.post('/send-verification-code', sendVerificationCode);

/**
 * Register (cho phép ADMIN tạo user với role bất kỳ)
 */
router.post('/register', register);

/**
 * Login
 */
router.post('/login', login);

/**
 * Get current user profile
 */
router.get('/me', protect, getMe);

module.exports = router;