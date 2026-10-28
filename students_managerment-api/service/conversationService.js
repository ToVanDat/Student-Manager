const conversationRepository = require('../repository/conversationRepository');
const { canRemoveMember, canChangeMemberRole } = require('./groupAuthorization');
const userRepository = require('../repository/userRepository');

const createConversationError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const getOrCreateDirectConversation = async (currentUserId, targetUserId) => {
    if (currentUserId === targetUserId) {
        throw new Error('Không thể tạo conversation với chính mình');
    }

    const targetUser = await userRepository.findActiveUserById(targetUserId);
    if (!targetUser) {
        throw new Error('Người dùng không tồn tại hoặc đã bị khóa');
    }

    if (await conversationRepository.isUserBlocked(currentUserId, targetUserId)) {
        const error = new Error('Không thể bắt đầu cuộc trò chuyện với người dùng đã bị chặn');
        error.statusCode = 403;
        throw error;
    }

    const existingConversation = await conversationRepository.findDirectConversation(
        currentUserId,
        targetUserId
    );

    if (existingConversation) {
        // Opening a hidden direct conversation from user search restores it
        // only for the current user; the other participant's setting is untouched.
        await conversationRepository.unhideConversationForUser(
            existingConversation.id,
            currentUserId
        );
        return existingConversation;
    }

    const conversation = await conversationRepository.createConversation('direct');
    await conversationRepository.addMember(conversation.id, currentUserId, 'member');
    await conversationRepository.addMember(conversation.id, targetUserId, 'member');

    return conversation;
};

const getUserConversations = async (userId) =>
    conversationRepository.getUserConversations(userId);

