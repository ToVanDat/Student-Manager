const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const conversationRepository = require('../../repository/conversationRepository.js');
const authRepository = require('../../repository/authRepository.js');
const messageRepository = require('../../repository/messageRepository.js');

let io = null;

// =====================================================
// INIT SOCKET.IO
// =====================================================
const initSocket = (server) => {

    io = new Server(server, {
        cors: {
            origin: 'http://localhost:5173',
            credentials: true
        }
    });

    // =================================================
    // SOCKET AUTHENTICATION
    // =================================================
    io.use(async (socket, next) => {

        try {

            // GET ACCESS TOKEN
            const accessToken = socket.handshake.auth?.accessToken;

            if (!accessToken) {
                return next(
                    new Error('Không có Access Token')
                );
            }

            // VERIFY JWT
            const decoded = jwt.verify(
                accessToken,
                process.env.JWT_SECRET,
                {
                    issuer: 'student-management-api',
                    audience: 'student-management-client'
                }
            );

            // CHECK JWT DATA
            if (!decoded.sub || !decoded.sessionId) {
                return next(
                    new Error('Access Token thiếu Session ID')
                );
            }

            // CHECK SESSION IN DATABASE
            const session = await authRepository.findSessionByIdAndUserId(
                decoded.sessionId,
                decoded.sub
            );

            if (!session) {
                return next(
                    new Error('Session không tồn tại')
                );
            }

            // CHECK SESSION REVOKED
            if (session.revoked_at !== null) {
                return next(
                    new Error('Session đã bị thu hồi')
                );
            }

            // UPDATE LAST USED
            await authRepository.updateSessionLastUsed(
                decoded.sessionId
            );

            // SAVE USER INFORMATION
            socket.user = {
                id: decoded.sub,
                username: decoded.username,
                role: decoded.role,
                sessionId: decoded.sessionId
            };

            // AUTHENTICATION SUCCESS
            next();

        } catch (error) {

            console.error(
                'Socket authentication error:',
                error.message
            );

            next(
                new Error('Access Token không hợp lệ')
            );
        }
    });

    // =================================================
    // SOCKET CONNECTION
    // =================================================
    io.on('connection', (socket) => {

        const sessionId = socket.user.sessionId;
        const userId = Number(socket.user.id);

        // =============================================
        // CREATE SESSION ROOM & USER ROOM
        // =============================================
        const sessionRoom = `session:${sessionId}`;
        const userRoom = `user:${userId}`;

        socket.join(sessionRoom);
        socket.join(userRoom); // Bắt buộc tham gia User Room để nhận thông báo Sidebar

        // =============================================
        // LOG CONNECTION
        // =============================================
        console.log('Socket connected');
        console.log(`User: ${userId}`);
        console.log(`Session: ${sessionId}`);
        console.log(`User Room: ${userRoom}`);

        // =============================================
        // EVENT: JOIN CONVERSATION ROOM
        // =============================================
        socket.on('conversation:join', async ({ conversationId }) => {

            try {

                const id = Number(conversationId);

                // CHECK CONVERSATION ID
                if (!Number.isInteger(id) || id <= 0) {
                    return socket.emit('conversation:error', {
                        message: 'conversationId không hợp lệ'
                    });
                }

                // CHECK MEMBER
                const isMember = await conversationRepository.isConversationMember(
                    id,
                    userId
                );

                if (!isMember) {
                    return socket.emit('conversation:error', {
                        message: 'Bạn không thuộc conversation này'
                    });
                }

                // CREATE & JOIN ROOM
                const conversationRoom = `conversation:${id}`;
                socket.join(conversationRoom);

                console.log(`User ${userId} joined ${conversationRoom}`);

                socket.emit('conversation:joined', {
                    conversationId: id
                });

            } catch (error) {

                console.error('JOIN CONVERSATION ERROR:', error);

                socket.emit('conversation:error', {
                    message: 'Không thể tham gia conversation'
                });
            }
        });

        // =============================================
        // EVENT: SEND MESSAGE
        // =============================================
        socket.on('message:send', async ({ conversationId, content }) => {

            try {

                const senderId = Number(socket.user.id);
                const id = Number(conversationId);

                // 1. VALIDATE INPUT
                if (!Number.isInteger(id) || id <= 0) {
                    return socket.emit('message:error', {
                        message: 'conversationId không hợp lệ'
                    });
                }

                if (!content || typeof content !== 'string' || content.trim() === '') {
                    return socket.emit('message:error', {
                        message: 'Nội dung tin nhắn không được để trống'
                    });
                }

                // 2. CHECK MEMBER AUTHORIZATION
                const isMember = await conversationRepository.isConversationMember(
                    id,
                    senderId
                );

                if (!isMember) {
                    return socket.emit('message:error', {
                        message: 'Bạn không thuộc conversation này'
                    });
                }

                // 3. SAVE MESSAGE TO DATABASE & UPDATE CONVERSATION
                const savedMessage = await messageRepository.createMessage(
                    id,
                    senderId,
                    content.trim()
                );

                // 4. ACKNOWLEDGEMENT TO SENDER
                socket.emit('message:sent', {
                    message: savedMessage
                });

                // 5. EMIT REALTIME TO CONVERSATION ROOM (Cho khung chat đang mở)
                const conversationRoom = `conversation:${id}`;
                io.to(conversationRoom).emit('message:new', savedMessage);

                // 6. BROADCAST UPDATE TO ALL MEMBERS (Cập nhật danh sách Sidebar)
                const memberIds = await conversationRepository.getConversationMemberIds(id);

                memberIds.forEach((memberId) => {
                    io.to(`user:${memberId}`).emit('conversation:updated', {
                        conversationId: id,
                        lastMessage: savedMessage,
                        updatedAt: new Date()
                    });
                });

            } catch (error) {

                console.error('SEND MESSAGE ERROR:', error);

                socket.emit('message:error', {
                    message: 'Không thể gửi tin nhắn'
                });
            }
        });

    // typing start : khi bat dau go hien thi trang thai typing
        socket.on('typing:start', async ({ conversationId }) => {

            try {

                const userId = Number(socket.user.id);
                const id = Number(conversationId);

                // 1. VALIDATE INPUT
                if (!Number.isInteger(id) || id <= 0) {
                    return;
                }

                // 2. CHECK MEMBER AUTHORIZATION
                const isMember = await conversationRepository.isConversationMember(
                    id,
                    userId
                );

                if (!isMember) {
                    return;
                }

                // 3. BROADCAST TO ROOM (EXCEPT SENDER)
                const conversationRoom = `conversation:${id}`;
                socket.to(conversationRoom).emit('typing:start', {
                    conversationId: id,
                    userId,
                    username: socket.user.username
                });

            } catch (error) {

                console.error('TYPING START ERROR:', error);
            }
        });

    // khi ket thuc go hien thi trang thai theo timer sau 3s
        socket.on('typing:stop', async ({ conversationId }) => {

            try {

                const userId = Number(socket.user.id);
                const id = Number(conversationId);

                // 1. VALIDATE INPUT
                if (!Number.isInteger(id) || id <= 0) {
                    return;
                }

                // 2. CHECK MEMBER AUTHORIZATION
                const isMember = await conversationRepository.isConversationMember(
                    id,
                    userId
                );

                if (!isMember) {
                    return;
                }

                // 3. BROADCAST TO ROOM (EXCEPT SENDER)
                const conversationRoom = `conversation:${id}`;
                socket.to(conversationRoom).emit('typing:stop', {
                    conversationId: id,
                    userId
                });

            } catch (error) {

                console.error('TYPING STOP ERROR:', error);
            }
        });

        // =============================================
        // DISCONNECT
        // =============================================
        socket.on('disconnect', (reason) => {

            console.log('Socket disconnected');
            console.log(`Session: ${sessionId}`);
            console.log(`Reason: ${reason}`);
        });
    });

    return io;
};

// =====================================================
// GET IO
// =====================================================
const getIO = () => {

    if (!io) {
        throw new Error('Socket.IO chưa được khởi tạo');
    }

    return io;
};

// =====================================================
// EMIT SESSION REVOKED
// =====================================================
const emitSessionRevoked = (sessionId, reason = 'SESSION_REVOKED') => {

    const socketIO = getIO();

    // SESSION ROOM
    const room = `session:${sessionId}`;

    // SEND EVENT
    socketIO.to(room).emit('session:revoked', {
        sessionId,
        reason
    });

    // LOG
    console.log('Session revoked event sent');
    console.log(`Session: ${sessionId}`);
    console.log(`Reason: ${reason}`);
};

module.exports = {
    initSocket,
    getIO,
    emitSessionRevoked
};