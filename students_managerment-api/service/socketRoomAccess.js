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

module.exports = { evictUserFromConversation };
