const userRepository = require('../repository/userRepository');
const accessTokenStore = require('./accessTokenStore');

const revokeRealtimeSessions = async (sessionIds) => {
    for (const sessionId of sessionIds || []) {
        try {
            await accessTokenStore.removeAccessTokensForSession(sessionId);
        } catch (error) {
            // PostgreSQL revocation is authoritative; Redis cleanup is best-effort.
            console.warn('[USER ACCESS] Could not clear revoked access tokens:', error.message);
        }
        try {
            const { emitSessionRevoked } = require('../src/socket/socket');
            emitSessionRevoked(sessionId, 'ACCOUNT_ACCESS_CHANGED');
        } catch (error) {
            // Socket.IO may not be initialized in tests or during shutdown.
            console.warn('[USER ACCESS] Could not disconnect revoked session sockets:', error.message);
        }
    }
};

const searchUsersForChat = async (currentUserId, search) => {
    return userRepository.searchUsersForChat(currentUserId, search);
};

const listUsersForAdmin = (search) => userRepository.listUsersForAdmin(search);

const updateUserAccess = async (userId, payload, actorId) => {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id <= 0) return { kind: 'invalid_id' };
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { kind: 'invalid_body' };
    const allowedFields = new Set(['role', 'is_active']);
    if (Object.keys(payload).some((key) => !allowedFields.has(key))) return { kind: 'invalid_fields' };
    if (!['admin', 'user'].includes(payload.role) || typeof payload.is_active !== 'boolean') return { kind: 'invalid_fields' };
    const result = await userRepository.updateUserAccess(id, payload.role, payload.is_active, Number(actorId));
    if (result.kind === 'ok' && result.revokedSessionIds?.length) {
        await revokeRealtimeSessions(result.revokedSessionIds);
    }
    return result;
};

module.exports = {
    listUsersForAdmin,
    updateUserAccess,
    searchUsersForChat
};
