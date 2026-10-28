const crypto = require('crypto');
const { redisClient } = require('../src/config/redis');

const FAILURE_WINDOW_SECONDS = 24 * 60 * 60;
const KEY_PREFIX = 'auth:password:';

const COOLDOWN_TIERS = Object.freeze([
    { attempts: 12, milliseconds: 30 * 60 * 1000 },
    { attempts: 10, milliseconds: 15 * 60 * 1000 },
    { attempts: 8, milliseconds: 5 * 60 * 1000 },
    { attempts: 6, milliseconds: 60 * 1000 },
    { attempts: 4, milliseconds: 30 * 1000 }
]);

const RECORD_FAILURE_SCRIPT = `
local failures = redis.call('INCR', KEYS[1])
if failures == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end

local risk = redis.call('INCR', KEYS[2])
if risk == 1 then
    redis.call('EXPIRE', KEYS[2], ARGV[1])
end

redis.call('SADD', KEYS[3], ARGV[2])
if redis.call('TTL', KEYS[3]) < 0 then
    redis.call('EXPIRE', KEYS[3], ARGV[1])
end

local cooldown = 0
if failures >= 12 then
    cooldown = 1800000
elseif failures >= 10 then
    cooldown = 900000
elseif failures >= 8 then
    cooldown = 300000
elseif failures >= 6 then
    cooldown = 60000
elseif failures >= 4 then
    cooldown = 30000
end

if cooldown > 0 then
    redis.call('PSETEX', KEYS[4], cooldown, tostring(cooldown))
end

return { failures, risk, cooldown }
`;

const CHECK_COOLDOWN_SCRIPT = `
return redis.call('PTTL', KEYS[1])
`;

const RESET_ACCOUNT_SCRIPT = `
local ipHashes = redis.call('SMEMBERS', KEYS[1])
for _, ipHash in ipairs(ipHashes) do
    redis.call('DEL',
        ARGV[1] .. ARGV[2] .. ':' .. ipHash .. ':failures',
        ARGV[1] .. ARGV[2] .. ':' .. ipHash .. ':cooldown'
    )
end
redis.call('DEL', KEYS[1], KEYS[2])
return #ipHashes
`;

function getCooldownMs(failedAttempts) {
    const attempts = Number(failedAttempts);
    if (!Number.isFinite(attempts) || attempts < 1) return 0;
    const tier = COOLDOWN_TIERS.find((item) => attempts >= item.attempts);
    return tier ? tier.milliseconds : 0;
}

function hashIdentifier(value) {
    const secret = process.env.AUTH_RATE_LIMIT_HASH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('AUTH_RATE_LIMIT_HASH_SECRET or JWT_SECRET is required');
    }

    return crypto
        .createHmac('sha256', secret)
        .update(String(value))
        .digest('hex');
}

function normalizeAccountIdentifier(username) {
    return String(username || '').normalize('NFKC').trim().toLowerCase();
}

function getAccountHash(username) {
    const normalized = normalizeAccountIdentifier(username);
    if (!normalized) throw new Error('Username is required for password protection');
    return hashIdentifier(normalized);
}

function getIpHash(ipAddress) {
    return hashIdentifier(String(ipAddress || 'unknown'));
}

function buildKeys(accountHash, ipHash) {
    const accountIp = `${accountHash}:${ipHash}`;
    return {
        failures: `${KEY_PREFIX}${accountIp}:failures`,
        cooldown: `${KEY_PREFIX}${accountIp}:cooldown`,
        risk: `${KEY_PREFIX}risk:${accountHash}`,
        ipIndex: `${KEY_PREFIX}ip-index:${accountHash}`
    };
}

async function getCooldownState(username, ipAddress) {
    const accountHash = getAccountHash(username);
    const ipHash = getIpHash(ipAddress);
    const keys = buildKeys(accountHash, ipHash);
    const ttl = Number(await redisClient.eval(CHECK_COOLDOWN_SCRIPT, {
        keys: [keys.cooldown],
        arguments: []
    }));

    return {
        active: ttl > 0,
        retryAfterSeconds: ttl > 0 ? Math.ceil(ttl / 1000) : 0
    };
}

async function recordFailure(username, ipAddress) {
    const accountHash = getAccountHash(username);
    const ipHash = getIpHash(ipAddress);
    const keys = buildKeys(accountHash, ipHash);
    const result = await redisClient.eval(RECORD_FAILURE_SCRIPT, {
        keys: [keys.failures, keys.risk, keys.ipIndex, keys.cooldown],
        arguments: [String(FAILURE_WINDOW_SECONDS), ipHash]
    });

    return {
        failedAttempts: Number(result?.[0]) || 0,
        accountRiskSignals: Number(result?.[1]) || 0,
        cooldownMs: Number(result?.[2]) || 0
    };
}

async function clearAccountIpState(username, ipAddress) {
    const accountHash = getAccountHash(username);
    const ipHash = getIpHash(ipAddress);
    const keys = buildKeys(accountHash, ipHash);
    await redisClient.del(keys.failures, keys.cooldown);
}

async function resetAccountState(username) {
    const accountHash = getAccountHash(username);
    const keys = buildKeys(accountHash, 'unused');
    return redisClient.eval(RESET_ACCOUNT_SCRIPT, {
        keys: [keys.ipIndex, keys.risk],
        arguments: [`${KEY_PREFIX}`, accountHash]
    });
}

async function passwordLoginProtection(req, res, next) {
    const username = req.body?.username;
    if (!username || !String(username).trim()) return next();

    try {
        const state = await getCooldownState(username, req.ip);
        if (!state.active) return next();

        res.setHeader('Retry-After', String(state.retryAfterSeconds));
        return res.status(429).json({
            code: 'LOGIN_COOLDOWN',
            message: 'Bạn đang thực hiện quá nhiều yêu cầu đăng nhập. Vui lòng chờ một lúc rồi thử lại.'
        });
    } catch (error) {
        console.error('[AUTH][password protection unavailable]', error.code || error.message);
        return res.status(503).json({
            code: 'AUTH_PROTECTION_UNAVAILABLE',
            message: 'Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.'
        });
    }
}

module.exports = {
    passwordLoginProtection,
    getCooldownState,
    recordFailure,
    clearAccountIpState,
    resetAccountState,
    getCooldownMs,
    normalizeAccountIdentifier
};
