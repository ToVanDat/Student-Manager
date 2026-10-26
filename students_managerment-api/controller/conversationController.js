const conversationService = require('../service/conversationService');
const messageRepository = require('../repository/messageRepository');
const callRepository = require('../repository/callRepository');
const userRepository = require('../repository/userRepository');
const { getIO } = require('../src/socket/socket');

const createAndEmitSystemMessage = async (conversationId, actorId, content) => {
    try {
        const message = await messageRepository.createSystemMessage(
            conversationId,
            actorId,
            content
        );
        getIO().to(`conversation:${conversationId}`).emit('message:new', message);
        return message;
    } catch (error) {
        // Group membership changes must not fail just because the optional
        // system-message migration has not been applied yet.
        console.error('SYSTEM MESSAGE ERROR:', error);
        return null;
    }
};

const getUsername = async (userId) => {
    const user = await userRepository.findActiveUserById(Number(userId));
    return user?.username || 'Người dùng';
};

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
            'Người dùng không tồn tại hoặc đã bị khóa': 404,
            'Không thể bắt đầu cuộc trò chuyện với người dùng đã bị chặn': 403
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

const clearConversationMessagesForUser = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const userId = Number(req.user.id);
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }

        const data = await conversationService.clearConversationMessagesForUser(conversationId, userId);
        await callRepository.hideConversationCallHistoryForUser(userId, conversationId);
        getIO().to(`user:${userId}`).emit('conversation:history-cleared', {
            conversationId,
            deletedCount: data.deleted_count
        });
        return res.status(200).json({
            message: 'Đã xóa nội dung cuộc trò chuyện ở phía bạn',
            data
        });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        next(error);
    }
};

const getConversationChatTheme = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const userId = Number(req.user.id);
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }
        const repository = require('../repository/conversationRepository');
        if (!await repository.isConversationMember(conversationId, userId)) {
            return res.status(403).json({ message: 'Bạn không thuộc conversation này' });
        }
        return res.status(200).json({ data: { theme: await repository.getConversationChatTheme(conversationId) } });
    } catch (error) {
        if (error?.code === '42703' && /chat_theme/i.test(error.message || '')) {
            return res.status(503).json({
                code: 'THEME_MIGRATION_REQUIRED',
                message: 'Database chưa có cột Chat Theme. Hãy chạy students_managerment-api/sql/shared_conversation_chat_theme_migration.sql trong DBeaver.'
            });
        }
        if (error?.code === '42P01' && /conversation_user_settings/i.test(error.message || '')) {
            return res.status(503).json({
                code: 'CHAT_SETTINGS_SCHEMA_NOT_INITIALIZED',
                message: 'Chưa có bảng cài đặt cuộc trò chuyện. Hãy kiểm tra migration tạo conversation_user_settings trước khi chạy theme_preferences_migration.sql.'
            });
        }
        next(error);
    }
};

const updateConversationChatTheme = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const userId = Number(req.user.id);
        const { theme } = req.body || {};
        const allowedThemes = ['default', 'ocean', 'lavender', 'mint', 'rose', 'amber'];
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }
        if (!allowedThemes.includes(theme)) {
            return res.status(400).json({ message: 'Chủ đề cuộc trò chuyện không hợp lệ' });
        }
        const repository = require('../repository/conversationRepository');
        if (!await repository.isConversationMember(conversationId, userId)) {
            return res.status(403).json({ message: 'Bạn không thuộc conversation này' });
        }
        const data = await repository.setConversationChatTheme(conversationId, theme);
        if (!data) return res.status(404).json({ message: 'Conversation không tồn tại' });
        getIO().to(`conversation:${conversationId}`).emit('conversation:theme-updated', {
            conversationId,
            theme: data.chat_theme,
            updatedBy: userId,
            updatedAt: new Date().toISOString()
        });
        return res.status(200).json({ message: 'Đã cập nhật chủ đề cho cả cuộc trò chuyện', data: { theme: data.chat_theme } });
    } catch (error) {
        if (error?.code === '42703' && /chat_theme/i.test(error.message || '')) {
            return res.status(503).json({
                code: 'THEME_MIGRATION_REQUIRED',
                message: 'Database chưa có cột Chat Theme. Hãy chạy students_managerment-api/sql/shared_conversation_chat_theme_migration.sql trong DBeaver.'
            });
        }
        if (error?.code === '42P01' && /conversation_user_settings/i.test(error.message || '')) {
            return res.status(503).json({
                code: 'CHAT_SETTINGS_SCHEMA_NOT_INITIALIZED',
                message: 'Chưa có bảng cài đặt cuộc trò chuyện. Hãy kiểm tra migration tạo conversation_user_settings trước khi chạy theme_preferences_migration.sql.'
            });
        }
        next(error);
    }
};

