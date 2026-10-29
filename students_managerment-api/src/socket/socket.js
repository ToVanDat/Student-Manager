const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { redisClient } = require('../config/redis.js');
const conversationRepository = require('../../repository/conversationRepository.js');
const authRepository = require('../../repository/authRepository.js');
const messageRepository = require('../../repository/messageRepository.js');
const messageService = require('../../service/messageService.js');
const notificationDeliveryService = require('../../service/notificationDeliveryService.js');
const userRepository = require('../../repository/userRepository.js');
const e2eeRepository = require('../../repository/e2eeRepository.js');
const callRepository = require('../../repository/callRepository.js');
const { isValidCallId, isValidCallType, normalizeCallFailureReason } = require('../../service/callValidation.js');
const { isValidSessionDescription, isValidIceCandidate, wrapSocketEventListener } = require('../../service/socketPayloadValidation.js');
const { SOCKET_EVENT_LIMITS, consumeSocketRateLimit } = require('../../middleware/socketRateLimiter.js');
const { allowSocketHandshake } = require('../../middleware/socketHandshakeRateLimiter.js');

let io = null;
let presenceSubscriber = null;
const onlineUsers = new Map(); // userId -> Set<socketId>
const callTimers = new Map(); // callId -> timeout
const disconnectGraceTimers = new Map(); // userId -> timeout
const PRESENCE_SOCKET_TTL_SECONDS = 65;
const presenceSocketKey = (id) => `presence:user:${Number(id)}:sockets`;
const getSharedOnlineUserIds = async (ids) => {
    if (!redisClient.isReady) throw new Error('Redis presence store is unavailable');
    const uniqueIds = [...new Set(ids.map(Number).filter(Number.isSafeInteger))];
    if (!uniqueIds.length) return [];
    const pipeline = redisClient.multi();
    uniqueIds.forEach(id => pipeline.exists(presenceSocketKey(id)));
    const results = await pipeline.exec();
    return uniqueIds.filter((_, index) => Number(results[index]) > 0);
};
const refreshSharedPresence = async (id, socketId) => {
    if (!redisClient.isReady) throw new Error('Redis presence store is unavailable');
    const key = presenceSocketKey(id);
    await redisClient.sAdd(key, socketId);
    await redisClient.expire(key, PRESENCE_SOCKET_TTL_SECONDS);
    return Number(await redisClient.sCard(key));
};
const publishRealtimeEvent = async (event, payload) => {
    if (!redisClient.isReady) throw new Error('Redis presence publisher is unavailable');
    await redisClient.publish('presence:events', JSON.stringify({ event, payload }));
};

