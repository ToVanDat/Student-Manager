'use strict';

async function isSocketSessionActive(authRepository, sessionId, userId) {
    if (typeof authRepository.isSessionActiveForSocket === 'function') {
        return authRepository.isSessionActiveForSocket(sessionId, userId);
    }

    // Compatibility fallback for lightweight repository doubles in unit tests.
    const session = await authRepository.findSessionByIdAndUserId(sessionId, userId);
    if (!session || session.revoked_at !== null) return false;

    const user = await authRepository.findUserById(userId);
    return Boolean(user && user.is_active);
}

module.exports = { isSocketSessionActive };
