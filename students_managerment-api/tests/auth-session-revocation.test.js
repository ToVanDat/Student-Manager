const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const redisConfigPath = require.resolve('../src/config/redis.js');
const repositoryPath = require.resolve('../repository/authRepository.js');
const middlewarePath = require.resolve('../middleware/authMiddleware.js');

test('rejects an access token when its PostgreSQL session is revoked even if Redis key remains', async (t) => {
    const token = jwt.sign(
        { sub: 'user-1', sessionId: 'session-revoked' },
        'session-middleware-test-secret',
        {
            expiresIn: '2m',
            issuer: 'student-management-api',
            audience: 'student-management-client',
            algorithm: 'HS256',
        },
    );

    const previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'session-middleware-test-secret';

    const redisClient = {
        isReady: true,
        async get() {
            // Simulate a stale AT key that has not yet expired or been cleaned up.
            return 'user-1';
        },
    };

    const repository = {
        async findSessionByIdAndUserId(sessionId, userId) {
            assert.equal(sessionId, 'session-revoked');
            assert.equal(userId, 'user-1');
            return { id: sessionId, user_id: userId, revoked_at: new Date(), last_used_at: null };
        },
    };

    require.cache[redisConfigPath] = {
        id: redisConfigPath,
        filename: redisConfigPath,
        loaded: true,
        exports: { redisClient },
    };
    require.cache[repositoryPath] = {
        id: repositoryPath,
        filename: repositoryPath,
        loaded: true,
        exports: repository,
    };
    delete require.cache[middlewarePath];

    const authMiddleware = require('../middleware/authMiddleware.js');
    const req = { headers: { authorization: `Bearer ${token}` } };
    let statusCode = 200;
    let body;
    let nextCalled = false;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            body = payload;
            return this;
        },
    };

    await authMiddleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(statusCode, 401);
    assert.equal(body.message, 'Session đã bị thu hồi');
    assert.equal(nextCalled, false);

    t.after(() => {
        delete require.cache[middlewarePath];
        delete require.cache[repositoryPath];
        delete require.cache[redisConfigPath];
        if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousJwtSecret;
    });
});
