const messageService = require('../service/messageService');
const { getIO } = require('../src/socket/socket');
const messageRepository = require('../repository/messageRepository');
const conversationRepository = require('../repository/conversationRepository');

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

        const message =
            await messageService.createMessage(
                conversationId,
                senderId,
                content,
                replyToMessageId
            );

        await conversationRepository.unhideConversationForMembers(
            conversationId,
            senderId
        );

        // REST fallback cũng đồng bộ realtime cho các client đang trong conversation.
        getIO().to(`conversation:${conversationId}`).emit('message:new', message);

        const memberIds = await conversationRepository.getConversationMemberIds(conversationId);
        for (const memberId of memberIds) {
            getIO().to(`user:${memberId}`).emit('conversation:updated', {
                conversationId,
                lastMessage: message,
                senderId,
                updatedAt: message.created_at
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
            message:
                error.message ||
                'Không thể gửi message'
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

        if (
            error.message ===
            'Bạn không thuộc conversation này'
        ) {
            return res.status(403).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message:
                error.message ||
                'Không thể lấy messages'
        });
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
        return res.status(error.statusCode || 500).json({
            message: error.message || 'Không thể tìm kiếm message'
        });
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

        getIO().to(`conversation:${message.conversation_id}`).emit(
            'message:updated',
            message
        );

        return res.status(200).json({
            message: 'Chỉnh sửa message thành công',
            data: message
        });

    } catch (error) {
        console.error(
            'UPDATE MESSAGE ERROR:',
            error
        );

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message:
                error.message ||
                'Không thể chỉnh sửa message'
        });
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

        getIO().to(`conversation:${message.conversation_id}`).emit(
            'message:recalled',
            message
        );

        return res.status(200).json({
            message: 'Thu hồi message thành công',
            data: message
        });
    } catch (error) {
        console.error(
            'RECALL MESSAGE ERROR:',
            error
        );

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message:
                error.message ||
                'Không thể thu hồi message'
        });
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

        getIO().to(`user:${userId}`).emit(
            'message:deleted:me',
            {
                messageId,
                conversationId: deletion.conversation_id,
                deletion
            }
        );

        return res.status(200).json({
            message: 'Xoá message cho tôi thành công',
            data: deletion
        });
    } catch (error) {
        console.error(
            'DELETE MESSAGE FOR ME ERROR:',
            error
        );

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message:
                error.message ||
                'Không thể xoá message'
        });
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

        getIO().to(`conversation:${message.conversation_id}`).emit(
            'message:deleted:everyone',
            message
        );

        return res.status(200).json({
            message: 'Xoá message cho tất cả thành công',
            data: message
        });
    } catch (error) {
        console.error(
            'DELETE MESSAGE FOR EVERYONE ERROR:',
            error
        );

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }

        return res.status(500).json({
            message:
                error.message ||
                'Không thể xoá message cho tất cả'
        });
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
        const io = getIO();
        const target = await messageRepository.getMessageById(messageId);
        io.to(`conversation:${target.conversation_id}`).emit('message:reaction:updated', {
            messageId,
            conversationId: target.conversation_id,
            action: 'add',
            reaction
        });

        return res.status(201).json({ data: reaction });
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message || 'Không thể thêm reaction' });
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

        const reaction = await messageService.removeReaction(messageId, userId, decodeURIComponent(emoji));
        const target = await messageRepository.getMessageById(messageId);
        getIO().to(`conversation:${target.conversation_id}`).emit('message:reaction:updated', {
            messageId,
            conversationId: target.conversation_id,
            action: 'remove',
            reaction: reaction || {
                message_id: messageId,
                user_id: userId,
                emoji: decodeURIComponent(emoji)
            }
        });

        return res.json({ data: reaction });
    } catch (error) {
        return res.status(error.statusCode || 500).json({ message: error.message || 'Không thể xoá reaction' });
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
