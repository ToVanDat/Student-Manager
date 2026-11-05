'use strict';

const crypto = require('crypto');
const { redisClient } = require('../src/config/redis.js');

const TTL_SECONDS = 180;
const keyFor = id => `auth:pending-face-mfa:${id}`;
const digest = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const randomId = () => crypto.randomBytes(32).toString('base64url');

function requestBinding(req) {
    return {
        userAgentHash: digest(req?.get?.('user-agent') || ''),
        ipHash: digest(req?.ip || '')
    };
}

async function createPendingAuth(user, req, method) {
    if (!user?.id || user.is_active !== true) {
        const error = new Error('Tài khoản không hợp lệ để xác thực');
        error.code = 'PENDING_AUTH_ACCOUNT_INVALID';
        throw error;
    }
    const pendingAuthId = randomId();
    const state = {
        userId: String(user.id),
        method: String(method || 'unknown'),
        createdAt: Date.now(),
        ...requestBinding(req)
    };
    await redisClient.set(keyFor(pendingAuthId), JSON.stringify(state), { EX: TTL_SECONDS, NX: true });
    return {
        requiresFaceMfa: true,
        pendingAuthId,
        expiresIn: TTL_SECONDS,
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name || '',
            email: user.email,
            role: user.role,
            avatar_url: user.avatar_url || null
        }
    };
}

async function readPendingAuth(pendingAuthId, req) {
    if (typeof pendingAuthId !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(pendingAuthId)) return null;
    const raw = await redisClient.get(keyFor(pendingAuthId));
    if (!raw) return null;
    let state;
    try { state = JSON.parse(raw); } catch { return null; }
    const binding = requestBinding(req);
    if (state.userAgentHash !== binding.userAgentHash || state.ipHash !== binding.ipHash) return null;
    return state;
}

async function consumePendingAuth(pendingAuthId, userId, req) {
    if (typeof pendingAuthId !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(pendingAuthId)) return null;
    const key = keyFor(pendingAuthId);
    const raw = await redisClient.eval(
        "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
        { keys: [key], arguments: [] }
    );
    if (!raw) return null;
    let state;
    try { state = JSON.parse(raw); } catch { return null; }
    const binding = requestBinding(req);
    if (state.userId !== String(userId) || state.userAgentHash !== binding.userAgentHash || state.ipHash !== binding.ipHash) return null;
    return state;
}

module.exports = { createPendingAuth, readPendingAuth, consumePendingAuth, TTL_SECONDS };
