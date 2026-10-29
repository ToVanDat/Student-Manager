const messageService = require('../service/messageService');
const { getIO } = require('../src/socket/socket');
const messageRepository = require('../repository/messageRepository');
const conversationRepository = require('../repository/conversationRepository');
const webPushService = require('../service/webPushService');
const notificationDeliveryService = require('../service/notificationDeliveryService');
const userRepository = require('../repository/userRepository');
const e2eeRepository = require('../repository/e2eeRepository');
const { toSafeHttpError } = require('../service/toSafeHttpError');

const emitMessageRealtimeBestEffort = (room, event, payload) => {
    try {
        getIO().to(room).emit(event, payload);
    } catch (error) {
        console.warn('[MESSAGE] Realtime delivery failed:', {
            event,
            code: error?.code || 'REALTIME_DELIVERY_FAILED'
        });
    }
};

const publishReactionUpdateBestEffort = async (messageId, action, reaction, userId, emoji) => {
    try {
        const target = await messageRepository.getMessageById(messageId);
        if (!target?.conversation_id) return;
        emitMessageRealtimeBestEffort('conversation:' + target.conversation_id, 'message:reaction:updated', {
            messageId,
            conversationId: target.conversation_id,
            action,
            reaction: reaction || { message_id: messageId, user_id: userId, emoji }
        });
    } catch (error) {
        console.warn('[MESSAGE] Reaction realtime lookup failed:', {
            messageId,
            code: error?.code || 'REACTION_REALTIME_FAILED'
        });
    }
};

/**
 * Gửi message
 */
const createMessage = async (req, res) => {
    try {
        const senderId = Number(req.user.id);
        const conversationId = Number(
            req.body.conversationId
        );
        const content = req.body.content;
        const replyToMessageId = req.body.replyToMessageId ?? null;

        if (!Number.isInteger(senderId) || senderId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        if (
            !Number.isInteger(conversationId) ||
            conversationId <= 0
        ) {
            return res.status(400).json({
                message: 'conversationId không hợp lệ'
            });
        }

        if (
            typeof content !== 'string' ||
            !content.trim()
        ) {
            return res.status(400).json({
                message: 'Nội dung message không được để trống'
            });
        }

        // Never let the legacy plaintext endpoint bypass E2EE once a conversation
        // has been activated. A dedicated encrypted-envelope sender must be used.
        if (!await conversationRepository.isConversationMember(conversationId, senderId)) {
            return res.status(403).json({ message: 'Bạn không thuộc conversation này' });
        }
        if (await e2eeRepository.isConversationE2EEEnabled(conversationId)) {
            return res.status(409).json({
                code: 'E2EE_REQUIRED',
                message: 'Cuộc trò chuyện đã bật E2EE; cần gửi ciphertext qua luồng mã hóa.'
            });
        }

        const message =
            await messageService.createMessage(
                conversationId,
                senderId,
                content,
                replyToMessageId
            );

        try {
            await conversationRepository.unhideConversationForMembers(
                conversationId,
                senderId
            );
        } catch (sideEffectError) {
            // Message persistence is already committed. A visibility-refresh
            // failure must not tell the sender that the message itself failed.
            console.error('[MESSAGE] Conversation visibility refresh failed:', {
                conversationId,
                code: sideEffectError?.code || 'CONVERSATION_VISIBILITY_REFRESH_FAILED'
            });
        }

        // Persistence has completed. Realtime fan-out and push delivery are
        // best-effort and must not turn a committed message into an HTTP failure.
        try {
            const io = getIO();
            io.to(`conversation:${conversationId}`).emit('message:new', message);

            const memberIds = await conversationRepository.getConversationMemberIds(conversationId);
            for (const memberId of memberIds) {
                io.to(`user:${memberId}`).emit('conversation:updated', {
                    conversationId,
                    lastMessage: message,
                    senderId,
                    updatedAt: message.created_at
                });
            }

            const sender = await userRepository.findActiveUserById(senderId);
            await notificationDeliveryService.notifyMessageRecipients({
                io, conversationId, senderId,
                senderName: sender?.username || 'Tin nhắn mới', message
            });
        } catch (notificationError) {
            console.error('[MESSAGE] Post-commit delivery failed:', {
                conversationId,
                message: notificationError?.message
            });
        }

        return res.status(201).json({
            message: 'Gửi message thành công',
            data: message
        });

    } catch (error) {
        console.error(
            'CREATE MESSAGE ERROR:',
            error
        );

        if ([400, 403, 404, 409].includes(error.statusCode)) {
            return res.status(error.statusCode).json({
                message: error.message,
                ...(error.statusCode === 409 ? { code: 'E2EE_REQUIRED' } : {})
            });
        }

        if (
            error.message ===
            'Bạn không thuộc conversation này'
        ) {
            return res.status(403).json({
                message: error.message
            });
        }

        if (
            error.message ===
            'Nội dung message không được để trống'
        ) {
            return res.status(400).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message: 'Không thể gửi message'
        });
    }
};

/**
 * Lấy lịch sử message của conversation
 */
const getMessagesByConversation = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const conversationId = Number(
            req.params.conversationId
        );
        const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        if (
            !Number.isInteger(conversationId) ||
            conversationId <= 0
        ) {
            return res.status(400).json({
                message: 'conversationId không hợp lệ'
            });
        }

        const messages =
            await messageService.getMessagesByConversation(
                conversationId,
                userId,
                page,
                limit
            );

        return res.status(200).json({
            data: messages,
            pagination: {
                page,
                limit,
                hasMore: messages.length === limit
            }
        });

    } catch (error) {
        console.error(
            'GET CONVERSATION MESSAGES ERROR:',
            error
        );

        const failure = toSafeHttpError(error, 'Không thể lấy messages');
        return res.status(failure.statusCode).json({ message: failure.message });
    }
};

