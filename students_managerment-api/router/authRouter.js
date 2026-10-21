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
const userPreferencesController = require('../controller/userPreferencesController.js');
const advancedAuthController = require('../controller/advancedAuthController.js');


// Advanced account authentication. These routes reuse the existing JWT/session middleware.
router.post('/google/login', authRateLimiter, advancedAuthController.loginGoogle);
router.post('/google/link', authMiddleware, authRateLimiter, advancedAuthController.linkGoogle);

router.post('/passkeys/registration/options', authMiddleware, authRateLimiter, advancedAuthController.beginPasskeyRegistration);
router.post('/passkeys/registration/verify', authMiddleware, authRateLimiter, advancedAuthController.finishPasskeyRegistration);
router.get('/passkeys', authMiddleware, advancedAuthController.listPasskeys);
router.delete('/passkeys/:id', authMiddleware, authRateLimiter, advancedAuthController.deletePasskey);
router.post('/passkeys/login/options', authRateLimiter, advancedAuthController.beginPasskeyLogin);
router.post('/passkeys/login/verify', authRateLimiter, advancedAuthController.finishPasskeyLogin);

router.post('/qr-login', authRateLimiter, advancedAuthController.createQrLogin);
router.post('/qr-login/approve', authMiddleware, authRateLimiter, advancedAuthController.approveQrLogin);
router.post('/qr-login/deny', authRateLimiter, advancedAuthController.denyQrLogin);
router.post('/qr-login/poll', authRateLimiter, advancedAuthController.pollQrLogin);

// REGISTER
router.post('/register', authRateLimiter, authController.register);

// LOGIN
router.post('/login', authRateLimiter, authController.login);

// REFRESH
router.post('/refresh', authRateLimiter, authController.refresh);

// Account-level UI preferences (shared across devices)
router.get('/preferences', authMiddleware, userPreferencesController.getPreferences);
router.patch('/preferences', authMiddleware, userPreferencesController.updatePreferences);

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