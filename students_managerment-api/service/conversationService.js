const conversationRepository = require('../repository/conversationRepository');

/**
 * Tạo hoặc lấy conversation 1-1 giữa 2 user
 */
const getOrCreateDirectConversation = async (
    currentUserId,
    targetUserId
) => {
    // Không cho user tự chat với chính mình
    if (currentUserId === targetUserId) {
        throw new Error('Không thể tạo conversation với chính mình');
    }

    // Kiểm tra conversation đã tồn tại chưa
    const existingConversation =
        await conversationRepository.findDirectConversation(
            currentUserId,
            targetUserId
        );

    if (existingConversation) {
        return existingConversation;
    }

    // Chưa có → tạo conversation
    const conversation =
        await conversationRepository.createConversation('direct');

    // Thêm 2 user vào conversation
    await conversationRepository.addMember(
        conversation.id,
        currentUserId
    );

    await conversationRepository.addMember(
        conversation.id,
        targetUserId
    );

    // Trả về conversation vừa tạo
    return conversation;
};

/**
 * Lấy danh sách conversation của user
 */
const getUserConversations = async (userId) => {
    return conversationRepository.getUserConversations(userId);
};

/**
 * Lấy members của conversation
 */
const getConversationMembers = async (
    conversationId,
    userId
) => {
    // Kiểm tra user có thuộc conversation không
    const isMember =
        await conversationRepository.isConversationMember(
            conversationId,
            userId
        );

    if (!isMember) {
        throw new Error('Bạn không thuộc conversation này');
    }

    return conversationRepository.getConversationMembers(
        conversationId
    );
};

module.exports = {
    getOrCreateDirectConversation,
    getUserConversations,
    getConversationMembers
};