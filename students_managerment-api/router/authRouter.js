const express = require('express');

const router = express.Router();

const authController =
    require('../controller/auth_controller.js');

const authMiddleware =
    require('../middleware/authMiddleware.js');

const authRateLimiter =
    require('../middleware/authRateLimiter.js');
const biometricAuthRateLimiter =
    require('../middleware/biometricAuthRateLimiter.js');
const faceAuthRateLimiter =
    require('../middleware/faceAuthRateLimiter.js');
const loginRateLimiter =
    require('../middleware/loginRateLimiter.js');
const passwordLoginProtection =
    require('../middleware/passwordLoginProtection.js');

const requireTrustedOrigin =
    require('../middleware/requireTrustedOrigin.js');

const requireRole = require('../middleware/roleMiddleware.js');
const uploadAvatarFile = require('../middleware/avatarUploadMiddleware');
const avatarController = require('../controller/avatarController');
const userPreferencesController = require('../controller/userPreferencesController.js');
const advancedAuthController = require('../controller/advancedAuthController.js');
const faceAuthController = require('../controller/faceAuthController.js');
const faceFrameUpload = require('../middleware/faceFrameUploadMiddleware.js');
const faceFrameRateLimiter = require('../middleware/faceFrameRateLimiter.js');



// Application-managed Face Login is separate from Passkey/WebAuthn.
// Login and enrollment remain fail-closed until server-side model inference/PAD is deployed.
router.get('/face/status', authMiddleware, faceAuthController.status);
router.post('/face/enrollment/options', requireTrustedOrigin, authMiddleware, faceAuthRateLimiter, faceAuthController.beginEnrollment);
router.post('/face/enrollment/frame', requireTrustedOrigin, authMiddleware, faceFrameRateLimiter, faceFrameUpload, faceAuthController.captureEnrollmentFrame);
router.post('/face/enrollment/verify', requireTrustedOrigin, authMiddleware, faceAuthRateLimiter, faceAuthController.finishEnrollment);
router.delete('/face/enrollment/challenge', requireTrustedOrigin, authMiddleware, faceAuthRateLimiter, faceAuthController.cancelEnrollment);
router.delete('/face/credential', requireTrustedOrigin, authMiddleware, faceAuthRateLimiter, faceAuthController.disable);
router.post('/face/login/options', requireTrustedOrigin, faceAuthRateLimiter, faceAuthController.beginLogin);
router.post('/face/login/frame', requireTrustedOrigin, faceFrameRateLimiter, faceFrameUpload, faceAuthController.captureLoginFrame);
router.post('/face/login/verify', requireTrustedOrigin, faceAuthRateLimiter, faceAuthController.finishLogin);

// Advanced account authentication. These routes reuse the existing JWT/session middleware.
router.post('/google/login', requireTrustedOrigin, authRateLimiter, advancedAuthController.loginGoogle);
router.post('/google/link', authMiddleware, authRateLimiter, advancedAuthController.linkGoogle);
router.get('/google/link', authMiddleware, advancedAuthController.getGoogleLink);
router.delete('/google/link', authMiddleware, authRateLimiter, advancedAuthController.unlinkGoogle);

router.post('/passkeys/reauth/options', authMiddleware, authRateLimiter, advancedAuthController.beginSensitiveReauth);
router.post('/passkeys/reauth/verify', authMiddleware, authRateLimiter, advancedAuthController.finishSensitiveReauth);

router.post('/passkeys/registration/options', authMiddleware, authRateLimiter, advancedAuthController.beginPasskeyRegistration);
router.post('/passkeys/registration/verify', authMiddleware, authRateLimiter, advancedAuthController.finishPasskeyRegistration);
router.get('/passkeys', authMiddleware, advancedAuthController.listPasskeys);
router.delete('/passkeys/:id', authMiddleware, authRateLimiter, advancedAuthController.deletePasskey);
router.post('/passkeys/login/options', authRateLimiter, advancedAuthController.beginPasskeyLogin);
router.post('/passkeys/login/verify', requireTrustedOrigin, authRateLimiter, advancedAuthController.finishPasskeyLogin);
 // Device biometric login (Face ID / Windows Hello when supported) uses WebAuthn.
 // The server verifies an assertion and never receives biometric samples.
 router.get('/biometric-login/status', authMiddleware, advancedAuthController.getBiometricLoginStatus);
 router.post('/biometric-login/options', requireTrustedOrigin, biometricAuthRateLimiter, advancedAuthController.beginBiometricLogin);
 router.post('/biometric-login/verify', requireTrustedOrigin, biometricAuthRateLimiter, advancedAuthController.finishBiometricLogin);

router.post('/qr-login', authRateLimiter, advancedAuthController.createQrLogin);
router.post('/qr-login/approve', authMiddleware, authRateLimiter, advancedAuthController.approveQrLogin);
router.post('/qr-login/deny', authRateLimiter, advancedAuthController.denyQrLogin);
router.post('/qr-login/poll', requireTrustedOrigin, authRateLimiter, advancedAuthController.pollQrLogin);

// REGISTER
router.post('/register', authRateLimiter, authController.register);

// LOGIN
// Count cooldown rejections against the IP safety quota as well, so repeatedly
// probing a cooling-down account cannot bypass the network-level limiter.
router.post('/login', requireTrustedOrigin, loginRateLimiter, passwordLoginProtection, authController.login);

// REFRESH
router.post('/refresh', requireTrustedOrigin, authRateLimiter, authController.refresh);

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
router.post('/logout', requireTrustedOrigin, authController.logout);
router.post('/test-email', authMiddleware, requireRole('admin'), authRateLimiter, authController.testEmail);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);

module.exports = router;