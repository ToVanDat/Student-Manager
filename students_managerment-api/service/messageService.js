const messageRepository = require('../repository/messageRepository');
const conversationRepository = require('../repository/conversationRepository');

/**
 * Tạo message mới trong conversation
 */
const createMessage = async (
    conversationId,
    senderId,
    content,
    replyToMessageId = null
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

    const conversation = await conversationRepository.getConversationInfo(conversationId);
    if (conversation?.type === 'direct') {
        const contactIds = await conversationRepository.getConversationContactIds(senderId);
        const blocked = contactIds.some(id => Number(id) !== Number(senderId));
        if (blocked) {
            const members = await conversationRepository.getConversationMembers(conversationId);
            const target = members.find(member => Number(member.user_id) !== Number(senderId));
            if (target && await conversationRepository.isUserBlocked(senderId, target.user_id)) {
                const error = new Error('Bạn đã chặn người dùng này hoặc người dùng này đã bị chặn');
                error.statusCode = 403;
                throw error;
            }
        }
    }

    if (!content || !content.trim()) {
        throw new Error(
            'Nội dung message không được để trống'
        );
    }

    let replyTo = null;
    if (replyToMessageId !== null && replyToMessageId !== undefined) {
        replyTo = Number(replyToMessageId);
        if (!Number.isInteger(replyTo) || replyTo <= 0) {
            const error = new Error('replyToMessageId không hợp lệ');
            error.statusCode = 400;
            throw error;
        }

        const repliedMessage = await messageRepository.getMessageById(replyTo);
        if (!repliedMessage) {
            const error = new Error('Message được reply không tồn tại');
            error.statusCode = 404;
            throw error;
        }

        if (Number(repliedMessage.conversation_id) !== Number(conversationId)) {
            const error = new Error('Message reply không thuộc conversation này');
            error.statusCode = 400;
            throw error;
        }
    }

    return messageRepository.createMessage(
        conversationId,
        senderId,
        content.trim(),
        replyTo
    );
};

/**
 * Lấy danh sách message của conversation
 */
const getMessagesByConversation = async (
    conversationId,
    userId,
    page = 1,
    limit = 50
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
        userId,
        page,
        limit
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
const searchMessages = async (conversationId, userId, query, limit = 30) => {
    if (!await conversationRepository.isConversationMember(conversationId, userId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }

    const normalized = typeof query === 'string' ? query.trim() : '';
    if (!normalized) {
        const error = new Error('Từ khóa tìm kiếm không được để trống');
        error.statusCode = 400;
        throw error;
    }

    return messageRepository.searchMessages(conversationId, userId, normalized.slice(0, 100), limit);
};

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
            userId,
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
        await messageRepository.recallMessage(messageId, userId);

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
        await messageRepository.deleteMessageForEveryone(messageId, userId);

    if (!deletedMessage) {
        const error = new Error('Không thể xoá message cho tất cả');
        error.statusCode = 500;
        throw error;
    }

    return deletedMessage;
};


const addReaction = async (messageId, userId, emoji) => {
    const message = await messageRepository.getMessageById(messageId);
    if (!message) {
        const error = new Error('Message không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    if (!await conversationRepository.isConversationMember(message.conversation_id, userId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }

    if (message.is_recalled || message.deleted_at) {
        const error = new Error('Không thể reaction vào message đã thu hồi hoặc xoá');
        error.statusCode = 400;
        throw error;
    }

    if (Number(message.sender_id) === Number(userId)) {
        const error = new Error('Không thể thả reaction vào message của chính bạn');
        error.statusCode = 400;
        throw error;
    }

    if (typeof emoji !== 'string' || !emoji.trim() || emoji.trim().length > 32) {
        const error = new Error('Emoji không hợp lệ');
        error.statusCode = 400;
        throw error;
    }

    return messageRepository.addReaction(messageId, userId, emoji.trim());
};

const removeReaction = async (messageId, userId, emoji) => {
    const message = await messageRepository.getMessageById(messageId);
    if (!message) {
        const error = new Error('Message không tồn tại');
        error.statusCode = 404;
        throw error;
    }

    if (!await conversationRepository.isConversationMember(message.conversation_id, userId)) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }

    if (typeof emoji !== 'string' || !emoji.trim() || emoji.trim().length > 32) {
        const error = new Error('Emoji không hợp lệ');
        error.statusCode = 400;
        throw error;
    }

    return messageRepository.removeReaction(messageId, userId, emoji.trim());
};

module.exports = {
    createMessage,
    getMessagesByConversation,
    searchMessages,
    updateMessage,
    recallMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    addReaction,
    removeReaction
};
