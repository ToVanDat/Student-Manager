const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { redisClient } = require('../src/config/redis.js');

const hashAccessToken = (token) => crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

const accessTokenKey = (token) => `access_token:${hashAccessToken(token)}`;
const sessionTokenSetKey = (sessionId) => `session_access_tokens:${sessionId}`;

const saveAccessTokenToRedis = async (accessToken, userId) => {
    const decoded = jwt.decode(accessToken);
    if (!decoded?.exp || !decoded?.sessionId) {
        throw new Error('Access token thiếu thông tin hết hạn hoặc session');
    }

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) throw new Error('Access token đã hết hạn');

    const tokenKey = accessTokenKey(accessToken);
    const sessionKey = sessionTokenSetKey(decoded.sessionId);

    await redisClient.set(tokenKey, String(userId), { EX: ttl });
    try {
        await redisClient.sAdd(sessionKey, tokenKey);
        // Extending to the newest token's TTL is safe: older token keys retain
        // their own shorter TTL and are harmless stale members until this set expires.
        await redisClient.expire(sessionKey, ttl);
    } catch (error) {
        await redisClient.del(tokenKey).catch(() => {});
        throw error;
    }

    return tokenKey;
};

const removeAccessTokenFromRedis = async (accessToken) => {
    if (!accessToken) return;

    const tokenKey = accessTokenKey(accessToken);
    const decoded = jwt.decode(accessToken);
    await redisClient.del(tokenKey);

    if (decoded?.sessionId) {
        await redisClient.sRem(sessionTokenSetKey(decoded.sessionId), tokenKey);
    }
};

// PostgreSQL session.revoked_at remains the authorization source of truth.
// This Redis index removes every outstanding AT key promptly after revocation.
const removeAccessTokensForSession = async (sessionId) => {
    if (!sessionId) return 0;

    const sessionKey = sessionTokenSetKey(sessionId);
    const tokenKeys = await redisClient.sMembers(sessionKey);
    if (tokenKeys.length) await redisClient.del(tokenKeys);
    await redisClient.del(sessionKey);
    return tokenKeys.length;
};

// Validate that this exact access token is still present in Redis and belongs
// to the authenticated user. Missing keys are treated as revoked; Redis errors
// propagate so Socket.IO authentication fails closed.
const isAccessTokenActive = async (accessToken, userId) => {
    if (typeof accessToken !== 'string' || !accessToken || !userId) {
        return false;
    }

    const storedUserId = await redisClient.get(accessTokenKey(accessToken));
    return storedUserId !== null && storedUserId === String(userId);
};

module.exports = {
    saveAccessTokenToRedis,
    removeAccessTokenFromRedis,
    removeAccessTokensForSession,
    isAccessTokenActive,
};
