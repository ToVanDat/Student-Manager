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

    if (!content || !content.trim()) {
        throw new Error(
            'Nội dung message không được để trống'
        );
    }

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
        conversationId,
        userId
    );
};

/**
 * Chỉnh sửa message.
 *
 * Quy tắc:
 * - User phải thuộc conversation.
 * - Chỉ sender mới được sửa message.
 * - Message đã recall không được sửa.
 * - Message đã delete for everyone không được sửa.
 * - Content mới không được rỗng.
 */
const updateMessage = async (
    messageId,
    userId,
    content
) => {
    if (!content || !content.trim()) {
        const error = new Error(
            'Nội dung message không được để trống'
        );
        error.statusCode = 400;
        throw error;
    }

    const message =
        await messageRepository.getMessageById(messageId);

    if (!message) {
        const error = new Error('Message không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    const isMember =
        await conversationRepository.isConversationMember(
            message.conversation_id,
            userId
        );

    if (!isMember) {
        const error = new Error(
            'Bạn không thuộc conversation này'
        );
        error.statusCode = 403;
        throw error;
    }

    if (String(message.sender_id) !== String(userId)) {
        const error = new Error(
            'Bạn chỉ có thể sửa message do chính mình gửi'
        );
        error.statusCode = 403;
        throw error;
    }

    if (message.is_recalled) {
        const error = new Error(
            'Message đã được thu hồi và không thể chỉnh sửa'
        );
        error.statusCode = 400;
        throw error;
    }

    if (message.deleted_at) {
        const error = new Error(
            'Message đã bị xoá và không thể chỉnh sửa'
        );
        error.statusCode = 400;
        throw error;
    }

    const updatedMessage =
        await messageRepository.updateMessageContent(
            messageId,
            content.trim()
        );

    if (!updatedMessage) {
        const error = new Error(
            'Không thể cập nhật message'
        );
        error.statusCode = 500;
        throw error;
    }

    return updatedMessage;
};

/**
 * Thu hồi message.
 *
 * Quy tắc:
 * - User phải thuộc conversation.
 * - Chỉ sender mới được thu hồi message.
 * - Message đã recall không được recall lại.
 * - Message đã delete for everyone không được recall.
 */
const recallMessage = async (
    messageId,
    userId
) => {
    const message =
        await messageRepository.getMessageById(messageId);

    if (!message) {
        const error = new Error('Message không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    const isMember =
        await conversationRepository.isConversationMember(
            message.conversation_id,
            userId
        );

    if (!isMember) {
        const error = new Error(
            'Bạn không thuộc conversation này'
        );
        error.statusCode = 403;
        throw error;
    }

    if (String(message.sender_id) !== String(userId)) {
        const error = new Error(
            'Bạn chỉ có thể thu hồi message do chính mình gửi'
        );
        error.statusCode = 403;
        throw error;
    }

    if (message.is_recalled) {
        const error = new Error(
            'Message đã được thu hồi'
        );
        error.statusCode = 400;
        throw error;
    }

    if (message.deleted_at) {
        const error = new Error(
            'Message đã bị xoá và không thể thu hồi'
        );
        error.statusCode = 400;
        throw error;
    }

    const recalledMessage =
        await messageRepository.recallMessage(messageId);

    if (!recalledMessage) {
        const error = new Error(
            'Không thể thu hồi message'
        );
        error.statusCode = 500;
        throw error;
    }

    return recalledMessage;
};

/**
 * Xoá message cho riêng user hiện tại.
 *
 * Message vẫn tồn tại trong bảng messages và user khác vẫn thấy.
 */
const deleteMessageForMe = async (
    messageId,
    userId
) => {
    const message =
        await messageRepository.getMessageById(messageId);

    if (!message) {
        const error = new Error('Message không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    const isMember =
        await conversationRepository.isConversationMember(
            message.conversation_id,
            userId
        );

    if (!isMember) {
        const error = new Error(
            'Bạn không thuộc conversation này'
        );
        error.statusCode = 403;
        throw error;
    }

    return messageRepository.deleteMessageForMe(
        messageId,
        userId
    );
};

/**
 * Xoá message cho tất cả thành viên.
 * Chỉ sender được xoá và message được soft-delete.
 */
const deleteMessageForEveryone = async (
    messageId,
    userId
) => {
    const message =
        await messageRepository.getMessageById(messageId);

    if (!message) {
        const error = new Error('Message không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    const isMember =
        await conversationRepository.isConversationMember(
            message.conversation_id,
            userId
        );

    if (!isMember) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }

    if (String(message.sender_id) !== String(userId)) {
        const error = new Error(
            'Bạn chỉ có thể xoá message do chính mình gửi cho tất cả'
        );
        error.statusCode = 403;
        throw error;
    }

    if (message.is_recalled) {
        const error = new Error(
            'Message đã được thu hồi và không thể xoá cho tất cả'
        );
        error.statusCode = 400;
        throw error;
    }

    if (message.deleted_at) {
        const error = new Error('Message đã được xoá cho tất cả');
        error.statusCode = 400;
        throw error;
    }

    const deletedMessage =
        await messageRepository.deleteMessageForEveryone(messageId);

    if (!deletedMessage) {
        const error = new Error('Không thể xoá message cho tất cả');
        error.statusCode = 500;
        throw error;
    }

    return deletedMessage;
};

module.exports = {
    createMessage,
    getMessagesByConversation,
    updateMessage,
    recallMessage,
    deleteMessageForMe,
    deleteMessageForEveryone
};
