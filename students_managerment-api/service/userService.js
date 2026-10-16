const userRepository = require('../repository/userRepository');

const searchUsersForChat = async (currentUserId, search) => {
    return userRepository.searchUsersForChat(currentUserId, search);
};

const listUsersForAdmin = (search) => userRepository.listUsersForAdmin(search);

const updateUserAccess = async (userId, payload, actorId) => {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id <= 0) return { kind: 'invalid_id' };
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { kind: 'invalid_body' };
    if (!['admin', 'user'].includes(payload.role) || typeof payload.is_active !== 'boolean') return { kind: 'invalid_fields' };
    return userRepository.updateUserAccess(id, payload.role, payload.is_active, Number(actorId));
};

module.exports = {
    listUsersForAdmin,
    updateUserAccess,
    searchUsersForChat
};