/**
 * Chỉnh sửa message
 */
const searchMessages = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const conversationId = Number(req.params.conversationId);
        const query = req.query.q;
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 50);

        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }

        const data = await messageService.searchMessages(
            conversationId,
            userId,
            query,
            limit
        );

        return res.status(200).json({ data });
    } catch (error) {
        const failure = toSafeHttpError(error, 'Không thể tìm kiếm message');
        return res.status(failure.statusCode).json({ message: failure.message });
    }
};

const updateMessage = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const messageId = Number(req.params.messageId);
        const content = req.body.content;

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({
                message: 'messageId không hợp lệ'
            });
        }

        if (
            typeof content !== 'string' ||
            !content.trim()
        ) {
            return res.status(400).json({
                message: 'Nội dung message không được để trống'
            });
        }

        const message =
            await messageService.updateMessage(
                messageId,
                userId,
                content
            );

        emitMessageRealtimeBestEffort('conversation:' + message.conversation_id, 'message:updated', message);

        return res.status(200).json({
            message: 'Chỉnh sửa message thành công',
            data: message
        });

    } catch (error) {
        console.error(
            'UPDATE MESSAGE ERROR:',
            error
        );

        const failure = toSafeHttpError(error, 'Không thể chỉnh sửa message');
        return res.status(failure.statusCode).json({ message: failure.message });
    }
};

/**
 * Thu hồi message
 */
const recallMessage = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const messageId = Number(req.params.messageId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({
                message: 'messageId không hợp lệ'
            });
        }

        const message =
            await messageService.recallMessage(
                messageId,
                userId
            );

        emitMessageRealtimeBestEffort('conversation:' + message.conversation_id, 'message:recalled', message);

        return res.status(200).json({
            message: 'Thu hồi message thành công',
            data: message
        });
    } catch (error) {
        console.error(
            'RECALL MESSAGE ERROR:',
            error
        );

        const failure = toSafeHttpError(error, 'Không thể thu hồi message');
        return res.status(failure.statusCode).json({ message: failure.message });
    }
};

/**
 * Xoá message cho riêng user hiện tại
 */
const deleteMessageForMe = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const messageId = Number(req.params.messageId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({
                message: 'messageId không hợp lệ'
            });
        }

        const deletion =
            await messageService.deleteMessageForMe(
                messageId,
                userId
            );

        emitMessageRealtimeBestEffort('user:' + userId, 'message:deleted:me', {
            messageId,
            conversationId: deletion.conversation_id,
            deletion
        });

        return res.status(200).json({
            message: 'Xoá message cho tôi thành công',
            data: deletion
        });
    } catch (error) {
        console.error(
            'DELETE MESSAGE FOR ME ERROR:',
            error
        );

        const failure = toSafeHttpError(error, 'Không thể xoá message');
        return res.status(failure.statusCode).json({ message: failure.message });
    }
};

/**
 * Xoá message cho tất cả
 */
const deleteMessageForEveryone = async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const messageId = Number(req.params.messageId);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({
                message: 'User hiện tại không hợp lệ'
            });
        }

        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({
                message: 'messageId không hợp lệ'
            });
        }

        const message =
            await messageService.deleteMessageForEveryone(
                messageId,
                userId
            );

        emitMessageRealtimeBestEffort('conversation:' + message.conversation_id, 'message:deleted:everyone', message);

        return res.status(200).json({
            message: 'Xoá message cho tất cả thành công',
            data: message
        });
    } catch (error) {
        console.error(
            'DELETE MESSAGE FOR EVERYONE ERROR:',
            error
        );

        const failure = toSafeHttpError(error, 'Không thể xoá message cho tất cả');
        return res.status(failure.statusCode).json({ message: failure.message });
    }
};


const addReaction = async (req, res) => {
    try {
        const messageId = Number(req.params.messageId);
        const userId = Number(req.user.id);
        const { emoji } = req.body;

        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({ message: 'messageId không hợp lệ' });
        }

        const reaction = await messageService.addReaction(messageId, userId, emoji);
        await publishReactionUpdateBestEffort(messageId, 'add', reaction, userId, emoji);
        return res.status(201).json({ data: reaction });
    } catch (error) {
        const failure = toSafeHttpError(error, 'Không thể thêm reaction');
        return res.status(failure.statusCode).json({ message: failure.message });
    }
};

const removeReaction = async (req, res) => {
    try {
        const messageId = Number(req.params.messageId);
        const userId = Number(req.user.id);
        const emoji = req.params.emoji;

        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({ message: 'messageId không hợp lệ' });
        }

        let normalizedEmoji;
        try {
            normalizedEmoji = decodeURIComponent(emoji);
        } catch {
            return res.status(400).json({ message: 'Emoji không hợp lệ' });
        }
        const reaction = await messageService.removeReaction(messageId, userId, normalizedEmoji);
        await publishReactionUpdateBestEffort(messageId, 'remove', reaction, userId, normalizedEmoji);
        return res.json({ data: reaction });
    } catch (error) {
        const failure = toSafeHttpError(error, 'Không thể xoá reaction');
        return res.status(failure.statusCode).json({ message: failure.message });
    }
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
