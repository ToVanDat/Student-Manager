const crypto = require('crypto');
const net = require('net');
const { redisClient } = require('../src/config/redis.js');

const HANDSHAKE_RATE_LIMIT = Object.freeze({
    limit: 300,
    windowMs: 60_000
});

const readTrustedProxyHops = (value = process.env.TRUST_PROXY_HOPS) => {
    if (value === undefined || value === '') return 0;
    if (!/^[1-9][0-9]*$/.test(String(value))) {
        throw new Error('TRUST_PROXY_HOPS must be a positive integer');
    }
    const hops = Number(value);
    if (!Number.isSafeInteger(hops)) {
        throw new Error('TRUST_PROXY_HOPS must be a safe positive integer');
    }
    return hops;
};

const getSocketClientAddress = (request, trustProxyHops = readTrustedProxyHops()) => {
    const peerAddress = request?.socket?.remoteAddress;
    if (typeof peerAddress !== 'string' || net.isIP(peerAddress) === 0) return null;

    // Never trust forwarded headers unless the deployment explicitly declares
    // the exact number of trusted reverse-proxy hops.
    if (trustProxyHops === 0) return peerAddress;

    const forwardedFor = request?.headers?.['x-forwarded-for'];
    if (typeof forwardedFor !== 'string') return null;

    const chain = forwardedFor.split(',').map((entry) => entry.trim());
    if (chain.length < trustProxyHops || chain.some((entry) => net.isIP(entry) === 0)) {
        return null;
    }

    // Select the address immediately before the configured trusted proxies.
    return chain[chain.length - trustProxyHops];
};

const consumeSocketHandshakeRateLimit = async (clientAddress) => {
    if (typeof clientAddress !== 'string' || net.isIP(clientAddress) === 0) {
        throw new Error('invalid socket handshake client address');
    }
    if (!redisClient.isReady) {
        throw new Error('Redis is not ready; socket handshake rate limiting is unavailable');
    }

    const addressHash = crypto.createHash('sha256').update(clientAddress).digest('hex');
    const key = `rate-limit:socket:handshake:${addressHash}`;
    const script = `
        local hits = redis.call('INCR', KEYS[1])
        local ttl = redis.call('PTTL', KEYS[1])
        if hits == 1 or ttl < 0 then
            redis.call('PEXPIRE', KEYS[1], ARGV[1])
            ttl = tonumber(ARGV[1])
        end
        return { hits, ttl }
    `;

    const result = await redisClient.eval(script, {
        keys: [key],
        arguments: [String(HANDSHAKE_RATE_LIMIT.windowMs)]
    });

    if (
        !Array.isArray(result) ||
        result.length < 2 ||
        !Number.isSafeInteger(Number(result[0])) ||
        Number(result[0]) < 1 ||
        !Number.isFinite(Number(result[1])) ||
        Number(result[1]) < 0
    ) {
        throw new Error('invalid socket handshake rate-limit result');
    }

    return {
        allowed: Number(result[0]) <= HANDSHAKE_RATE_LIMIT.limit,
        totalHits: Number(result[0]),
        retryAfterMs: Number(result[1])
    };
};

const allowSocketHandshake = async (request) => {
    const clientAddress = getSocketClientAddress(request);
    if (!clientAddress) return false;

    try {
        const result = await consumeSocketHandshakeRateLimit(clientAddress);
        return result.allowed;
    } catch (error) {
        console.error('[SOCKET][handshake rate-limit unavailable]', error.message);
        return false;
    }
};

module.exports = {
    HANDSHAKE_RATE_LIMIT,
    readTrustedProxyHops,
    getSocketClientAddress,
    consumeSocketHandshakeRateLimit,
    allowSocketHandshake
};
