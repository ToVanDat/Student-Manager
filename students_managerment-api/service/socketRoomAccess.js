'use strict';

async function evictUserFromConversation(io, userId, conversationId) {
    const userRoom = `user:${Number(userId)}`;
    const conversationRoom = `conversation:${Number(conversationId)}`;

    try {
        await io.in(userRoom).socketsLeave(conversationRoom);
        return { evicted: true, disconnected: false };
    } catch (evictionError) {
        // If the adapter cannot remove a stale room membership, disconnect
        // every socket for that user so it cannot receive private room events.
        try {
            await io.in(userRoom).disconnectSockets(true);
            console.warn('[CHAT][room eviction fallback disconnected user sockets]', {
                userId: Number(userId),
                conversationId: Number(conversationId),
                code: evictionError?.code || 'ROOM_EVICTION_FAILED'
            });
            return { evicted: true, disconnected: true };
        } catch (disconnectError) {
            const error = new Error('Không thể thu hồi quyền realtime của thành viên đã rời nhóm');
            error.code = 'ROOM_ACCESS_REVOCATION_FAILED';
            error.cause = disconnectError;
            throw error;
        }
    }
}


/**
 * Close the race between membership validation and room subscription.
 * Check once before joining, then again after joining. If membership was
 * revoked while the join was in flight, immediately leave before confirming
 * the subscription to the client. A later revocation is handled by the
 * membership-removal path's room eviction.
 */
async function joinConversationRoom(socket, conversationRepository, userId, conversationId) {
    const roomName = `conversation:${Number(conversationId)}`;
    if (!await conversationRepository.isConversationMember(conversationId, userId)) {
        return false;
    }

    await socket.join(roomName);
    try {
        if (!await conversationRepository.isConversationMember(conversationId, userId)) {
            await socket.leave(roomName);
            return false;
        }
        return true;
    } catch (error) {
        // A failed second authorization check must never leave a socket in a
        // private room. If adapter cleanup itself fails, disconnect this
        // socket as the fail-closed fallback.
        try {
            await socket.leave(roomName);
        } catch (leaveError) {
            try {
                socket.disconnect(true);
            } catch (disconnectError) {
                const revocationError = new Error('Không thể thu hồi quyền realtime của conversation');
                revocationError.code = 'ROOM_ACCESS_REVOCATION_FAILED';
                revocationError.cause = disconnectError;
                throw revocationError;
            }
            error.roomLeaveError = leaveError;
        }
        throw error;
    }
}

module.exports = { evictUserFromConversation, joinConversationRoom };
