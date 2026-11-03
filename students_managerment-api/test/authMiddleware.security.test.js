const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const { redisClient } = require('../src/config/redis');
const authRepository = require('../repository/authRepository');
const authMiddleware = require('../middleware/authMiddleware');

const JWT_SECRET = 'auth-middleware-test-secret';
const originalSecret = process.env.JWT_SECRET;

const withOverrides = async ({ redis = {}, repository = {} }, run) => {
    const originalReady = redisClient.isReady;
    const originalRedis = {};
    const originalRepository = {};

    for (const [key, value] of Object.entries(redis)) {
        originalRedis[key] = redisClient[key];
        redisClient[key] = value;
    }
    for (const [key, value] of Object.entries(repository)) {
        originalRepository[key] = authRepository[key];
        authRepository[key] = value;
    }

    process.env.JWT_SECRET = JWT_SECRET;
    try {
        await run();
    } finally {
        redisClient.isReady = originalReady;
        for (const [key, value] of Object.entries(originalRedis)) redisClient[key] = value;
        for (const [key, value] of Object.entries(originalRepository)) authRepository[key] = value;
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    }
};

const makeToken = (payload = {}, options = {}) => jwt.sign(
    { ...payload, sub: payload.sub ?? '42', sessionId: payload.sessionId ?? 'session-42' },
    JWT_SECRET,
    {
        issuer: 'student-management-api',
        audience: 'student-management-client',
        algorithm: 'HS256',
        ...options
    }
);

const invoke = async token => {
    const req = {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        ip: '127.0.0.1'
    };
    const res = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
    let nextCalled = false;
    let nextError = null;
    await authMiddleware(req, res, error => {
        nextCalled = true;
        nextError = error || null;
    });
    return { req, res, nextCalled, nextError };
};

test('returns 503 when Redis is not ready', async () => {
    await withOverrides({ redis: { isReady: false } }, async () => {
        const result = await invoke(makeToken());
        assert.equal(result.res.statusCode, 503);
        assert.equal(result.nextCalled, false);
    });
});

test('loads current role from PostgreSQL instead of trusting a stale JWT role', async () => {
    const token = makeToken({ role: 'admin' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    let requestedRedisKey = null;

    await withOverrides({
        redis: {
            isReady: true,
            get: async key => {
                requestedRedisKey = key;
                return '42';
            }
        },
        repository: {
            findSessionByIdAndUserId: async (sessionId, userId) => {
                assert.equal(sessionId, 'session-42');
                assert.equal(String(userId), '42');
                return { id: 'session-42', revoked_at: null, last_used_at: new Date() };
            },
            findUserById: async userId => {
                assert.equal(String(userId), '42');
                return { id: 42, username: 'student42', role: 'student', is_active: true };
            }
        }
    }, async () => {
        const result = await invoke(token);
        assert.equal(result.nextCalled, true);
        assert.equal(result.nextError, null);
        assert.equal(result.req.user.role, 'student');
        assert.equal(requestedRedisKey, `access_token:${tokenHash}`);
    });
});

test('rejects a revoked session even when the access token remains in Redis', async () => {
    await withOverrides({
        redis: { isReady: true, get: async () => '42' },
        repository: {
            findSessionByIdAndUserId: async () => ({
                id: 'session-42',
                revoked_at: new Date(),
                last_used_at: new Date()
            })
        }
    }, async () => {
        const result = await invoke(makeToken());
        assert.equal(result.res.statusCode, 401);
        assert.equal(result.nextCalled, false);
    });
});

test('rejects an account disabled after the access token was issued', async () => {
    await withOverrides({
        redis: { isReady: true, get: async () => '42' },
        repository: {
            findSessionByIdAndUserId: async () => ({
                id: 'session-42',
                revoked_at: null,
                last_used_at: new Date()
            }),
            findUserById: async () => ({
                id: 42,
                username: 'student42',
                role: 'student',
                is_active: false
            })
        }
    }, async () => {
        const result = await invoke(makeToken());
        assert.equal(result.res.statusCode, 403);
        assert.equal(result.nextCalled, false);
    });
});

test('returns 401 for an expired access token', async () => {
    await withOverrides({ redis: { isReady: true } }, async () => {
        const result = await invoke(makeToken({}, { expiresIn: -1 }));
        assert.equal(result.res.statusCode, 401);
        assert.equal(result.nextCalled, false);
    });
});

test('forwards Redis infrastructure errors instead of misreporting them as invalid credentials', async () => {
    const redisError = new Error('Redis connection unavailable');
    await withOverrides({
        redis: { isReady: true, get: async () => { throw redisError; } }
    }, async () => {
        const result = await invoke(makeToken());
        assert.equal(result.nextCalled, true);
        assert.equal(result.nextError, redisError);
        assert.equal(result.res.statusCode, null);
    });
});