const updateConversationSettings = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const userId = Number(req.user.id);
        const { action, value } = req.body || {};
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }
        const data = await conversationService.updateConversationSettings(
            conversationId,
            userId,
            action,
            value
        );
        return res.status(200).json({ message: 'Đã cập nhật cài đặt cuộc trò chuyện', data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        next(error);
    }
};

const blockUser = async (req, res, next) => {
    try {
        const data = await conversationService.blockUser(
            Number(req.params.conversationId),
            Number(req.user.id),
            Number(req.body.targetUserId)
        );
        return res.status(200).json({ message: 'Đã chặn người dùng', data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        next(error);
    }
};

const unblockUser = async (req, res, next) => {
    try {
        const data = await conversationService.unblockUser(
            Number(req.params.conversationId),
            Number(req.user.id),
            Number(req.body.targetUserId)
        );
        return res.status(200).json({ message: 'Đã bỏ chặn người dùng', data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
        next(error);
    }
};

const reportConversation = async (req, res, next) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const userId = Number(req.user.id);
        const targetUserId = Number(req.body.targetUserId);
        const { reason, details = null } = req.body || {};
        const data = await conversationService.reportConversation(
            conversationId,
            userId,
            targetUserId,
            reason,
            details
        );
        return res.status(201).json({ message: 'Đã gửi báo cáo', data });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
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

        const actorName = await getUsername(Number(req.user.id));
        await createAndEmitSystemMessage(
            data.id,
            Number(req.user.id),
            `${actorName} đã tạo nhóm ${data.name}`
        );

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

        const oldConversation = await require('../repository/conversationRepository')
            .getConversationInfo(conversationId);

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

        const actorName = await getUsername(Number(req.user.id));
        await createAndEmitSystemMessage(
            conversationId,
            Number(req.user.id),
            `${actorName} đã đổi tên nhóm thành "${data.name}"`
        );

        return res.status(200).json({ message: 'Đã cập nhật thông tin nhóm', data });
    } catch (error) {
        const status = /quyền|group|không hợp lệ/.test(error.message) ? 403 : 400;
        return res.status(status).json({ message: error.message });
    }
};

const addGroupMember = async (req, res) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const targetUserId = Number(req.body.userId);
        if (!Number.isInteger(conversationId) || conversationId <= 0 ||
            !Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ message: 'conversationId hoặc userId không hợp lệ' });
        }

        const data = await conversationService.addGroupMember(
            conversationId,
            Number(req.user.id),
            targetUserId
        );
        const actorId = Number(req.user.id);
        const addedName = await getUsername(Number(data.user_id));
        const actorName = await getUsername(actorId);
        const memberIds = await require('../repository/conversationRepository').getConversationMemberIds(conversationId);
        const io = getIO();

        for (const memberId of memberIds) {
            io.to(`user:${memberId}`).emit('member:added', {
                conversationId,
                member: data
            });
            io.to(`user:${memberId}`).emit('conversation:updated', {
                conversationId,
                action: 'member-added',
                member: data
            });
        }

        // Người vừa được thêm có thể đang online nhưng trước đó chưa nằm trong
        // contact list của các thành viên hiện tại.
        if (require('../src/socket/socket').isUserOnline(Number(data.user_id))) {
            for (const memberId of memberIds) {
                io.to(`user:${memberId}`).emit('presence:online', {
                    userId: Number(data.user_id)
                });
            }
        }

        await createAndEmitSystemMessage(
            conversationId,
            actorId,
            `${actorName} đã thêm ${addedName} vào nhóm`
        );

        return res.status(201).json({ message: 'Đã thêm thành viên', data });
    } catch (error) {
        const status = /quyền|role|group|không tồn tại/.test(error.message) ? 403 : 400;
        return res.status(status).json({ message: error.message });
    }
};

