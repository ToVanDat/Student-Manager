'use strict';

const SESSION_REVOCATION_CHANNEL = 'presence:events';

function createSessionRevocationEvent(sessionId, reason = 'SESSION_REVOKED') {
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 128) {
        throw new TypeError('A valid session ID is required for revocation broadcast');
    }
    const normalizedReason = typeof reason === 'string' && /^[A-Z0-9_]{1,64}$/.test(reason)
        ? reason
        : 'SESSION_REVOKED';
    return {
        event: 'session:revoked',
        payload: { sessionId, reason: normalizedReason }
    };
}

function parseSessionRevocationEvent(raw) {
    try {
        const event = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (event?.event !== 'session:revoked') return null;
        const sessionId = event?.payload?.sessionId;
        if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 128) return null;
        const reason = typeof event.payload.reason === 'string' &&
            /^[A-Z0-9_]{1,64}$/.test(event.payload.reason)
            ? event.payload.reason
            : 'SESSION_REVOKED';
        return { sessionId, reason };
    } catch {
        return null;
    }
}

async function publishSessionRevocation(redisClient, sessionId, reason = 'SESSION_REVOKED') {
    if (!redisClient?.isReady) throw new Error('Redis session revocation publisher is unavailable');
    const event = createSessionRevocationEvent(sessionId, reason);
    return redisClient.publish(SESSION_REVOCATION_CHANNEL, JSON.stringify(event));
}

module.exports = {
    SESSION_REVOCATION_CHANNEL,
    createSessionRevocationEvent,
    parseSessionRevocationEvent,
    publishSessionRevocation
};
