const messageRepository = require('../repository/messageRepository');
const conversationRepository = require('../repository/conversationRepository');

/**
 * Tạo message mới trong conversation
 */
const createMessage = async (
    conversationId,
    senderId,
    content
) => {
    // Kiểm tra user có thuộc conversation không
    const isMember =
        await conversationRepository.isConversationMember(
            conversationId,
            senderId
        );

    if (!isMember) {
        throw new Error(
            'Bạn không thuộc conversation này'
        );
    }

    // Kiểm tra nội dung message
    if (!content || !content.trim()) {
        throw new Error(
            'Nội dung message không được để trống'
        );
    }

    // Tạo message
    return messageRepository.createMessage(
        conversationId,
        senderId,
        content.trim()
    );
};

/**
 * Lấy danh sách message của conversation
 */
const getMessagesByConversation = async (
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
        throw new Error(
            'Bạn không thuộc conversation này'
        );
    }

    return messageRepository.getMessagesByConversation(
        conversationId
    );
};

module.exports = {
    createMessage,
    getMessagesByConversation
};