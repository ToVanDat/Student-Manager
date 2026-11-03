const NEGOTIATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const registerCallSignalingHandlers = ({
    socket,
    io,
    userId,
    allowRealtimeEvent,
    getAuthorizedCall,
    isValidSessionDescription,
    isValidIceCandidate
}) => {
    const relay = async ({ event, payloadKey, payload, expectedType }) => {
        if (!await allowRealtimeEvent(event)) return;
        const { callId, targetUserId, negotiationId } = payload || {};
        const targetId = Number(targetUserId);
        const call = await getAuthorizedCall(callId, targetId);
        if (!call || !['connecting', 'connected'].includes(call.status)) return;

        if (typeof negotiationId !== 'string' || !NEGOTIATION_ID_PATTERN.test(negotiationId)) {
            socket.emit('call:error', {
                callId,
                code: 'INVALID_NEGOTIATION_ID',
                message: 'Mã thương lượng WebRTC không hợp lệ.'
            });
            return;
        }

        const value = payload?.[payloadKey];
        const valid = expectedType === 'ice'
            ? isValidIceCandidate(value)
            : isValidSessionDescription(value, expectedType);
        if (!valid) {
            socket.emit('call:error', {
                callId,
                code: 'INVALID_SIGNALING_PAYLOAD',
                message: expectedType === 'ice'
                    ? 'Dữ liệu ICE candidate không hợp lệ hoặc vượt quá giới hạn.'
                    : `Dữ liệu WebRTC ${expectedType} không hợp lệ hoặc vượt quá giới hạn.`
            });
            return;
        }

        io.to(`user:${targetId}`).emit(event, {
            callId,
            fromUserId: userId,
            toUserId: targetId,
            negotiationId,
            [payloadKey]: value
        });
    };

    socket.on('call:offer', payload => relay({
        event: 'call:offer',
        payloadKey: 'offer',
        payload,
        expectedType: 'offer'
    }));
    socket.on('call:answer', payload => relay({
        event: 'call:answer',
        payloadKey: 'answer',
        payload,
        expectedType: 'answer'
    }));
    socket.on('call:ice-candidate', payload => relay({
        event: 'call:ice-candidate',
        payloadKey: 'candidate',
        payload,
        expectedType: 'ice'
    }));
};

module.exports = { registerCallSignalingHandlers, NEGOTIATION_ID_PATTERN };
