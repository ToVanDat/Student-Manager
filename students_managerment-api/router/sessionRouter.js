const express = require('express');

const sessionRouter = express.Router();

const sessionController =
    require('../controller/sessionController.js');

const authMiddleware =
    require('../middleware/authMiddleware.js');


// ======================================================
// GET ALL SESSIONS
// ======================================================

sessionRouter.get(
    '/',
    authMiddleware,
    sessionController.getSessions
);


// ======================================================
// REVOKE OTHER SESSIONS
// PHẢI ĐẶT TRƯỚC /:sessionId
// ======================================================

sessionRouter.post(
    '/revoke-others',
    authMiddleware,
    sessionController.revokeOtherSessions
);


// ======================================================
// REVOKE 1 SESSION
// ======================================================

sessionRouter.delete(
    '/:sessionId',
    authMiddleware,
    sessionController.revokeSession
);


module.exports = sessionRouter;