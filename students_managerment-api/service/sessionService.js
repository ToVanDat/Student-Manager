const authRepository =
    require('../repository/authRepository.js');
const accessTokenStore = require('./accessTokenStore.js');


// ======================================================
// LẤY DANH SÁCH SESSION CỦA USER
// ======================================================

const getUserSessions = async (userId) => {

    const sessions =
        await authRepository.findSessionsByUserId(
            userId
        );

    return sessions;
};


// ======================================================
// REVOKE 1 SESSION
// ======================================================

const revokeSession = async (sessionId, userId) => {
    const existing = await authRepository.findSessionByIdAndUserId(sessionId, userId);
    if (!existing) throw new Error('Session không tồn tại');
    if (existing.revoked_at !== null) {
        return { alreadyRevoked: true, session: existing };
    }

    const revokedSession = await authRepository.revokeSessionForUserAndRefreshTokens(sessionId, userId);
    if (!revokedSession) {
        const latest = await authRepository.findSessionByIdAndUserId(sessionId, userId);
        if (!latest) throw new Error('Session không tồn tại');
        return { alreadyRevoked: true, session: latest };
    }

    try {
        await accessTokenStore.removeAccessTokensForSession(sessionId);
    } catch (error) {
        console.warn('[SESSION] Could not clear revoked access tokens:', error.message);
    }
    try {
        const { emitSessionRevoked } = require('../src/socket/socket.js');
        emitSessionRevoked(sessionId, 'SESSION_REVOKED');
    } catch (error) {
        console.error('Socket notification error:', error.message);
    }
    return { alreadyRevoked: false, session: revokedSession };
};


// ======================================================
// REVOKE CÁC SESSION KHÁC
// GIỮ LẠI SESSION HIỆN TẠI
// ======================================================

const revokeOtherSessions = async (userId, currentSessionId) => {
    const revokedSessions = await authRepository.revokeOtherSessionsAndRefreshTokens(
        userId,
        currentSessionId
    );

    // Database revocation is atomic; Redis and Socket.IO are follow-up operations.
    for (const session of revokedSessions) {
        try {
            await accessTokenStore.removeAccessTokensForSession(session.id);
        } catch (error) {
            console.warn('[SESSION] Could not clear revoked access tokens:', error.message);
        }
        try {
            const { emitSessionRevoked } = require('../src/socket/socket.js');
            emitSessionRevoked(session.id, 'OTHER_SESSIONS_REVOKED');
        } catch (error) {
            console.error('Socket notification error:', error.message);
        }
    }
    return { revokedCount: revokedSessions.length };
};


module.exports = {

    getUserSessions,

    revokeSession,

    revokeOtherSessions

};