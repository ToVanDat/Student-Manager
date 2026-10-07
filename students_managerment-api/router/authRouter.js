const express = require('express');

const router = express.Router();

const authController =
    require('../controller/auth_controller.js');

const authMiddleware =
    require('../middleware/authMiddleware.js');

const authRateLimiter =
    require('../middleware/authRateLimiter.js');


// =====================================================
// REGISTER
// =====================================================

router.post(
    '/register',
    authRateLimiter,
    authController.register
);


// =====================================================
// LOGIN
// =====================================================

router.post(
    '/login',
    authRateLimiter,
    authController.login
);


// =====================================================
// REFRESH
// =====================================================

router.post(
    '/refresh',
    authRateLimiter,
    authController.refresh
);


// =====================================================
// GET CURRENT USER
// =====================================================

router.get(
    '/me',
    authMiddleware,
    authController.getMe
);


// =====================================================
// UPDATE PROFILE
// PATCH /api/auth/me
// =====================================================

router.patch(
    '/me',
    authMiddleware,
    authController.updateProfile
);


// =====================================================
// CHANGE PASSWORD
// POST /api/auth/change-password
// =====================================================

router.post(
    '/change-password',
    authMiddleware,
    authController.changePassword
);
// verify reset otp
router.post('/verify-reset-otp', authRateLimiter, authController.verifyResetOtp);

// =====================================================
// LOGOUT
// =====================================================

router.post(
    '/logout',
    authController.logout
);
router.post(
    '/test-email',
    authController.testEmail
);
router.post(
    '/forgot-password',
    authController.forgotPassword
);

router.post(
    '/reset-password',
    authRateLimiter,
    authController.resetPassword
);


module.exports = router;