const clearConversationMessagesForUser = async (conversationId, userId) => {
    if (!await conversationRepository.isConversationMember(conversationId, userId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }
    return conversationRepository.clearConversationMessagesForUser(conversationId, userId);
};

const updateConversationSettings = async (conversationId, userId, action, value) => {
    if (!await conversationRepository.isConversationMember(conversationId, userId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }

    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation) {
        const error = new Error('Conversation không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    const current = await conversationRepository.getConversationSettings(conversationId, userId);

    switch (action) {
        case 'pin':
            return conversationRepository.updateConversationSettings(conversationId, userId, {
                pinned: Boolean(value),
                mutedUntil: current.muted_until,
                markedUnread: current.marked_unread,
                hidden: Boolean(current.hidden_at)
            });
        case 'mute':
            return conversationRepository.updateConversationSettings(conversationId, userId, {
                pinned: current.pinned,
                mutedUntil: value ? new Date(value) : null,
                markedUnread: current.marked_unread,
                hidden: Boolean(current.hidden_at)
            });
        case 'unread':
            return conversationRepository.updateConversationSettings(conversationId, userId, {
                pinned: current.pinned,
                mutedUntil: current.muted_until,
                markedUnread: Boolean(value),
                hidden: Boolean(current.hidden_at)
            });
        case 'hide':
            return conversationRepository.updateConversationSettings(conversationId, userId, {
                pinned: current.pinned,
                mutedUntil: current.muted_until,
                markedUnread: current.marked_unread,
                hidden: Boolean(value)
            });
        default: {
            const error = new Error('Action không hợp lệ');
            error.statusCode = 400;
            throw error;
        }
    }
};

const blockUser = async (conversationId, userId, targetUserId) => {
    if (!await conversationRepository.isConversationMember(conversationId, userId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }
    if (!Number.isInteger(Number(targetUserId)) || Number(targetUserId) <= 0) {
        const error = new Error('targetUserId không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    if (Number(userId) === Number(targetUserId)) {
        const error = new Error('Không thể chặn chính mình');
        error.statusCode = 400;
        throw error;
    }
    if (await conversationRepository.getMemberRole(conversationId, targetUserId) === null) {
        const error = new Error('Người dùng được chọn không thuộc conversation này');
        error.statusCode = 404;
        throw error;
    }
    return conversationRepository.setUserBlocked(userId, targetUserId);
};

const unblockUser = async (conversationId, userId, targetUserId) => {
    if (!await conversationRepository.isConversationMember(conversationId, userId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }
    if (!Number.isInteger(Number(targetUserId)) || Number(targetUserId) <= 0) {
        const error = new Error('targetUserId không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    if (await conversationRepository.getMemberRole(conversationId, targetUserId) === null) {
        const error = new Error('Người dùng được chọn không thuộc conversation này');
        error.statusCode = 404;
        throw error;
    }
    return conversationRepository.removeUserBlocked(userId, targetUserId);
};

const reportConversation = async (conversationId, userId, targetUserId, reason, details = null) => {
    if (!await conversationRepository.isConversationMember(conversationId, userId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }

    if (!Number.isInteger(Number(targetUserId)) || Number(targetUserId) <= 0) {
        const error = new Error('targetUserId không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    if (Number(userId) === Number(targetUserId)) {
        const error = new Error('Không thể tự báo cáo chính mình');
        error.statusCode = 400;
        throw error;
    }
    if (await conversationRepository.getMemberRole(conversationId, targetUserId) === null) {
        const error = new Error('Người dùng được báo cáo không thuộc conversation này');
        error.statusCode = 404;
        throw error;
    }

    const allowed = ['spam', 'harassment', 'scam', 'inappropriate', 'other'];
    if (!allowed.includes(reason)) {
        const error = new Error('Lý do báo cáo không hợp lệ');
        error.statusCode = 400;
        throw error;
    }

    return conversationRepository.createConversationReport(
        conversationId,
        userId,
        targetUserId,
        reason,
        typeof details === 'string' ? details.trim().slice(0, 1000) : null
    );
};

const getConversationMembers = async (conversationId, userId) => {
    if (!await conversationRepository.isConversationMember(conversationId, userId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }
    return conversationRepository.getConversationMembers(conversationId);
};

const createGroupConversation = async (ownerId, memberIds, name, avatarUrl = null) => {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!normalizedName || normalizedName.length > 120) {
        throw createConversationError('Tên nhóm không hợp lệ', 400);
    }

    const ids = [...new Set(
        (Array.isArray(memberIds) ? memberIds : [])
            .map(Number)
            .filter(id => Number.isInteger(id) && id > 0 && id !== Number(ownerId))
    )];

    if (ids.length < 1) {
        throw createConversationError('Nhóm phải có ít nhất 2 thành viên', 400);
    }

    const users = [];
    for (const id of ids) {
        const user = await userRepository.findActiveUserById(id);
        if (!user) throw createConversationError('Một hoặc nhiều người dùng không tồn tại hoặc đã bị khóa', 404);
        users.push(user);
    }

    return conversationRepository.createGroupConversation(
        ownerId,
        ids,
        normalizedName,
        avatarUrl
    );
};

const updateGroupConversation = async (conversationId, actorId, name, avatarUrl = null) => {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!normalizedName || normalizedName.length > 120) {
        throw createConversationError('Tên nhóm không hợp lệ', 400);
    }

    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation || conversation.type !== 'group') {
        throw createConversationError('Conversation không phải group', 404);
    }

    const actorRole = await conversationRepository.getMemberRole(conversationId, actorId);
    if (actorRole !== 'owner') {
        throw createConversationError('Chỉ trưởng nhóm mới có quyền cập nhật thông tin nhóm', 403);
    }

    const updated = await conversationRepository.updateGroupConversation(
        conversationId,
        normalizedName,
        avatarUrl
    );

    if (!updated) throw createConversationError('Không thể cập nhật thông tin nhóm', 409);
    return updated;
};

const addGroupMember = async (conversationId, actorId, targetUserId) => {
    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation || conversation.type !== 'group') {
        throw createConversationError('Conversation không phải group', 404);
    }

    const role = await conversationRepository.getMemberRole(conversationId, actorId);
    if (!['owner', 'admin'].includes(role)) {
        throw createConversationError('Bạn không có quyền thêm thành viên', 403);
    }

    const target = await userRepository.findActiveUserById(targetUserId);
    if (!target) throw createConversationError('Người dùng không tồn tại hoặc đã bị khóa', 404);

    const existingRole = await conversationRepository.getMemberRole(conversationId, targetUserId);
    if (existingRole !== null) {
        throw createConversationError('Người dùng đã là thành viên của group', 409);
    }

    return conversationRepository.addMember(conversationId, targetUserId, 'member');
};

const removeGroupMember = async (conversationId, actorId, targetUserId) => {
    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation || conversation.type !== 'group') throw createConversationError('Conversation không phải group', 404);

    const actorRole = await conversationRepository.getMemberRole(conversationId, actorId);
    const targetRole = await conversationRepository.getMemberRole(conversationId, targetUserId);

    if (targetRole === null) throw createConversationError('Thành viên không tồn tại', 404);
    if (targetRole === 'owner') throw createConversationError('Không thể xoá trưởng nhóm', 409);

    if (!canRemoveMember(actorRole, targetRole)) {
        if (actorRole === 'admin' && targetRole !== 'member') {
            throw createConversationError('Admin chỉ có thể xoá member', 403);
        }
        throw createConversationError('Bạn không có quyền xoá thành viên', 403);
    }

    return conversationRepository.removeMember(conversationId, targetUserId);
};

const leaveGroup = async (conversationId, userId) => {
    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation || conversation.type !== 'group') throw createConversationError('Conversation không phải group', 404);

    const role = await conversationRepository.getMemberRole(conversationId, userId);
    if (role === null) throw createConversationError('Bạn không thuộc group này', 403);
    if (role === 'owner') throw createConversationError('Trưởng nhóm phải chuyển quyền trước khi rời nhóm', 409);

    return conversationRepository.removeMember(conversationId, userId);
};

const updateGroupMemberRole = async (conversationId, actorId, targetUserId, nextRole) => {
    if (!['owner', 'admin', 'member'].includes(nextRole)) {
        throw createConversationError('Role không hợp lệ', 400);
    }

    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation || conversation.type !== 'group') throw createConversationError('Conversation không phải group', 404);

    const actorRole = await conversationRepository.getMemberRole(conversationId, actorId);
    const targetRole = await conversationRepository.getMemberRole(conversationId, targetUserId);

    if (targetRole === null) throw createConversationError('Thành viên không tồn tại', 404);
    if (!canChangeMemberRole(actorRole, targetRole, actorId, targetUserId, nextRole)) {
        if (actorRole !== 'owner') throw createConversationError('Chỉ trưởng nhóm mới có quyền thay đổi role', 403);
        if (Number(targetUserId) === Number(actorId) && nextRole !== 'owner') {
            throw createConversationError('Không thể tự hạ quyền trưởng nhóm', 409);
        }
        throw createConversationError('Không thể thay đổi role thành viên này', 409);
    }

    if (nextRole === 'owner') {
        return conversationRepository.transferGroupOwnership(
            conversationId,
            actorId,
            targetUserId
        );
    }

    return conversationRepository.updateMemberRole(conversationId, targetUserId, nextRole);
};

module.exports = {
    getOrCreateDirectConversation,
    getUserConversations,
    getConversationMembers,
    createGroupConversation,
    updateGroupConversation,
    addGroupMember,
    removeGroupMember,
    leaveGroup,
    updateGroupMemberRole,
    updateConversationSettings,
    clearConversationMessagesForUser,
    blockUser,
    unblockUser,
    reportConversation
};
