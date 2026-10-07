const conversationService = require('../service/conversationService');
const messageRepository = require('../repository/messageRepository');

const createDirectConversation = async (req, res) => {
    try {
        const currentUserId = Number(req.user.id);
        const targetUserId = Number(req.body.userId);

        if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
            return res.status(401).json({ message: 'User hiện tại không hợp lệ' });
        }

        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ message: 'userId không hợp lệ' });
        }

        const conversation = await conversationService.getOrCreateDirectConversation(
            currentUserId,
            targetUserId
        );

        return res.status(200).json({
            message: 'Conversation đã sẵn sàng',
            data: conversation
        });
    } catch (error) {
        console.error('CREATE DIRECT CONVERSATION ERROR:', error);

        if (error.message === 'Không thể tạo conversation với chính mình') {
            return res.status(400).json({ message: error.message });
        }

        if (error.message === 'Người dùng không tồn tại hoặc đã bị khóa') {
            return res.status(404).json({ message: error.message });
        }

        return res.status(500).json({
            message: error.message || 'Không thể tạo conversation'
        });
    }
};

const getUserConversations = async (req, res, next) => {
    try {
        const conversations = await conversationService.getUserConversations(Number(req.user.id));
        return res.status(200).json({ data: conversations });
    } catch (error) {
        next(error);
    }
};

const getConversationMembers = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.conversationId);

        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }

        const members = await conversationService.getConversationMembers(
            conversationId,
            Number(req.user.id)
        );

        return res.status(200).json({ data: members });
    } catch (error) {
        if (error.message === 'Bạn không thuộc conversation này') {
            return res.status(403).json({ message: error.message });
        }
        next(error);
    }
};

const markAsRead = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.id);
        const userId = Number(req.user.id);

        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }

        const isMember = await require('../repository/conversationRepository')
            .isConversationMember(conversationId, userId);

        if (!isMember) {
            return res.status(403).json({ message: 'Bạn không thuộc conversation này' });
        }

        await messageRepository.markMessagesAsRead(conversationId, userId);

        return res.status(200).json({
            success: true,
            message: 'Đã đánh dấu là đã đọc'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createDirectConversation,
    getUserConversations,
    getConversationMembers,
    markAsRead
};