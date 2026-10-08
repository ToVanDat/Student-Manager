const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const conversationRepository = require('../../repository/conversationRepository.js');
const authRepository = require('../../repository/authRepository.js');
const messageRepository = require('../../repository/messageRepository.js');
const userRepository = require('../../repository/userRepository.js');
const callRepository = require('../../repository/callRepository.js');

let io = null;
const onlineUsers = new Map(); // userId -> Set<socketId>
const callTimers = new Map(); // callId -> timeout

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

    io.on('connection', async (socket) => {
        const userId = Number(socket.user.id);
        const sessionId = socket.user.sessionId;

        // Socket authentication is checked only when the connection is
        // established. Schedule a hard disconnect at JWT expiry so an
        // expired access token can never keep using realtime events.
        const tokenExpiresAt = Number(socket.handshake.auth?.accessToken
            ? jwt.decode(socket.handshake.auth.accessToken)?.exp
            : 0);

        const tokenLifetimeMs = tokenExpiresAt > 0
            ? Math.max(tokenExpiresAt * 1000 - Date.now(), 0)
            : 0;

        const tokenExpiryTimer = tokenLifetimeMs > 0
            ? setTimeout(() => {
                socket.disconnect(true);
            }, tokenLifetimeMs)
            : null;

        socket.once('disconnect', () => {
            if (tokenExpiryTimer) {
                clearTimeout(tokenExpiryTimer);
            }
        });

        socket.join(`session:${sessionId}`);
        socket.join(`user:${userId}`);

        // Một user có thể mở nhiều tab/device. Chỉ khi socket đầu tiên kết nối
        // mới chuyển trạng thái offline -> online.
        let userSockets = onlineUsers.get(userId);
        const wasOffline = !userSockets || userSockets.size === 0;

        if (!userSockets) {
            userSockets = new Set();
            onlineUsers.set(userId, userSockets);
        }

        userSockets.add(socket.id);

        if (wasOffline) {
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

        socket.on('presence:sync', async () => {
            try {
                const contactIds = await conversationRepository.getConversationContactIds(userId);
                const onlineContactIds = contactIds.filter(contactId => onlineUsers.has(contactId));
                socket.emit('presence:snapshot', { userIds: onlineContactIds });
            } catch (error) {
                console.error('PRESENCE SYNC ERROR:', error);
            }
        });

        socket.on('conversation:join', async ({ conversationId }) => {
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

        socket.on('conversation:leave', ({ conversationId }) => {
            const id = Number(conversationId);
            if (Number.isInteger(id) && id > 0) socket.leave(`conversation:${id}`);
        });

        socket.on('message:send', async ({ conversationId, content, replyToMessageId = null }) => {
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

                const savedMessage = await messageRepository.createMessage(id, userId, text, replyTo);
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

                socket.emit('message:sent', { message: savedMessage });
            } catch (error) {
                console.error('SEND MESSAGE ERROR:', error);
                socket.emit('message:error', { message: 'Không thể gửi tin nhắn' });
            }
        });

        socket.on('message:edit', async ({ messageId, content }) => {
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

        const CALL_RING_TIMEOUT_MS = 30_000;
        const CALL_CONNECT_TIMEOUT_MS = 15_000;
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
            if (!callId || !Number.isInteger(targetId) || targetId <= 0 || targetId === userId) {
                return null;
            }

            const call = await callRepository.getCallByIdForParticipant(
                callId,
                userId,
                targetId
            );

            if (!call) return null;

            // Keep block/relationship checks in addition to call ownership.
            if (!(await canCallUser(targetId))) return null;

            return call;
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

        socket.on('call:start', async ({ callId, targetUserId, callType = 'voice' }) => {
            const targetId = Number(targetUserId);
            if (!callId || !['voice', 'video'].includes(callType) || !(await canCallUser(targetId))) {
                return socket.emit('call:error', { message: 'Bạn không được phép gọi người dùng này' });
            }
            if (!onlineUsers.has(targetId)) {
                return socket.emit('call:error', { callId, code: 'USER_OFFLINE', message: 'Người dùng hiện không online' });
            }

            const conversation = await conversationRepository.findDirectConversation(userId, targetId);
            const call = await callRepository.createCall({
                callId,
                callerId: userId,
                receiverId: targetId,
                conversationId: conversation?.id || null,
                callType
            });

            if (!call) return socket.emit('call:error', { callId, message: 'Không thể tạo cuộc gọi' });

            io.to(`user:${targetId}`).emit('call:incoming', {
                callId, fromUserId: userId, fromUsername: socket.user.username, toUserId: targetId, callType
            });

            callTimers.set(callId, setTimeout(async () => {
                try {
                    const updated = await callRepository.updateCallStatus(callId, 'missed', 'ring-timeout');
                    if (updated) {
                        io.to(`user:${targetId}`).emit('call:ended', {
                            callId, fromUserId: userId, toUserId: targetId, reason: 'ring-timeout'
                        });
                        io.to(`user:${userId}`).emit('call:timeout', {
                            callId, status: 'missed', reason: 'ring-timeout'
                        });
                        await emitCallNotification(
                            targetId,
                            updated,
                            'missed-call',
                            'Cuộc gọi nhỡ',
                            `Bạn có cuộc gọi ${callType === 'video' ? 'video' : 'thoại'} nhỡ.`
                        );
                    }
                } catch (error) {
                    console.error('CALL RING TIMEOUT ERROR:', error);
                } finally {
                    clearCallTimer(callId);
                }
            }, CALL_RING_TIMEOUT_MS));
        });

        socket.on('call:accept', async ({ callId, targetUserId, callType = 'voice' }) => {
            const targetId = Number(targetUserId);
            if (!callId || !(await canCallUser(targetId))) return;
            clearCallTimer(callId);
            const updated = await callRepository.updateCallStatus(callId, 'connecting', null, true);
            io.to(`user:${targetId}`).emit('call:accepted', {
                callId, fromUserId: userId, toUserId: targetId, callType
            });

            callTimers.set(callId, setTimeout(async () => {
                try {
                    const failed = await callRepository.updateCallStatus(callId, 'failed', 'connection-timeout');
                    if (failed) {
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

        socket.on('call:reject', async ({ callId, targetUserId, reason = 'rejected' }) => {
            const targetId = Number(targetUserId);
            if (!callId || !(await canCallUser(targetId))) return;
            clearCallTimer(callId);
            const updated = await callRepository.updateCallStatus(callId, 'rejected', reason);
            io.to(`user:${targetId}`).emit('call:rejected', {
                callId, fromUserId: userId, toUserId: targetId, reason
            });
            if (updated) {
                await emitCallNotification(
                    targetId,
                    updated,
                    'call-rejected',
                    'Cuộc gọi bị từ chối',
                    'Cuộc gọi của bạn đã bị từ chối.'
                );
            }
        });

        socket.on('call:offer', async ({ callId, targetUserId, offer }) => {
            const targetId = Number(targetUserId);
            const call = await getAuthorizedCall(callId, targetId);
            if (!call || !offer || ['rejected', 'missed', 'cancelled', 'failed', 'timeout', 'completed'].includes(call.status)) return;
            io.to(`user:${targetId}`).emit('call:offer', {
                callId, fromUserId: userId, toUserId: targetId, offer
            });
        });

        socket.on('call:answer', async ({ callId, targetUserId, answer }) => {
            const targetId = Number(targetUserId);
            const call = await getAuthorizedCall(callId, targetId);
            if (!call || !answer || ['rejected', 'missed', 'cancelled', 'failed', 'timeout', 'completed'].includes(call.status)) return;
            io.to(`user:${targetId}`).emit('call:answer', {
                callId, fromUserId: userId, toUserId: targetId, answer
            });
        });

        socket.on('call:connected', async ({ callId, targetUserId }) => {
            const targetId = Number(targetUserId);
            const call = await getAuthorizedCall(callId, targetId);
            if (!call) {
                return socket.emit('call:error', {
                    callId,
                    code: 'CALL_NOT_FOUND',
                    message: 'Cuộc gọi không tồn tại hoặc bạn không có quyền.'
                });
            }

            clearCallTimer(callId);
            if (!call.ended_at && !['completed', 'rejected', 'missed', 'cancelled', 'failed', 'timeout'].includes(call.status)) {
                await callRepository.updateCallStatus(callId, 'connecting', null, true);
            }

            io.to(`user:${targetId}`).emit('call:connected', {
                callId, fromUserId: userId, toUserId: targetId
            });
        });

        socket.on('call:ice-candidate', async ({ callId, targetUserId, candidate }) => {
            const targetId = Number(targetUserId);
            const call = await getAuthorizedCall(callId, targetId);
            if (!call || !candidate || ['rejected', 'missed', 'cancelled', 'failed', 'timeout', 'completed'].includes(call.status)) return;
            io.to(`user:${targetId}`).emit('call:ice-candidate', {
                callId, fromUserId: userId, toUserId: targetId, candidate
            });
        });

        socket.on('call:end', async ({ callId, targetUserId, reason = 'ended' }) => {
            const targetId = Number(targetUserId);
            const currentCall = await getAuthorizedCall(callId, targetId);
            if (!currentCall) {
                return socket.emit('call:error', {
                    callId,
                    code: 'CALL_NOT_FOUND',
                    message: 'Cuộc gọi không tồn tại hoặc bạn không có quyền.'
                });
            }

            clearCallTimer(callId);
            const finalStatus = reason === 'cancelled'
                ? 'cancelled'
                : (currentCall.answered_at ? 'completed' : 'cancelled');
            const updated = await callRepository.updateCallStatus(callId, finalStatus, reason);
            io.to(`user:${targetId}`).emit('call:ended', {
                callId, fromUserId: userId, toUserId: targetId, reason
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

            if (userSockets) {
                userSockets.delete(socket.id);

                // Chỉ khi socket cuối cùng của user biến mất mới phát OFFLINE
                // và ghi last_seen_at.
                if (userSockets.size === 0) {
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
                        for (const contactId of contactIds) {
                            io.to(`user:${contactId}`).emit('presence:offline', {
                                userId,
                                lastSeenAt
                            });
                        }
                    } catch (error) {
                        console.error('PRESENCE OFFLINE ERROR:', error);
                    }
                }
            }

            console.log(`Socket disconnected: user=${userId}, socket=${socket.id}, reason=${reason}`);
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