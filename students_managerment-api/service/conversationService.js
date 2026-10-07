const conversationRepository = require('../repository/conversationRepository');
const userRepository = require('../repository/userRepository');

const getOrCreateDirectConversation = async (currentUserId, targetUserId) => {
    if (currentUserId === targetUserId) {
        throw new Error('Không thể tạo conversation với chính mình');
    }

    const targetUser = await userRepository.findActiveUserById(targetUserId);
    if (!targetUser) {
        throw new Error('Người dùng không tồn tại hoặc đã bị khóa');
    }

    const existingConversation = await conversationRepository.findDirectConversation(
        currentUserId,
        targetUserId
    );

    if (existingConversation) return existingConversation;

    const conversation = await conversationRepository.createConversation('direct');
    await conversationRepository.addMember(conversation.id, currentUserId, null);
    await conversationRepository.addMember(conversation.id, targetUserId, null);

    return conversation;
};

const getUserConversations = async (userId) =>
    conversationRepository.getUserConversations(userId);

const getConversationMembers = async (conversationId, userId) => {
    if (!await conversationRepository.isConversationMember(conversationId, userId)) {
        throw new Error('Bạn không thuộc conversation này');
    }
    return conversationRepository.getConversationMembers(conversationId);
};

const createGroupConversation = async (ownerId, memberIds, name, avatarUrl = null) => {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!normalizedName || normalizedName.length > 120) {
        throw new Error('Tên nhóm không hợp lệ');
    }

    const ids = [...new Set(
        (Array.isArray(memberIds) ? memberIds : [])
            .map(Number)
            .filter(id => Number.isInteger(id) && id > 0 && id !== Number(ownerId))
    )];

    if (ids.length < 1) {
        throw new Error('Nhóm phải có ít nhất 2 thành viên');
    }

    const users = [];
    for (const id of ids) {
        const user = await userRepository.findActiveUserById(id);
        if (!user) throw new Error('Một hoặc nhiều người dùng không tồn tại hoặc đã bị khóa');
        users.push(user);
    }

    return conversationRepository.createGroupConversation(
        ownerId,
        ids,
        normalizedName,
        avatarUrl
    );
};

const addGroupMember = async (conversationId, actorId, targetUserId) => {
    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation || conversation.type !== 'group') {
        throw new Error('Conversation không phải group');
    }

    const role = await conversationRepository.getMemberRole(conversationId, actorId);
    if (!['owner', 'admin'].includes(role)) {
        throw new Error('Bạn không có quyền thêm thành viên');
    }

    const target = await userRepository.findActiveUserById(targetUserId);
    if (!target) throw new Error('Người dùng không tồn tại hoặc đã bị khóa');

    return conversationRepository.addMember(conversationId, targetUserId, 'member');
};

const removeGroupMember = async (conversationId, actorId, targetUserId) => {
    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation || conversation.type !== 'group') throw new Error('Conversation không phải group');

    const actorRole = await conversationRepository.getMemberRole(conversationId, actorId);
    const targetRole = await conversationRepository.getMemberRole(conversationId, targetUserId);

    if (targetRole === null) throw new Error('Thành viên không tồn tại');
    if (targetRole === 'owner') throw new Error('Không thể xoá trưởng nhóm');

    if (actorRole === 'admin' && targetRole !== 'member') {
        throw new Error('Admin chỉ có thể xoá member');
    }
    if (!['owner', 'admin'].includes(actorRole)) {
        throw new Error('Bạn không có quyền xoá thành viên');
    }

    return conversationRepository.removeMember(conversationId, targetUserId);
};

const leaveGroup = async (conversationId, userId) => {
    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation || conversation.type !== 'group') throw new Error('Conversation không phải group');

    const role = await conversationRepository.getMemberRole(conversationId, userId);
    if (role === null) throw new Error('Bạn không thuộc group này');
    if (role === 'owner') throw new Error('Trưởng nhóm phải chuyển quyền trước khi rời nhóm');

    return conversationRepository.removeMember(conversationId, userId);
};

const updateGroupMemberRole = async (conversationId, actorId, targetUserId, nextRole) => {
    if (!['owner', 'admin', 'member'].includes(nextRole)) {
        throw new Error('Role không hợp lệ');
    }

    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (!conversation || conversation.type !== 'group') throw new Error('Conversation không phải group');

    const actorRole = await conversationRepository.getMemberRole(conversationId, actorId);
    const targetRole = await conversationRepository.getMemberRole(conversationId, targetUserId);

    if (actorRole !== 'owner') throw new Error('Chỉ trưởng nhóm mới có quyền thay đổi role');
    if (targetRole === null) throw new Error('Thành viên không tồn tại');
    if (targetUserId === actorId && nextRole !== 'owner') {
        throw new Error('Không thể tự hạ quyền trưởng nhóm');
    }

    if (nextRole === 'owner') {
        await conversationRepository.updateMemberRole(conversationId, actorId, 'admin');
    }

    return conversationRepository.updateMemberRole(conversationId, targetUserId, nextRole);
};

module.exports = {
    getOrCreateDirectConversation,
    getUserConversations,
    getConversationMembers,
    createGroupConversation,
    addGroupMember,
    removeGroupMember,
    leaveGroup,
    updateGroupMemberRole
};
