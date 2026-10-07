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

    try {
        await conversationRepository.addMember(conversation.id, currentUserId);
        await conversationRepository.addMember(conversation.id, targetUserId);
    } catch (error) {
        throw error;
    }

    return conversation;
};

const getUserConversations = async (userId) => {
    return conversationRepository.getUserConversations(userId);
};

const getConversationMembers = async (conversationId, userId) => {
    const isMember = await conversationRepository.isConversationMember(conversationId, userId);
    if (!isMember) throw new Error('Bạn không thuộc conversation này');

    return conversationRepository.getConversationMembers(conversationId);
};

module.exports = {
    getOrCreateDirectConversation,
    getUserConversations,
    getConversationMembers
};