const initSocket = async (server) => {
    // Keep Socket.IO's browser-origin policy aligned with Express CORS.
    // Do not use wildcard origins because credentialed browser clients are supported.
    const configuredOrigins = (process.env.FRONTEND_URLS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    const localDevelopmentOrigins = process.env.NODE_ENV === 'production'
        ? []
        : [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'https://student-manager.local'
        ];
    const allowedOrigins = new Set([
        ...localDevelopmentOrigins,
        process.env.FRONTEND_URL,
        ...configuredOrigins
    ].filter(Boolean));

    // Redis Pub/Sub relays presence transitions to Socket.IO nodes sharing this Redis.
    presenceSubscriber = redisClient.duplicate();
    await presenceSubscriber.connect();
    await presenceSubscriber.subscribe('presence:events', raw => {
        try {
            const event = JSON.parse(raw);
            if (['presence:online', 'presence:offline'].includes(event?.event)) {
                const recipientIds = [...new Set((event?.payload?.recipientIds || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))];
                for (const recipientId of recipientIds) io?.to(`user:${recipientId}`).emit(event.event, event.payload);
                return;
            }
            if (event?.event === 'conversation:theme-updated') {
                const conversationId = Number(event?.payload?.conversationId);
                if (Number.isSafeInteger(conversationId) && conversationId > 0) {
                    io?.to(`conversation:${conversationId}`).emit(event.event, event.payload);
                }
            }
        } catch (error) {
            console.error('[PRESENCE][pubsub message invalid]', error.message);
        }
    });

    io = new Server(server, {
        // WebRTC SDP is capped at 64 KiB by payload validation; 256 KiB leaves
        // room for protocol/event overhead while bounding unauthenticated frames.
        maxHttpBufferSize: 256 * 1024,
        allowRequest(request, callback) {
            allowSocketHandshake(request)
                .then((allowed) => callback(null, allowed))
                .catch(() => callback(null, false));
        },
        cors: {
            origin(origin, callback) {
                if (!origin || allowedOrigins.has(origin)) {
                    return callback(null, true);
                }
                return callback(new Error('Origin not allowed by Socket.IO CORS'));
            },
            credentials: true
        }
    });

    io.use(async (socket, next) => {
        try {
            const accessToken = socket.handshake.auth?.accessToken;
            if (!accessToken) return next(new Error('Không có Access Token'));

            const decoded = jwt.verify(accessToken, process.env.JWT_SECRET, {
                issuer: 'student-management-api',
                audience: 'student-management-client',
                algorithms: ['HS256']
            });

            if (!decoded.sub || !decoded.sessionId) {
                return next(new Error('Access Token thiếu Session ID'));
            }

            if (!await isAccessTokenActive(accessToken, decoded.sub)) {
                return next(new Error('Access Token đã bị thu hồi hoặc không còn hợp lệ'));
            }

            const session = await authRepository.findSessionByIdAndUserId(
                decoded.sessionId,
                decoded.sub
            );

            if (!session || session.revoked_at !== null) {
                return next(new Error('Session không tồn tại hoặc đã bị thu hồi'));
            }

            const currentUser = await authRepository.findUserById(decoded.sub);
            if (!currentUser || !currentUser.is_active) {
                return next(new Error('Tài khoản không tồn tại hoặc đã bị khóa'));
            }

            await authRepository.updateSessionLastUsed(decoded.sessionId);

            socket.user = {
                id: Number(currentUser.id),
                username: currentUser.username,
                role: currentUser.role,
                sessionId: decoded.sessionId
            };

            next();
        } catch (error) {
            console.error('Socket authentication error:', error.message);
            next(new Error('Access Token không hợp lệ'));
        }
    });

    io.on('connection', async (socket) => {
        // Normalize client event payloads centrally. Do not wrap Socket.IO's
        // reserved lifecycle events: their first argument is often a string
        // (for example, the disconnect reason), not an application payload.
        // Preserve the listener receiver and all trailing arguments/ACKs.
        const registerClientEvent = socket.on.bind(socket);
        const reservedSocketEvents = new Set([
            'connect',
            'connect_error',
            'disconnect',
            'disconnecting',
            'error',
            'newListener',
            'removeListener'
        ]);
        socket.on = (eventName, listener) => registerClientEvent(
            eventName,
            reservedSocketEvents.has(eventName)
                ? listener
                : wrapSocketEventListener(listener)
        );

        const userId = Number(socket.user.id);
        const sessionId = socket.user.sessionId;

        // Limits are shared by every tab/socket for this account and backend
        // instance through Redis. Redis failure is fail-closed for protected events.
        const allowRealtimeEvent = async (eventName) => {
            try {
                const result = await consumeSocketRateLimit({
                    userId,
                    eventName,
                    ...SOCKET_EVENT_LIMITS[eventName]
                });
                if (result.allowed) return true;

                socket.emit('socket:rate-limit', {
                    event: eventName,
                    retryAfterMs: result.retryAfterMs
                });
                return false;
            } catch (error) {
                console.error('[SOCKET][rate-limit unavailable]', {
                    event: eventName,
                    userId,
                    message: error.message
                });
                socket.emit('socket:error', {
                    code: 'REALTIME_TEMPORARILY_UNAVAILABLE',
                    message: 'Dịch vụ realtime đang tạm thời không khả dụng'
                });
                return false;
            }
        };

        // Socket authentication is checked only when the connection is
        // established. Schedule a hard disconnect at JWT expiry so an
        // expired access token can never keep using realtime events.
        let tokenExpiryTimer = null;

        const scheduleTokenExpiry = (accessToken) => {
            if (tokenExpiryTimer) clearTimeout(tokenExpiryTimer);

            const tokenExpiresAt = Number(jwt.decode(accessToken)?.exp || 0);
            const tokenLifetimeMs = tokenExpiresAt > 0
                ? Math.max(tokenExpiresAt * 1000 - Date.now(), 0)
                : 0;

            tokenExpiryTimer = tokenLifetimeMs > 0
                ? setTimeout(() => {
                    socket.disconnect(true);
                }, tokenLifetimeMs)
                : null;
        };

        scheduleTokenExpiry(socket.handshake.auth?.accessToken);

        socket.once('disconnect', () => {
            if (tokenExpiryTimer) {
                clearTimeout(tokenExpiryTimer);
                tokenExpiryTimer = null;
            }
        });

        // Refresh the authenticated token in-place so an access-token expiry
        // does not forcibly drop signaling in the middle of an active call.
        socket.on('auth:token-refresh', async ({ accessToken } = {}, acknowledge) => {
            const ack = typeof acknowledge === 'function' ? acknowledge : () => {};
            if (!await allowRealtimeEvent('auth:token-refresh')) {
                return ack({ ok: false, code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau' });
            }

            try {
                if (typeof accessToken !== 'string' || !accessToken) {
                    return ack({ ok: false, message: 'Thiếu Access Token mới' });
                }

                const decoded = jwt.verify(accessToken, process.env.JWT_SECRET, {
                    issuer: 'student-management-api',
                    audience: 'student-management-client',
                    algorithms: ['HS256']
                });

                if (
                    Number(decoded.sub) !== userId ||
                    String(decoded.sessionId) !== String(sessionId)
                ) {
                    return ack({ ok: false, message: 'Token mới không thuộc phiên Socket hiện tại' });
                }

                if (!await isAccessTokenActive(accessToken, decoded.sub)) {
                    return ack({ ok: false, message: 'Access Token đã bị thu hồi hoặc không còn hợp lệ' });
                }

                const session = await authRepository.findSessionByIdAndUserId(
                    decoded.sessionId,
                    decoded.sub
                );

                if (!session || session.revoked_at !== null) {
                    return ack({ ok: false, message: 'Session không tồn tại hoặc đã bị thu hồi' });
                }

                const currentUser = await authRepository.findUserById(decoded.sub);
                if (!currentUser || !currentUser.is_active) {
                    return ack({ ok: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa' });
                }

                socket.user = {
                    ...socket.user,
                    username: currentUser.username,
                    role: currentUser.role
                };

                await authRepository.updateSessionLastUsed(decoded.sessionId);
                socket.handshake.auth = {
                    ...socket.handshake.auth,
                    accessToken
                };
                scheduleTokenExpiry(accessToken);

                ack({ ok: true });
            } catch (error) {
                console.warn('[SOCKET][token refresh rejected]', error.message);
                ack({ ok: false, message: 'Access Token mới không hợp lệ' });
            }
        });

        socket.join(`session:${sessionId}`);
        socket.join(`user:${userId}`);

        // E2EE relay subscriptions are device-scoped, not just user-scoped.
        // A socket can subscribe only to a numeric device slot owned by the
        // authenticated account. On reconnect the client must pull its durable
        // mailbox; this room is only a wake-up signal and never carries plaintext.
        socket.on('e2ee:subscribe', async ({ deviceId, deviceToken } = {}, acknowledge) => {
            const ack = typeof acknowledge === 'function' ? acknowledge : () => {};
            if (!await allowRealtimeEvent('e2ee:subscribe')) {
                return ack({ ok: false, code: 'RATE_LIMITED' });
            }
            try {
                const slot = Number(deviceId);
                if (!Number.isSafeInteger(slot) || slot < 1 || slot > 5) {
                    return ack({ ok: false, code: 'INVALID_DEVICE_ID' });
                }
                const relayDevice = await require('../../repository/e2eeRelayRepository')
                    .authenticateDeviceCredential(userId, slot, deviceToken);
                if (!relayDevice) return ack({ ok: false, code: 'DEVICE_AUTH_FAILED' });
                socket.join(`e2ee-device:${userId}:${slot}`);
                ack({ ok: true, deviceId: slot });
            } catch (error) {
                console.warn('[E2EE][subscribe] rejected', { code: error.code || 'SUBSCRIBE_FAILED' });
                ack({ ok: false, code: error.code || 'SUBSCRIBE_FAILED' });
            }
        });

        socket.on('e2ee:unsubscribe', ({ deviceId } = {}, acknowledge) => {
            const ack = typeof acknowledge === 'function' ? acknowledge : () => {};
            const slot = Number(deviceId);
            if (!Number.isSafeInteger(slot) || slot < 1 || slot > 5) {
                return ack({ ok: false, code: 'INVALID_DEVICE_ID' });
            }
            socket.leave(`e2ee-device:${userId}:${slot}`);
            ack({ ok: true });
        });

        // Một user có thể mở nhiều tab/device. Chỉ khi socket đầu tiên kết nối
        // mới chuyển trạng thái offline -> online.
        let userSockets = onlineUsers.get(userId);
        const wasOffline = !userSockets || userSockets.size === 0;

        if (!userSockets) {
            userSockets = new Set();
            onlineUsers.set(userId, userSockets);
        }

        userSockets.add(socket.id);
        let sharedPresenceCount = 0;
        try {
            sharedPresenceCount = await refreshSharedPresence(userId, socket.id);
        } catch (error) {
            console.error('[PRESENCE][redis register failed]', { userId, message: error.message });
            socket.disconnect(true);
            return;
        }

        // Token refresh/reconnect can briefly remove the last socket.
        const pendingDisconnectTimer = disconnectGraceTimers.get(userId);
        if (pendingDisconnectTimer) {
            clearTimeout(pendingDisconnectTimer);
            disconnectGraceTimers.delete(userId);
                    }

        if (sharedPresenceCount === 1) {
            try {
                const contactIds = await conversationRepository.getConversationContactIds(userId);
                await publishRealtimeEvent('presence:online', {
                    userId,
                    recipientIds: contactIds,
                    emittedAt: new Date().toISOString()
                });
            } catch (error) {
                console.error('PRESENCE ONLINE ERROR:', error);
            }
        }

        // Gửi snapshot presence cho client vừa kết nối.
        try {
            const contactIds = await conversationRepository.getConversationContactIds(userId);
        const onlineContactIds = await getSharedOnlineUserIds(contactIds);
            socket.emit('presence:snapshot', { userIds: onlineContactIds });
        } catch (error) {
            console.error('PRESENCE SNAPSHOT ERROR:', error);
        }

        const syncPendingCalls = async () => {
            try {
                const expiredCalls = await callRepository.expireDueRingingCalls();
                for (const expired of expiredCalls) {
                    emitCallActivityUpdated(expired);
                    clearCallTimer(expired.call_id);
                    io.to(`user:${Number(expired.receiver_id)}`).emit('call:ended', {
                        callId: expired.call_id,
                        fromUserId: Number(expired.caller_id),
                        toUserId: Number(expired.receiver_id),
                        reason: 'ring-timeout',
                        status: 'missed'
                    });
                    io.to(`user:${Number(expired.caller_id)}`).emit('call:timeout', {
                        callId: expired.call_id,
                        status: 'missed',
                        reason: 'ring-timeout'
                    });
                    await emitCallNotification(
                        Number(expired.receiver_id),
                        expired,
                        'missed-call',
                        'Cuộc gọi nhỡ',
                        `Bạn có cuộc gọi ${expired.call_type === 'video' ? 'video' : 'thoại'} nhỡ.`
                    );
                }

                const pendingCalls = await callRepository.getPendingIncomingCalls(userId);
                const serverNow = new Date().toISOString();
                for (const pending of pendingCalls) {
                    socket.emit('call:incoming', {
                        callId: pending.call_id,
                        fromUserId: Number(pending.caller_id),
                        fromUsername: pending.caller_username,
                        fromAvatar: pending.caller_avatar || null,
                        toUserId: Number(pending.receiver_id),
                        callType: pending.call_type,
                        expiresAt: pending.expires_at,
                        serverNow,
                        replayed: true
                    });
                }
            } catch (error) {
                console.error('[CALL][sync pending failed]', error);
            }
        };

        socket.on('call:sync-pending', async () => {
            if (!await allowRealtimeEvent('call:sync-pending')) return;
            await syncPendingCalls();
        });
        // Replay pending invitations after every authenticated reconnect.
        void syncPendingCalls();

        socket.on('presence:heartbeat', async () => {
            try {
                await refreshSharedPresence(userId, socket.id);
            } catch (error) {
                console.error('[PRESENCE][heartbeat failed]', { userId, message: error.message });
                socket.emit('socket:error', {
                    code: 'PRESENCE_TEMPORARILY_UNAVAILABLE',
                    message: 'Không thể cập nhật trạng thái hoạt động lúc này'
                });
            }
        });

        socket.on('presence:sync', async () => {
            if (!await allowRealtimeEvent('presence:sync')) return;
            try {
                const contactIds = await conversationRepository.getConversationContactIds(userId);
                const onlineContactIds = await getSharedOnlineUserIds(contactIds);
                socket.emit('presence:snapshot', { userIds: onlineContactIds });
            } catch (error) {
                console.error('PRESENCE SYNC ERROR:', error);
            }
        });

        socket.on('conversation:join', async (payload = {}) => {
            const { conversationId } = payload && typeof payload === 'object' ? payload : {};
            if (!await allowRealtimeEvent('conversation:join')) return;
            const id = Number(conversationId);
            if (!Number.isInteger(id) || id <= 0) {
                return socket.emit('conversation:error', { message: 'conversationId không hợp lệ' });
            }

            try {
                const isMember = await conversationRepository.isConversationMember(id, userId);
                if (!isMember) {
                    return socket.emit('conversation:error', {
                        code: 'NOT_MEMBER',
                        conversationId: id,
                        message: 'Bạn không còn quyền truy cập nhóm này'
                    });
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

        socket.on('conversation:leave', (payload = {}) => {
            const { conversationId } = payload && typeof payload === 'object' ? payload : {};
            const id = Number(conversationId);
            if (Number.isInteger(id) && id > 0) socket.leave(`conversation:${id}`);
        });

        socket.on('message:send', async (payload = {}) => {
            const { conversationId, content, replyToMessageId = null } = payload && typeof payload === 'object' ? payload : {};
            if (!await allowRealtimeEvent('message:send')) return;
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

                // Fail closed: an E2EE conversation must not accept plaintext via
                // the legacy Socket.IO event.
                if (await e2eeRepository.isConversationE2EEEnabled(id)) {
                    return socket.emit('message:error', {
                        code: 'E2EE_REQUIRED',
                        message: 'Cuộc trò chuyện đã bật E2EE; cần gửi ciphertext qua luồng mã hóa.'
                    });
                }

                let replyTo = null;
                if (replyToMessageId !== null && replyToMessageId !== undefined) {
                    replyTo = Number(replyToMessageId);
                    if (!Number.isInteger(replyTo) || replyTo <= 0) {
                        return socket.emit('message:error', { message: 'replyToMessageId không hợp lệ' });
                    }

                    const repliedMessage = await messageRepository.getMessageById(replyTo);
                    if (!repliedMessage || Number(repliedMessage.conversation_id) !== id) {
                        return socket.emit('message:error', { message: 'Message reply không thuộc conversation này' });
                    }
                }

                const savedMessage = await messageService.createMessage(id, userId, text, replyTo);
                const memberIds = await conversationRepository.getConversationMemberIds(id);

                // Gửi cho các client khác trong conversation và luôn gửi lại cho sender.
                // Không phụ thuộc việc sender đã kịp join room hay chưa.
                socket.to(`conversation:${id}`).emit('message:new', savedMessage);
                socket.emit('message:new', savedMessage);

                for (const memberId of memberIds) {
                    io.to(`user:${memberId}`).emit('conversation:updated', {
                        conversationId: id,
                        lastMessage: savedMessage,
                        senderId: userId,
                        updatedAt: savedMessage.created_at
                    });
                }

                // Persist a separate notification for each recipient. Delivery failures
                // must not roll back or fail the successfully-saved chat message.
                try {
                    await notificationDeliveryService.notifyMessageRecipients({
                        io, conversationId: id, senderId: userId,
                        senderName: socket.user.username, message: savedMessage
                    });
                } catch (notificationError) {
                    console.error('[NOTIFICATION] realtime delivery failed:', notificationError.message);
                }

                socket.emit('message:sent', { message: savedMessage });
            } catch (error) {
                console.error('SEND MESSAGE ERROR:', error);
                socket.emit('message:error', { message: 'Không thể gửi tin nhắn' });
            }
        });

        socket.on('message:edit', async ({ messageId, content }) => {
            if (!await allowRealtimeEvent('message:edit')) return;
            const id = Number(messageId);
            const text = typeof content === 'string' ? content.trim() : '';

            if (!Number.isInteger(id) || id <= 0) {
                return socket.emit('message:error', { message: 'messageId không hợp lệ' });
            }

            if (!text) {
                return socket.emit('message:error', {
                    message: 'Nội dung message không được để trống'
                });
            }

            try {
                const message = await messageRepository.getMessageById(id);

                if (!message) {
                    return socket.emit('message:error', {
                        message: 'Message không tồn tại'
                    });
                }

                const isMember =
                    await conversationRepository.isConversationMember(
                        message.conversation_id,
                        userId
                    );

                if (!isMember) {
                    return socket.emit('message:error', {
                        message: 'Bạn không thuộc conversation này'
                    });
                }

                if (String(message.sender_id) !== String(userId)) {
                    return socket.emit('message:error', {
                        message: 'Bạn chỉ có thể sửa message do chính mình gửi'
                    });
                }

                if (message.is_recalled) {
                    return socket.emit('message:error', {
                        message: 'Message đã được thu hồi và không thể chỉnh sửa'
                    });
                }

                if (message.deleted_at) {
                    return socket.emit('message:error', {
                        message: 'Message đã bị xoá và không thể chỉnh sửa'
                    });
                }

                const updatedMessage =
                    await messageRepository.updateMessageContent(id, userId, text);

                if (!updatedMessage) {
                    return socket.emit('message:error', {
                        message: 'Không thể chỉnh sửa message'
                    });
                }

                io.to(`conversation:${message.conversation_id}`).emit(
                    'message:updated',
                    updatedMessage
                );

                socket.emit('message:edit:sent', {
                    message: updatedMessage
                });
            } catch (error) {
                console.error('EDIT MESSAGE SOCKET ERROR:', error);
                socket.emit('message:error', {
                    message: 'Không thể chỉnh sửa message'
                });
            }
        });

        socket.on('message:recall', async ({ messageId }) => {
            if (!await allowRealtimeEvent('message:recall')) return;
            const id = Number(messageId);

            if (!Number.isInteger(id) || id <= 0) {
                return socket.emit('message:error', { message: 'messageId không hợp lệ' });
            }

            try {
                const message = await messageRepository.getMessageById(id);

                if (!message) {
                    return socket.emit('message:error', { message: 'Message không tồn tại' });
                }

                const isMember = await conversationRepository.isConversationMember(
                    message.conversation_id,
                    userId
                );

                if (!isMember) {
                    return socket.emit('message:error', {
                        message: 'Bạn không thuộc conversation này'
                    });
                }

                if (String(message.sender_id) !== String(userId)) {
                    return socket.emit('message:error', {
                        message: 'Bạn chỉ có thể thu hồi message do chính mình gửi'
                    });
                }

                if (message.is_recalled) {
                    return socket.emit('message:error', {
                        message: 'Message đã được thu hồi'
                    });
                }

                if (message.deleted_at) {
                    return socket.emit('message:error', {
                        message: 'Message đã bị xoá và không thể thu hồi'
                    });
                }

                const recalledMessage = await messageRepository.recallMessage(id, userId);

                if (!recalledMessage) {
                    return socket.emit('message:error', {
                        message: 'Không thể thu hồi message'
                    });
                }

                io.to(`conversation:${message.conversation_id}`).emit(
                    'message:recalled',
                    recalledMessage
                );

                socket.emit('message:recall:sent', {
                    message: recalledMessage
                });
            } catch (error) {
                console.error('RECALL MESSAGE SOCKET ERROR:', error);
                socket.emit('message:error', {
                    message: 'Không thể thu hồi message'
                });
            }
        });

        socket.on('message:delete:me', async ({ messageId }) => {
            if (!await allowRealtimeEvent('message:delete:me')) return;
            const id = Number(messageId);

            if (!Number.isInteger(id) || id <= 0) {
                return socket.emit('message:error', { message: 'messageId không hợp lệ' });
            }

            try {
                const message = await messageRepository.getMessageById(id);

                if (!message) {
                    return socket.emit('message:error', { message: 'Message không tồn tại' });
                }

                const isMember = await conversationRepository.isConversationMember(
                    message.conversation_id,
                    userId
                );

                if (!isMember) {
                    return socket.emit('message:error', {
                        message: 'Bạn không thuộc conversation này'
                    });
                }

                const deleted = await messageRepository.deleteMessageForMe(id, userId);

                io.to(socket.id).emit('message:deleted:me', {
                    messageId: id,
                    conversationId: message.conversation_id,
                    deletion: deleted
                });

                socket.emit('message:delete:me:sent', {
                    messageId: id,
                    conversationId: message.conversation_id,
                    deletion: deleted
                });
            } catch (error) {
                console.error('DELETE MESSAGE FOR ME SOCKET ERROR:', error);
                socket.emit('message:error', {
                    message: 'Không thể xoá message cho bạn'
                });
            }
        });

        socket.on('message:delete:everyone', async ({ messageId }) => {
            if (!await allowRealtimeEvent('message:delete:everyone')) return;
            const id = Number(messageId);

            if (!Number.isInteger(id) || id <= 0) {
                return socket.emit('message:error', { message: 'messageId không hợp lệ' });
            }

            try {
                const message = await messageRepository.getMessageById(id);

                if (!message) {
                    return socket.emit('message:error', { message: 'Message không tồn tại' });
                }

                const isMember = await conversationRepository.isConversationMember(
                    message.conversation_id,
                    userId
                );

                if (!isMember) {
                    return socket.emit('message:error', {
                        message: 'Bạn không thuộc conversation này'
                    });
                }

                if (String(message.sender_id) !== String(userId)) {
                    return socket.emit('message:error', {
                        message: 'Bạn chỉ có thể xoá message do chính mình gửi cho tất cả'
                    });
                }

                if (message.is_recalled || message.deleted_at) {
                    return socket.emit('message:error', {
                        message: 'Message không còn ở trạng thái có thể xoá cho tất cả'
                    });
                }

                const deletedMessage =
                    await messageRepository.deleteMessageForEveryone(id, userId);

                if (!deletedMessage) {
                    return socket.emit('message:error', {
                        message: 'Không thể xoá message cho tất cả'
                    });
                }

                io.to(`conversation:${message.conversation_id}`).emit(
                    'message:deleted:everyone',
                    deletedMessage
                );

                socket.emit('message:delete:everyone:sent', {
                    message: deletedMessage
                });
            } catch (error) {
                console.error('DELETE MESSAGE EVERYONE SOCKET ERROR:', error);
                socket.emit('message:error', {
                    message: 'Không thể xoá message cho tất cả'
                });
            }
        });

        socket.on('message:reaction:add', async ({ messageId, emoji }) => {
            if (!await allowRealtimeEvent('message:reaction:add')) return;
            const id = Number(messageId);
            const value = typeof emoji === 'string' ? emoji.trim() : '';

            if (!Number.isInteger(id) || id <= 0 || !value || value.length > 32) {
                return socket.emit('message:error', { message: 'Reaction không hợp lệ' });
            }

            try {
                const message = await messageRepository.getMessageById(id);
                if (!message) return socket.emit('message:error', { message: 'Message không tồn tại' });

                if (!await conversationRepository.isConversationMember(message.conversation_id, userId)) {
                    return socket.emit('message:error', { message: 'Bạn không thuộc conversation này' });
                }

                if (message.is_recalled || message.deleted_at) {
                    return socket.emit('message:error', {
                        message: 'Không thể reaction vào message đã thu hồi hoặc xoá'
                    });
                }

                const reaction = await messageRepository.addReaction(id, userId, value);
                io.to(`conversation:${message.conversation_id}`).emit('message:reaction:updated', {
                    messageId: id,
                    conversationId: message.conversation_id,
                    action: 'add',
                    reaction
                });
            } catch (error) {
                console.error('REACTION ADD ERROR:', error);
                socket.emit('message:error', { message: 'Không thể thêm reaction' });
            }
        });

        socket.on('message:reaction:remove', async ({ messageId, emoji }) => {
            if (!await allowRealtimeEvent('message:reaction:remove')) return;
            const id = Number(messageId);
            const value = typeof emoji === 'string' ? emoji.trim() : '';

            if (!Number.isInteger(id) || id <= 0 || !value || value.length > 32) {
                return socket.emit('message:error', { message: 'Reaction không hợp lệ' });
            }

            try {
                const message = await messageRepository.getMessageById(id);
                if (!message) return socket.emit('message:error', { message: 'Message không tồn tại' });

                if (!await conversationRepository.isConversationMember(message.conversation_id, userId)) {
                    return socket.emit('message:error', { message: 'Bạn không thuộc conversation này' });
                }

                const reaction = await messageRepository.removeReaction(id, userId, value);
                io.to(`conversation:${message.conversation_id}`).emit('message:reaction:updated', {
                    messageId: id,
                    conversationId: message.conversation_id,
                    action: 'remove',
                    reaction: reaction || {
                        message_id: id,
                        user_id: userId,
                        emoji: value
                    }
                });
            } catch (error) {
                console.error('REACTION REMOVE ERROR:', error);
                socket.emit('message:error', { message: 'Không thể xoá reaction' });
            }
        });

        socket.on('message:read', async ({ conversationId }) => {
            if (!await allowRealtimeEvent('message:read')) return;
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
            if (!await allowRealtimeEvent('typing:start')) return;
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
            if (!await allowRealtimeEvent('typing:stop')) return;
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

        const CALL_RING_TIMEOUT_MS = 30_000;
        const CALL_CONNECT_TIMEOUT_MS = 12_000;
        const canCallUser = async (targetId) => {
            if (!Number.isInteger(targetId) || targetId <= 0 || targetId === userId) return false;
            try {
                const contactIds = await conversationRepository.getConversationContactIds(userId);
                if (!contactIds.map(Number).includes(targetId)) return false;
                if (await conversationRepository.isUserBlocked(userId, targetId)) return false;
                return true;
            } catch (error) {
                console.error('CALL PERMISSION ERROR:', error);
                return false;
            }
        };

        const clearCallTimer = callId => {
            const timer = callTimers.get(callId);
            if (timer) clearTimeout(timer);
            callTimers.delete(callId);
        };

        const getAuthorizedCall = async (callId, targetId) => {
            if (!isValidCallId(callId) || !Number.isInteger(targetId) || targetId <= 0 || targetId === userId) {
                return null;
            }

            // Once a call record exists, authorization is based on the immutable
            // caller/receiver relationship stored on that call. Do not run
            // canCallUser() again for offer/answer/ICE/connected/end.
            return callRepository.getCallByIdForParticipant(
                callId,
                userId,
                targetId
            );
        };

        const emitCallNotification = async (userIdToNotify, call, type, title, body) => {
            try {
                const notification = await callRepository.createCallNotification(
                    userIdToNotify,
                    call.id,
                    type,
                    title,
                    body
                );
                io.to(`user:${userIdToNotify}`).emit('call:notification', notification);
            } catch (error) {
                console.error('CALL NOTIFICATION ERROR:', error);
            }
        };

        // Notify both participants when a call becomes a final timeline activity.
        // The conversation API derives the preview from persisted messages and call history.
        const emitCallActivityUpdated = (call) => {
            if (!call?.conversation_id || !call?.call_id) return;
            const payload = {
                callId: call.call_id,
                conversationId: Number(call.conversation_id),
                callerId: Number(call.caller_id),
                receiverId: Number(call.receiver_id),
                status: call.status,
                activityAt: call.ended_at || call.updated_at || call.started_at || null
            };
            io.to(`user:${payload.callerId}`).emit('call:activity:updated', payload);
            io.to(`user:${payload.receiverId}`).emit('call:activity:updated', payload);
            io.to(`conversation:${payload.conversationId}`).emit('call:activity:updated', payload);
        };

        socket.on('call:start', async ({ callId, targetUserId, callType = 'voice' } = {}) => {
            if (!await allowRealtimeEvent('call:start')) return;
            const targetId = Number(targetUserId);
            const validCallId = isValidCallId(callId);

            
            // Socket payloads are untrusted. Bound the identifier before it
            // reaches SQL/logging and reject malformed call requests early.
            if (!validCallId || !isValidCallType(callType) || !(await canCallUser(targetId))) {
                return socket.emit('call:error', {
                    callId,
                    code: 'CALL_NOT_ALLOWED',
                    message: 'Bạn không được phép gọi người dùng này'
                });
            }

            const conversation = await conversationRepository.findDirectConversation(userId, targetId);
            const call = await callRepository.createCall({
                callId,
                callerId: userId,
                receiverId: targetId,
                conversationId: conversation?.id || null,
                callType
            });

            if (!call) {
                return socket.emit('call:error', {
                    callId,
                    message: 'Không thể tạo cuộc gọi'
                });
            }

            // Keep the caller's ringing window even when the receiver is offline.
            // Offline users cannot receive the incoming-call event, but the call is
            // still recorded as ringing until the shared timeout marks it missed.
            if (onlineUsers.has(targetId)) {
                const callerProfile = await userRepository.findActiveUserById(userId);
                io.to(`user:${targetId}`).emit('call:incoming', {
                    callId,
                    fromUserId: userId,
                    fromUsername: socket.user.username,
                    fromAvatar: callerProfile?.avatar || null,
                    toUserId: targetId,
                    callType,
                    expiresAt: call.expires_at,
                    serverNow: new Date().toISOString(),
                    replayed: false
                });
            } else {
                            }

            callTimers.set(callId, setTimeout(async () => {
                try {
                    const expiredCalls = await callRepository.expireDueRingingCalls();
                    for (const expired of expiredCalls) {
                        emitCallActivityUpdated(expired);
                        clearCallTimer(expired.call_id);
                        io.to(`user:${Number(expired.receiver_id)}`).emit('call:ended', {
                            callId: expired.call_id,
                            fromUserId: Number(expired.caller_id),
                            toUserId: Number(expired.receiver_id),
                            reason: 'ring-timeout',
                            status: 'missed'
                        });
                        io.to(`user:${Number(expired.caller_id)}`).emit('call:timeout', {
                            callId: expired.call_id, status: 'missed', reason: 'ring-timeout'
                        });
                        await emitCallNotification(
                            Number(expired.receiver_id),
                            expired,
                            'missed-call',
                            'Cuộc gọi nhỡ',
                            `Bạn có cuộc gọi ${expired.call_type === 'video' ? 'video' : 'thoại'} nhỡ.`
                        );
                    }
                } catch (error) {
                    console.error('CALL RING TIMEOUT ERROR:', error);
                } finally {
                    clearCallTimer(callId);
                }
            }, CALL_RING_TIMEOUT_MS));
        });

        socket.on('call:accept', async ({ callId, targetUserId } = {}) => {
            if (!await allowRealtimeEvent('call:accept')) return;
            const targetId = Number(targetUserId);
            if (!isValidCallId(callId) || !Number.isInteger(targetId) || targetId <= 0 || targetId === userId) {
                return socket.emit('call:error', {
                    callId,
                    code: 'CALL_NOT_AVAILABLE',
                    message: 'Cuộc gọi không còn khả dụng.'
                });
            }
            
            // The call was already authorized and created by call:start.
            // For accept, authorize by the call record itself instead of
            // re-running the current relationship/block check. Otherwise a
            // valid ringing call can become CALL_NOT_AVAILABLE because the
            // contact/block state changed between start and accept.
            const currentCall = await callRepository.getCallByIdForParticipant(
                callId,
                userId,
                targetId
            );

            if (!currentCall) {
                console.warn('[CALL][accept rejected] call not found/participant mismatch', {
                    callId,
                    userId,
                    targetId
                });
                return socket.emit('call:error', {
                    callId,
                    code: 'CALL_NOT_AVAILABLE',
                    message: 'Cuộc gọi không còn khả dụng.'
                });
            }

            if (
                Number(currentCall.receiver_id) !== userId ||
                Number(currentCall.caller_id) !== targetId ||
                currentCall.status !== 'ringing' ||
                currentCall.ended_at
            ) {
                console.warn('[CALL][accept rejected] invalid state', {
                    callId,
                    userId,
                    targetId,
                    dbStatus: currentCall.status,
                    callerId: currentCall.caller_id,
                    receiverId: currentCall.receiver_id,
                    endedAt: currentCall.ended_at
                });
                return socket.emit('call:error', {
                    callId,
                    code: 'CALL_NOT_AVAILABLE',
                    message: 'Cuộc gọi không còn khả dụng.'
                });
            }

            const updated = await callRepository.acceptRingingCallBeforeDeadline(callId);
            if (!updated) {
                // The DB deadline/status is authoritative. If it has elapsed,
                // finalize it as missed instead of trusting a client countdown.
                const expiredCalls = await callRepository.expireDueRingingCalls();
                for (const expired of expiredCalls) {
                    emitCallActivityUpdated(expired);
                    clearCallTimer(expired.call_id);
                    io.to(`user:${Number(expired.receiver_id)}`).emit('call:ended', {
                        callId: expired.call_id,
                        fromUserId: Number(expired.caller_id),
                        toUserId: Number(expired.receiver_id),
                        reason: 'ring-timeout',
                        status: 'missed'
                    });
                    io.to(`user:${Number(expired.caller_id)}`).emit('call:timeout', {
                        callId: expired.call_id, status: 'missed', reason: 'ring-timeout'
                    });
                    await emitCallNotification(
                        Number(expired.receiver_id), expired, 'missed-call',
                        'Cuộc gọi nhỡ',
                        `Bạn có cuộc gọi ${expired.call_type === 'video' ? 'video' : 'thoại'} nhỡ.`
                    );
                }
                return socket.emit('call:error', {
                    callId,
                    code: 'CALL_EXPIRED',
                    message: 'Lời mời gọi đã hết hạn.'
                });
            }
            clearCallTimer(callId);
            io.to(`user:${targetId}`).emit('call:accepted', {
                callId, fromUserId: userId, toUserId: targetId, callType: currentCall.call_type
            });

            callTimers.set(callId, setTimeout(async () => {
                try {
                    const failed = await callRepository.updateCallStatusIfCurrent(
                        callId,
                        'failed',
                        'connecting',
                        'connection-timeout'
                    );
                    if (failed) {
                        emitCallActivityUpdated(failed);
                        io.to(`user:${targetId}`).emit('call:ended', {
                            callId, fromUserId: userId, toUserId: targetId, reason: 'connection-timeout'
                        });
                        io.to(`user:${userId}`).emit('call:timeout', {
                            callId, status: 'failed', reason: 'connection-timeout'
                        });
                    }
                } catch (error) {
                    console.error('CALL CONNECT TIMEOUT ERROR:', error);
                } finally {
                    clearCallTimer(callId);
                }
            }, CALL_CONNECT_TIMEOUT_MS));
        });

        socket.on('call:reject', async ({ callId, targetUserId } = {}) => {
            if (!await allowRealtimeEvent('call:reject')) return;
            const targetId = Number(targetUserId);
            const currentCall = await getAuthorizedCall(callId, targetId);
            if (!currentCall || Number(currentCall.receiver_id) !== userId || currentCall.status !== 'ringing') return;
            clearCallTimer(callId);
            const updated = await callRepository.updateCallStatusIfCurrent(
                callId,
                'rejected',
                'ringing',
                'rejected'
            );

            // Only notify rejection if this socket actually won the DB state
            // transition. Otherwise accept/end may have won the race.
            if (!updated) return;

            emitCallActivityUpdated(updated);
            io.to(`user:${targetId}`).emit('call:rejected', {
                callId, fromUserId: userId, toUserId: targetId, reason: 'rejected'
            });
            await emitCallNotification(
                targetId,
                updated,
                'call-rejected',
                'Cuộc gọi bị từ chối',
                'Cuộc gọi của bạn đã bị từ chối.'
            );
        });

        socket.on('call:offer', async ({ callId, targetUserId, offer }) => {
            if (!await allowRealtimeEvent('call:offer')) return;
            const targetId = Number(targetUserId);
                        const call = await getAuthorizedCall(callId, targetId);
            if (!call || !['connecting', 'connected'].includes(call.status)) return;
            if (!isValidSessionDescription(offer, 'offer')) {
                return socket.emit('call:error', {
                    callId,
                    code: 'INVALID_SIGNALING_PAYLOAD',
                    message: 'Dữ liệu WebRTC offer không hợp lệ hoặc vượt quá giới hạn.'
                });
            }
            io.to(`user:${targetId}`).emit('call:offer', {
                callId, fromUserId: userId, toUserId: targetId, offer
            });
        });

        socket.on('call:answer', async ({ callId, targetUserId, answer }) => {
            if (!await allowRealtimeEvent('call:answer')) return;
            const targetId = Number(targetUserId);
                        const call = await getAuthorizedCall(callId, targetId);
            if (!call || !['connecting', 'connected'].includes(call.status)) return;
            if (!isValidSessionDescription(answer, 'answer')) {
                return socket.emit('call:error', {
                    callId,
                    code: 'INVALID_SIGNALING_PAYLOAD',
                    message: 'Dữ liệu WebRTC answer không hợp lệ hoặc vượt quá giới hạn.'
                });
            }
            io.to(`user:${targetId}`).emit('call:answer', {
                callId, fromUserId: userId, toUserId: targetId, answer
            });
        });

        socket.on('call:reconnect-request', async ({ callId, targetUserId }) => {
            if (!await allowRealtimeEvent('call:reconnect-request')) return;
            const targetId = Number(targetUserId);
            const currentCall = await getAuthorizedCall(callId, targetId);
            if (!currentCall || !currentCall.answered_at || ['rejected', 'missed', 'cancelled', 'failed', 'timeout'].includes(currentCall.status)) return;

            io.to(`user:${targetId}`).emit('call:reconnect-request', {
                callId,
                fromUserId: userId,
                toUserId: targetId
            });
        });

        socket.on('call:connected', async ({ callId, targetUserId }) => {
            if (!await allowRealtimeEvent('call:connected')) return;
            const targetId = Number(targetUserId);
            const call = await getAuthorizedCall(callId, targetId);
            if (!call) {
                return socket.emit('call:error', {
                    callId,
                    code: 'CALL_NOT_FOUND',
                    message: 'Cuộc gọi không tồn tại hoặc bạn không có quyền.'
                });
            }

            // Persist the transition atomically. A stale client event must
            // never move a terminal call back to "connected".
            const connectedCall =
                await callRepository.markCallConnectedIfConnecting(callId);

            if (!connectedCall) {
                console.warn('[CALL][connected ignored] call is no longer connecting', {
                    callId,
                    userId,
                    status: call.status,
                    endedAt: call.ended_at
                });
                return;
            }

            clearCallTimer(callId);
            emitCallActivityUpdated(connectedCall);

            io.to(`user:${targetId}`).emit('call:connected', {
                callId, fromUserId: userId, toUserId: targetId
            });
        });

        socket.on('call:connection-failed', async ({ callId, targetUserId, reason = 'connection-timeout' }) => {
            if (!await allowRealtimeEvent('call:connection-failed')) return;
            const targetId = Number(targetUserId);
            const currentCall = await getAuthorizedCall(callId, targetId);
            if (!currentCall || currentCall.status !== 'connecting' || currentCall.ended_at) return;

            // Never persist or relay arbitrary client-controlled failure text.
            const safeReason = normalizeCallFailureReason(reason);
            clearCallTimer(callId);
            const failed = await callRepository.updateCallStatusIfCurrent(
                callId,
                'failed',
                'connecting',
                safeReason
            );
            if (!failed) return;
            emitCallActivityUpdated(failed);

            const payload = {
                callId,
                fromUserId: userId,
                toUserId: targetId,
                reason: safeReason,
                status: 'failed'
            };
            io.to(`user:${userId}`).emit('call:ended', payload);
            io.to(`user:${targetId}`).emit('call:ended', payload);
            console.warn('[CALL][connection failed]', { callId, userId, targetId, reason: safeReason });
        });

        socket.on('call:ice-candidate', async ({ callId, targetUserId, candidate }) => {
            if (!await allowRealtimeEvent('call:ice-candidate')) return;
            const targetId = Number(targetUserId);
                        const call = await getAuthorizedCall(callId, targetId);
            if (!call || !['connecting', 'connected'].includes(call.status)) return;
            if (!isValidIceCandidate(candidate)) {
                return socket.emit('call:error', {
                    callId,
                    code: 'INVALID_SIGNALING_PAYLOAD',
                    message: 'Dữ liệu ICE candidate không hợp lệ hoặc vượt quá giới hạn.'
                });
            }
            io.to(`user:${targetId}`).emit('call:ice-candidate', {
                callId, fromUserId: userId, toUserId: targetId, candidate
            });
        });

        socket.on('call:end', async ({ callId, targetUserId, reason = 'ended' } = {}) => {
            if (!await allowRealtimeEvent('call:end')) return;
            const targetId = Number(targetUserId);
            // Never persist arbitrary client-controlled reason strings.
            const safeReason = reason === 'cancelled' ? 'cancelled' : 'ended';
            const currentCall = await getAuthorizedCall(callId, targetId);
            if (!currentCall) {
                return socket.emit('call:error', {
                    callId,
                    code: 'CALL_NOT_FOUND',
                    message: 'Cuộc gọi không tồn tại hoặc bạn không có quyền.'
                });
            }

            clearCallTimer(callId);
            const finalStatus = safeReason === 'cancelled'
                ? 'cancelled'
                : (currentCall.answered_at ? 'completed' : 'cancelled');

            const terminalStatuses = ['completed', 'rejected', 'missed', 'cancelled', 'failed', 'timeout'];
            if (terminalStatuses.includes(currentCall.status)) {
                console.warn('[CALL][end ignored] already terminal', {
                    callId,
                    userId,
                    status: currentCall.status,
                    reason: safeReason
                });
                return;
            }

            const updated = await callRepository.updateCallStatusIfCurrent(
                callId,
                finalStatus,
                currentCall.status,
                safeReason
            );

            if (!updated) {
                console.warn('[CALL][end race] status changed before end', {
                    callId,
                    userId,
                    expectedStatus: currentCall.status
                });
                return;
            }

            emitCallActivityUpdated(updated);
            
            io.to(`user:${targetId}`).emit('call:ended', {
                callId, fromUserId: userId, toUserId: targetId, reason: safeReason
            });
            if (updated?.status === 'completed') {
                const duration = updated.duration_seconds || 0;
                await emitCallNotification(
                    targetId,
                    updated,
                    'call-ended',
                    'Cuộc gọi đã kết thúc',
                    `Thời lượng: ${duration} giây.`
                );
            }
        });

        socket.on('disconnect', async (reason) => {
            const userSockets = onlineUsers.get(userId);
            let sharedSocketCount = 0;
            let sharedPresenceAvailable = true;
            try {
                const key = presenceSocketKey(userId);
                await redisClient.sRem(key, socket.id);
                sharedSocketCount = Number(await redisClient.sCard(key));
                if (sharedSocketCount === 0) await redisClient.del(key);
            } catch (error) {
                sharedPresenceAvailable = false;
                console.error('[PRESENCE][redis unregister failed]', { userId, message: error.message });
            }

            if (userSockets) {
                userSockets.delete(socket.id);

                // Chỉ khi socket cuối cùng của user biến mất mới phát OFFLINE
                // và ghi last_seen_at.
                if (userSockets.size === 0 && sharedPresenceAvailable && sharedSocketCount === 0) {
                    onlineUsers.delete(userId);

                    let lastSeenAt = null;

                    try {
                        const presence = await userRepository.updateLastSeenAt(userId);
                        lastSeenAt = presence?.last_seen_at || null;
                    } catch (error) {
                        console.error('UPDATE LAST SEEN ERROR:', error);
                    }

                    try {
                        const contactIds = await conversationRepository.getConversationContactIds(userId);
                        await publishRealtimeEvent('presence:offline', {
                            userId,
                            lastSeenAt,
                            recipientIds: contactIds,
                            emittedAt: new Date().toISOString()
                        });
                    } catch (error) {
                        console.error('PRESENCE OFFLINE ERROR:', error);
                    }

                    // A realtime disconnect can be transient (token refresh,
                    // browser reconnect, network handoff, laptop sleep, etc.).
                    // Give the client 7 seconds to reconnect before cancelling calls.
                    const existingTimer = disconnectGraceTimers.get(userId);
                    if (existingTimer) clearTimeout(existingTimer);

                    const timer = setTimeout(async () => {
                        disconnectGraceTimers.delete(userId);

                        const currentSockets = onlineUsers.get(userId);
                        let sharedCount = 0;
                        try { sharedCount = Number(await redisClient.sCard(presenceSocketKey(userId))); } catch { /* fail safe below */ }
                        if ((currentSockets && currentSockets.size > 0) || sharedCount > 0) {
                                                        return;
                        }

                        try {
                            const activeCalls = await callRepository.getActiveCallsForParticipant(userId);

                            for (const activeCall of activeCalls) {
                                const targetId = activeCall.caller_id === userId
                                    ? activeCall.receiver_id
                                    : activeCall.caller_id;

                                const ended = await callRepository.updateCallStatusIfCurrent(
                                    activeCall.call_id,
                                    'cancelled',
                                    activeCall.status,
                                    'socket-disconnected'
                                );

                                if (ended) {
                                    emitCallActivityUpdated(ended);
                                    clearCallTimer(activeCall.call_id);
                                    io.to(`user:${targetId}`).emit('call:ended', {
                                        callId: activeCall.call_id,
                                        fromUserId: userId,
                                        toUserId: targetId,
                                        reason: 'socket-disconnected'
                                    });
                                }
                            }
                        } catch (error) {
                            console.error('ACTIVE CALL DISCONNECT CLEANUP ERROR:', error);
                        }
                    }, 7000);
                    
                    disconnectGraceTimers.set(userId, timer);
                }
            }

            console.log(`Socket disconnected: user=${userId}, socket=${socket.id}, reason=${reason}`);
        });
    });

    return io;
};

const closeSocket = async () => {
    const socketServer = io;
    const subscriber = presenceSubscriber;
    io = null;
    presenceSubscriber = null;

    for (const timer of callTimers.values()) clearTimeout(timer);
    for (const timer of disconnectGraceTimers.values()) clearTimeout(timer);
    callTimers.clear();
    disconnectGraceTimers.clear();
    onlineUsers.clear();

    if (socketServer) {
        await new Promise((resolve) => socketServer.close(resolve));
    }

    if (subscriber?.isOpen) {
        try {
            await subscriber.quit();
        } catch {
            subscriber.disconnect();
        }
    }
};

const getIO = () => {
    if (!io) throw new Error('Socket.IO chưa được khởi tạo');
    return io;
};

const isUserOnline = (userId) => onlineUsers.has(Number(userId));

const emitSessionRevoked = (sessionId, reason = 'SESSION_REVOKED') => {
    const socketServer = getIO();
    const roomName = `session:${sessionId}`;

    // Notify and forcibly disconnect every tab/socket belonging to this
    // revoked session. Emitting an event alone would leave old sockets able
    // to continue sending realtime events after their session was revoked.
    const roomSocketIds = socketServer.sockets.adapter.rooms.get(roomName);
    if (!roomSocketIds) return;

    for (const socketId of [...roomSocketIds]) {
        const clientSocket = socketServer.sockets.sockets.get(socketId);
        if (!clientSocket) continue;

        clientSocket.emit('session:revoked', { sessionId, reason });
        clientSocket.disconnect(true);
    }
};

module.exports = {
    initSocket,
    closeSocket,
    getIO,
    emitSessionRevoked,
    isUserOnline,
    publishRealtimeEvent
};