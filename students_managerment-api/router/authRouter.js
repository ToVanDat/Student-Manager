const express = require('express');

const router = express.Router();

const authController =
    require('../controller/auth_controller.js');

const authMiddleware =
    require('../middleware/authMiddleware.js');

const authRateLimiter =
    require('../middleware/authRateLimiter.js');

const requireRole = require('../middleware/roleMiddleware.js');
const uploadAvatarFile = require('../middleware/avatarUploadMiddleware');
const avatarController = require('../controller/avatarController');

// REGISTER
router.post('/register', authRateLimiter, authController.register);

// LOGIN
router.post('/login', authRateLimiter, authController.login);

// REFRESH
router.post('/refresh', authRateLimiter, authController.refresh);

// GET CURRENT USER
router.get('/me', authMiddleware, authController.getMe);

// UPDATE PROFILE
router.patch('/me', authMiddleware, authController.updateProfile);

// Avatar bytes are decoded and re-encoded as WebP before being made public.
router.post('/avatar', authMiddleware, uploadAvatarFile, avatarController.uploadAvatar);

// CHANGE PASSWORD
router.post('/change-password', authMiddleware, authController.changePassword);
router.post('/verify-reset-otp', authRateLimiter, authController.verifyResetOtp);
router.post('/logout', authController.logout);
router.post('/test-email', authMiddleware, requireRole('admin'), authRateLimiter, authController.testEmail);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);

module.exports = router;