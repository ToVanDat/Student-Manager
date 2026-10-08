const activeCalls = new Map(); // callId -> { callerId, calleeId, status }

const emitToUser = (io, userId, event, payload) => {
    io.to(`user:${Number(userId)}`).emit(event, payload);
};

const validUserId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const registerCallSignaling = (io, socket) => {
    const userId = Number(socket.user.id);

    socket.on('call:invite', ({ callId, targetUserId, callType }) => {
        const targetId = validUserId(targetUserId);

        if (!callId || !targetId || !['voice', 'video'].includes(callType)) {
            return socket.emit('call:error', { message: 'Thông tin cuộc gọi không hợp lệ' });
        }

        if (targetId === userId) {
            return socket.emit('call:error', { message: 'Không thể gọi chính mình' });
        }

        activeCalls.set(String(callId), {
            callerId: userId,
            calleeId: targetId,
            callType,
            status: 'ringing'
        });

        emitToUser(io, targetId, 'call:incoming', {
            callId: String(callId),
            callerId: userId,
            callType
        });

        socket.emit('call:outgoing', {
            callId: String(callId),
            targetUserId: targetId,
            callType
        });
    });

    socket.on('call:accept', ({ callId }) => {
        const call = activeCalls.get(String(callId));
        if (!call || call.calleeId !== userId) {
            return socket.emit('call:error', { message: 'Cuộc gọi không tồn tại hoặc không hợp lệ' });
        }

        call.status = 'accepted';

        emitToUser(io, call.callerId, 'call:accepted', {
            callId: String(callId),
            userId
        });
    });

    socket.on('call:reject', ({ callId, reason = 'rejected' }) => {
        const call = activeCalls.get(String(callId));
        if (!call || call.calleeId !== userId) {
            return socket.emit('call:error', { message: 'Cuộc gọi không tồn tại hoặc không hợp lệ' });
        }

        activeCalls.delete(String(callId));

        emitToUser(io, call.callerId, 'call:rejected', {
            callId: String(callId),
            userId,
            reason
        });
    });

    socket.on('call:cancel', ({ callId }) => {
        const call = activeCalls.get(String(callId));
        if (!call || call.callerId !== userId) {
            return socket.emit('call:error', { message: 'Bạn không phải người tạo cuộc gọi này' });
        }

        activeCalls.delete(String(callId));

        emitToUser(io, call.calleeId, 'call:cancelled', {
            callId: String(callId),
            userId
        });
    });

    socket.on('call:end', ({ callId }) => {
        const call = activeCalls.get(String(callId));
        if (!call || (call.callerId !== userId && call.calleeId !== userId)) {
            return socket.emit('call:error', { message: 'Bạn không thuộc cuộc gọi này' });
        }

        const targetId = call.callerId === userId ? call.calleeId : call.callerId;
        activeCalls.delete(String(callId));

        emitToUser(io, targetId, 'call:ended', {
            callId: String(callId),
            userId
        });
    });

    const relay = (event, targetEvent) => {
        socket.on(event, ({ callId, targetUserId, ...data }) => {
            const call = activeCalls.get(String(callId));

            if (!call || (call.callerId !== userId && call.calleeId !== userId)) {
                return socket.emit('call:error', { message: 'Cuộc gọi không hợp lệ' });
            }

            const targetId = call.callerId === userId ? call.calleeId : call.callerId;

            if (targetUserId && Number(targetUserId) !== targetId) {
                return socket.emit('call:error', { message: 'Đích signaling không hợp lệ' });
            }

            emitToUser(io, targetId, targetEvent, {
                callId: String(callId),
                senderId: userId,
                ...data
            });
        });
    };

    relay('call:offer', 'call:offer');
    relay('call:answer', 'call:answer');
    relay('call:ice-candidate', 'call:ice-candidate');

    socket.on('disconnect', () => {
        for (const [callId, call] of activeCalls.entries()) {
            if (call.callerId !== userId && call.calleeId !== userId) continue;

            const targetId = call.callerId === userId ? call.calleeId : call.callerId;

            emitToUser(io, targetId, 'call:ended', {
                callId,
                userId,
                reason: 'socket-disconnected'
            });

            activeCalls.delete(callId);
        }
    });
};

module.exports = { registerCallSignaling };
