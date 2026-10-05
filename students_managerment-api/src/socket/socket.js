const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const conversationRepository = require('../../repository/conversationRepository.js');
const authRepository = require('../../repository/authRepository.js');
const messageRepository = require('../../repository/messageRepository.js');

let io = null;
const onlineUsers = new Map();

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            credentials: true
        }
    });

    io.use(async (socket, next) => {
        try {
            const accessToken = socket.handshake.auth?.accessToken;
            if (!accessToken) return next(new Error('Không có Access Token'));

            const decoded = jwt.verify(accessToken, process.env.JWT_SECRET, {
                issuer: 'student-management-api',
                audience: 'student-management-client'
            });

            if (!decoded.sub || !decoded.sessionId) {
                return next(new Error('Access Token thiếu Session ID'));
            }

            const session = await authRepository.findSessionByIdAndUserId(
                decoded.sessionId,
                decoded.sub
            );

            if (!session || session.revoked_at !== null) {
                return next(new Error('Session không tồn tại hoặc đã bị thu hồi'));
            }

            await authRepository.updateSessionLastUsed(decoded.sessionId);

            socket.user = {
                id: Number(decoded.sub),
                username: decoded.username,
                role: decoded.role,
                sessionId: decoded.sessionId
            };

            next();
        } catch (error) {
            console.error('Socket authentication error:', error.message);
            next(new Error('Access Token không hợp lệ'));
        }
    });

    io.on('connection', (socket) => {
        const userId = Number(socket.user.id);
        const sessionId = socket.user.sessionId;

        socket.join(`session:${sessionId}`);
        socket.join(`user:${userId}`);

        const previousSocketCount = onlineUsers.get(userId) || 0;
    onlineUsers.set(userId, previousSocketCount + 1);

    // Chỉ phát ONLINE khi user thực sự chuyển từ offline -> online.
    if (previousSocketCount === 0) {
        try {
            const contactIds = await conversationRepository.getConversationContactIds(userId);
            for (const contactId of contactIds) {
                io.to(`user:${contactId}`).emit('presence:online', { userId });
            }
        } catch (error) {
            console.error('PRESENCE ONLINE ERROR:', error);
        }
    }

    // Gửi snapshot presence cho client vừa kết nối.
    try {
        const contactIds = await conversationRepository.getConversationContactIds(userId);
        const onlineContactIds = contactIds.filter(contactId => onlineUsers.has(contactId));
        socket.emit('presence:snapshot', { userIds: onlineContactIds });
    } catch (error) {
        console.error('PRESENCE SNAPSHOT ERROR:', error);
    }

        socket.on('conversation:join', async ({ conversationId }) => {
            const id = Number(conversationId);
            if (!Number.isInteger(id) || id <= 0) {
                return socket.emit('conversation:error', { message: 'conversationId không hợp lệ' });
            }

            try {
                const isMember = await conversationRepository.isConversationMember(id, userId);
                if (!isMember) {
                    return socket.emit('conversation:error', { message: 'Bạn không thuộc conversation này' });
                }

                socket.join(`conversation:${id}`);
                socket.emit('conversation:joined', { conversationId: id });

                // Đồng bộ presence ngay khi mở conversation mới.
                const memberIds = await conversationRepository.getConversationMemberIds(id);
                for (const memberId of memberIds) {
                    if (memberId !== userId && onlineUsers.has(memberId)) {
                        socket.emit('presence:online', { userId: memberId });
                    }
                }
            } catch (error) {
                console.error('JOIN CONVERSATION ERROR:', error);
                socket.emit('conversation:error', { message: 'Không thể tham gia conversation' });
            }
        });

        socket.on('conversation:leave', ({ conversationId }) => {
            const id = Number(conversationId);
            if (Number.isInteger(id) && id > 0) socket.leave(`conversation:${id}`);
        });

        socket.on('message:send', async ({ conversationId, content }) => {
            const id = Number(conversationId);
            const text = typeof content === 'string' ? content.trim() : '';

            if (!Number.isInteger(id) || id <= 0) {
                return socket.emit('message:error', { message: 'conversationId không hợp lệ' });
            }
            if (!text) {
                return socket.emit('message:error', { message: 'Nội dung tin nhắn không được để trống' });
            }

            try {
                const isMember = await conversationRepository.isConversationMember(id, userId);
                if (!isMember) {
                    return socket.emit('message:error', { message: 'Bạn không thuộc conversation này' });
                }

                const savedMessage = await messageRepository.createMessage(id, userId, text);
                const memberIds = await conversationRepository.getConversationMemberIds(id);

                io.to(`conversation:${id}`).emit('message:new', savedMessage);

                for (const memberId of memberIds) {
                    io.to(`user:${memberId}`).emit('conversation:updated', {
                        conversationId: id,
                        lastMessage: savedMessage,
                        senderId: userId,
                        updatedAt: savedMessage.created_at
                    });
                }

                socket.emit('message:sent', { message: savedMessage });
            } catch (error) {
                console.error('SEND MESSAGE ERROR:', error);
                socket.emit('message:error', { message: 'Không thể gửi tin nhắn' });
            }
        });

        socket.on('message:read', async ({ conversationId }) => {
            const id = Number(conversationId);
            if (!Number.isInteger(id) || id <= 0) return;

            try {
                if (!await conversationRepository.isConversationMember(id, userId)) return;
                await messageRepository.markMessagesAsRead(id, userId);
                socket.to(`conversation:${id}`).emit('messages:read', {
                    conversationId: id,
                    readBy: userId
                });
            } catch (error) {
                console.error('MARK READ ERROR:', error);
            }
        });

        socket.on('typing:start', async ({ conversationId }) => {
            const id = Number(conversationId);
            try {
                if (!Number.isInteger(id) || id <= 0) return;
                if (!await conversationRepository.isConversationMember(id, userId)) return;

                socket.to(`conversation:${id}`).emit('typing:start', {
                    conversationId: id,
                    userId,
                    username: socket.user.username
                });
            } catch (error) {
                console.error('TYPING START ERROR:', error);
            }
        });

        socket.on('typing:stop', async ({ conversationId }) => {
            const id = Number(conversationId);
            try {
                if (!Number.isInteger(id) || id <= 0) return;
                if (!await conversationRepository.isConversationMember(id, userId)) return;

                socket.to(`conversation:${id}`).emit('typing:stop', {
                    conversationId: id,
                    userId
                });
            } catch (error) {
                console.error('TYPING STOP ERROR:', error);
            }
        });

        socket.on('disconnect', (reason) => {
            const count = Math.max((onlineUsers.get(userId) || 1) - 1, 0);
            if (count === 0) {
                onlineUsers.delete(userId);

                try {
                    const contactIds = await conversationRepository.getConversationContactIds(userId);
                    for (const contactId of contactIds) {
                        io.to(`user:${contactId}`).emit('presence:offline', { userId });
                    }
                } catch (error) {
                    console.error('PRESENCE OFFLINE ERROR:', error);
                }
            } else {
                onlineUsers.set(userId, count);
            }

            console.log(`Socket disconnected: user=${userId}, reason=${reason}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) throw new Error('Socket.IO chưa được khởi tạo');
    return io;
};

const isUserOnline = (userId) => onlineUsers.has(Number(userId));

const emitSessionRevoked = (sessionId, reason = 'SESSION_REVOKED') => {
    getIO().to(`session:${sessionId}`).emit('session:revoked', {
        sessionId,
        reason
    });
};

module.exports = {
    initSocket,
    getIO,
    emitSessionRevoked,
    isUserOnline
};