const conversationService = require('../service/conversationService');
const messageRepository = require('../repository/messageRepository');
const { getIO } = require('../src/socket/socket');

const createDirectConversation = async (req, res) => {
    try {
        const conversation = await conversationService.getOrCreateDirectConversation(
            Number(req.user.id),
            Number(req.body.userId)
        );
        return res.status(200).json({ message: 'Conversation đã sẵn sàng', data: conversation });
    } catch (error) {
        const map = {
            'Không thể tạo conversation với chính mình': 400,
            'Người dùng không tồn tại hoặc đã bị khóa': 404
        };
        return res.status(map[error.message] || 500).json({ message: error.message || 'Không thể tạo conversation' });
    }
};

const getUserConversations = async (req, res, next) => {
    try {
        return res.status(200).json({
            data: await conversationService.getUserConversations(Number(req.user.id))
        });
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

        return res.status(200).json({
            data: await conversationService.getConversationMembers(
                conversationId,
                Number(req.user.id)
            )
        });
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

        if (!await require('../repository/conversationRepository').isConversationMember(conversationId, userId)) {
            return res.status(403).json({ message: 'Bạn không thuộc conversation này' });
        }

        await messageRepository.markMessagesAsRead(conversationId, userId);
        return res.status(200).json({ success: true, message: 'Đã đánh dấu là đã đọc' });
    } catch (error) {
        next(error);
    }
};

const createGroup = async (req, res) => {
    try {
        const data = await conversationService.createGroupConversation(
            Number(req.user.id),
            req.body.memberIds,
            req.body.name,
            req.body.avatarUrl || null
        );
        const memberIds = [...new Set([Number(req.user.id), ...(Array.isArray(req.body.memberIds) ? req.body.memberIds.map(Number) : [])])];
        for (const memberId of memberIds) {
            getIO().to(`user:${memberId}`).emit('conversation:created', { conversation: data });
        }

        return res.status(201).json({ message: 'Tạo group thành công', data });
    } catch (error) {
        const status = /ít nhất|không hợp lệ/.test(error.message) ? 400 : 404;
        return res.status(status).json({ message: error.message });
    }
};

const updateGroup = async (req, res) => {
    try {
        const conversationId = Number(req.params.conversationId);
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }

        const data = await conversationService.updateGroupConversation(
            conversationId,
            Number(req.user.id),
            req.body.name,
            req.body.avatarUrl || null
        );

        const memberIds = await require('../repository/conversationRepository')
            .getConversationMemberIds(conversationId);

        for (const memberId of memberIds) {
            getIO().to(`user:${memberId}`).emit('conversation:updated', {
                conversationId,
                conversation: data
            });
        }

        return res.status(200).json({ message: 'Đã cập nhật thông tin nhóm', data });
    } catch (error) {
        const status = /quyền|group|không hợp lệ/.test(error.message) ? 403 : 400;
        return res.status(status).json({ message: error.message });
    }
};

const addGroupMember = async (req, res) => {
    try {
        const data = await conversationService.addGroupMember(
            Number(req.params.conversationId),
            Number(req.user.id),
            Number(req.body.userId)
        );
        getIO().to(`user:${Number(req.body.userId)}`).emit('conversation:created', {
            conversation: { id: Number(req.params.conversationId) }
        });
        return res.status(201).json({ message: 'Đã thêm thành viên', data });
    } catch (error) {
        const status = /quyền|role|group|không tồn tại/.test(error.message) ? 403 : 400;
        return res.status(status).json({ message: error.message });
    }
};

const removeGroupMember = async (req, res) => {
    try {
        const data = await conversationService.removeGroupMember(
            Number(req.params.conversationId),
            Number(req.user.id),
            Number(req.params.userId)
        );
        return res.status(200).json({ message: 'Đã xoá thành viên', data });
    } catch (error) {
        return res.status(403).json({ message: error.message });
    }
};

const leaveGroup = async (req, res) => {
    try {
        const data = await conversationService.leaveGroup(
            Number(req.params.conversationId),
            Number(req.user.id)
        );
        return res.status(200).json({ message: 'Đã rời nhóm', data });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

const updateGroupMemberRole = async (req, res) => {
    try {
        const data = await conversationService.updateGroupMemberRole(
            Number(req.params.conversationId),
            Number(req.user.id),
            Number(req.params.userId),
            req.body.role
        );
        return res.status(200).json({ message: 'Đã cập nhật role', data });
    } catch (error) {
        return res.status(403).json({ message: error.message });
    }
};

module.exports = {
    createDirectConversation,
    getUserConversations,
    getConversationMembers,
    markAsRead,
    createGroup,
    updateGroup,
    addGroupMember,
    removeGroupMember,
    leaveGroup,
    updateGroupMemberRole
};