const removeGroupMember = async (req, res) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const targetUserId = Number(req.params.userId);
        if (!Number.isInteger(conversationId) || conversationId <= 0 ||
            !Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ message: 'conversationId hoặc userId không hợp lệ' });
        }
        const memberIdsBefore = await require('../repository/conversationRepository').getConversationMemberIds(conversationId);
        const targetName = await getUsername(targetUserId);
        const actorName = await getUsername(Number(req.user.id));
        const data = await conversationService.removeGroupMember(
            conversationId,
            Number(req.user.id),
            targetUserId
        );
        const io = getIO();
        const removedUserId = Number(data.user_id);

        io.to(`user:${removedUserId}`).emit('member:removed', {
            conversationId,
            member: data,
            message: 'Bạn đã bị xóa khỏi nhóm'
        });

        // A removed member may have multiple tabs/devices still joined to this
        // Socket.IO room. Remove every socket for that user immediately so they
        // cannot keep receiving messages, reactions, typing, or call events from
        // a group they no longer belong to.
        io.in(`user:${removedUserId}`).socketsLeave(`conversation:${conversationId}`);

        for (const memberId of memberIdsBefore) {
            if (Number(memberId) === removedUserId) continue;
            io.to(`user:${memberId}`).emit('conversation:updated', {
                conversationId,
                action: 'member-removed',
                member: data
            });
        }
        await createAndEmitSystemMessage(
            conversationId,
            Number(req.user.id),
            `${actorName} đã xóa ${targetName} khỏi nhóm`
        );

        return res.status(200).json({ message: 'Đã xoá thành viên', data });
    } catch (error) {
        return res.status(403).json({ message: error.message });
    }
};

const leaveGroup = async (req, res) => {
    try {
        const conversationId = Number(req.params.conversationId);
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).json({ message: 'conversationId không hợp lệ' });
        }
        const leavingName = await getUsername(Number(req.user.id));
        const memberIdsBefore = await require('../repository/conversationRepository').getConversationMemberIds(conversationId);
        const data = await conversationService.leaveGroup(
            conversationId,
            Number(req.user.id)
        );
        const io = getIO();
        const leavingUserId = Number(data.user_id);

        for (const memberId of memberIdsBefore) {
            io.to(`user:${memberId}`).emit('conversation:updated', {
                conversationId,
                action: 'member-left',
                member: data
            });
        }

        io.to(`user:${leavingUserId}`).emit('member:left', {
            conversationId,
            member: data,
            message: 'Bạn đã rời nhóm'
        });

        // Leave all tabs/devices out of the conversation room immediately.
        io.in(`user:${leavingUserId}`).socketsLeave(`conversation:${conversationId}`);

        await createAndEmitSystemMessage(
            conversationId,
            Number(req.user.id),
            `${leavingName} đã rời nhóm`
        );

        return res.status(200).json({ message: 'Đã rời nhóm', data });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

const updateGroupMemberRole = async (req, res) => {
    try {
        const conversationId = Number(req.params.conversationId);
        const targetUserId = Number(req.params.userId);
        if (!Number.isInteger(conversationId) || conversationId <= 0 ||
            !Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ message: 'conversationId hoặc userId không hợp lệ' });
        }
        const targetName = await getUsername(targetUserId);
        const actorName = await getUsername(Number(req.user.id));
        const memberIds = await require('../repository/conversationRepository').getConversationMemberIds(conversationId);
        const data = await conversationService.updateGroupMemberRole(
            conversationId,
            Number(req.user.id),
            targetUserId,
            req.body.role
        );

        const io = getIO();

        if (req.body.role === 'owner') {
            // Ownership transfer is atomic in the repository. Only emit after COMMIT.
            for (const memberId of memberIds) {
                io.to(`user:${memberId}`).emit('conversation:updated', {
                    conversationId,
                    action: 'member-role-updated',
                    member: data.previousOwner
                });
                io.to(`user:${memberId}`).emit('conversation:updated', {
                    conversationId,
                    action: 'member-role-updated',
                    member: data.newOwner
                });
            }
        } else {
            for (const memberId of memberIds) {
                io.to(`user:${memberId}`).emit('conversation:updated', {
                    conversationId,
                    action: 'member-role-updated',
                    member: data
                });
            }
        }

        const roleLabel = { owner: 'trưởng nhóm', admin: 'quản trị viên', member: 'thành viên' }[req.body.role] || req.body.role;
        await createAndEmitSystemMessage(
            conversationId,
            Number(req.user.id),
            `${actorName} đã cập nhật quyền của ${targetName} thành ${roleLabel}`
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
    updateGroupMemberRole,
    updateConversationSettings,
    getConversationChatTheme,
    updateConversationChatTheme,
    clearConversationMessagesForUser,
    blockUser,
    unblockUser,
    reportConversation
};
