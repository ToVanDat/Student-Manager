'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-only-jwt-secret-for-turn-route';
const TURN_SECRET = '0123456789abcdef'.repeat(4);
const USER_ID = 73;
const SESSION_ID = 'turn-route-test-session';

const redisState = {
    isReady: true,
    tokenUserId: String(USER_ID),
    expectedRedisKey: null
};
const repositoryState = {
    session: { id: SESSION_ID, user_id: USER_ID, revoked_at: null, last_used_at: new Date().toISOString() },
    user: { id: USER_ID, username: 'turn-test-user', role: 'user', is_active: true }
};

const redisPath = require.resolve('../src/config/redis.js');
const repositoryPath = require.resolve('../repository/authRepository.js');
const middlewarePath = require.resolve('../middleware/authMiddleware.js');
const routerPath = require.resolve('../router/callRouter.js');

const originalRedisModule = require.cache[redisPath];
const originalRepositoryModule = require.cache[repositoryPath];
const originalMiddlewareModule = require.cache[middlewarePath];
const originalRouterModule = require.cache[routerPath];

require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: {
        redisClient: {
            get: async (key) => key === redisState.expectedRedisKey ? redisState.tokenUserId : null,
            get isReady() { return redisState.isReady; }
        }
    }
};

require.cache[repositoryPath] = {
    id: repositoryPath,
    filename: repositoryPath,
    loaded: true,
    exports: {
        findSessionByIdAndUserId: async () => repositoryState.session,
        updateSessionLastUsed: async () => undefined,
        findUserById: async () => repositoryState.user
    }
};

delete require.cache[middlewarePath];
delete require.cache[routerPath];
const callRouter = require('../router/callRouter');

const app = express();
app.use('/api/calls', callRouter);
app.use((error, req, res, next) => {
    res.status(500).json({ message: 'Internal server error' });
});

let server;
let baseUrl;

function issueToken(overrides = {}, options = {}) {
    return jwt.sign(
        { sessionId: SESSION_ID, ...overrides },
        JWT_SECRET,
        {
            algorithm: 'HS256',
            issuer: 'student-management-api',
            audience: 'student-management-client',
            subject: String(USER_ID),
            expiresIn: options.expiresIn || '5m'
        }
    );
}

function tokenRedisKey(token) {
    return 'access_token:' + crypto.createHash('sha256').update(token).digest('hex');
}

async function requestIce(token) {
    redisState.expectedRedisKey = token ? tokenRedisKey(token) : null;
    return fetch(baseUrl + '/api/calls/ice-config', {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
}

test('GET /api/calls/ice-config enforces auth and issues non-cacheable TURN credentials', async (t) => {
    const previousEnv = {
        JWT_SECRET: process.env.JWT_SECRET,
        STUN_URIS: process.env.STUN_URIS,
        TURN_URIS: process.env.TURN_URIS,
        TURN_SHARED_SECRET: process.env.TURN_SHARED_SECRET,
        TURN_CREDENTIAL_TTL_SECONDS: process.env.TURN_CREDENTIAL_TTL_SECONDS
    };

    Object.assign(process.env, {
        JWT_SECRET,
        STUN_URIS: 'stun:turn.smartsmanage.com:3478',
        TURN_URIS: 'turn:turn.smartsmanage.com:3478?transport=udp,turns:turn.smartsmanage.com:5349?transport=tcp',
        TURN_SHARED_SECRET: TURN_SECRET,
        TURN_CREDENTIAL_TTL_SECONDS: '3600'
    });

    redisState.isReady = true;
    redisState.tokenUserId = String(USER_ID);
    repositoryState.session = {
        id: SESSION_ID,
        user_id: USER_ID,
        revoked_at: null,
        last_used_at: new Date().toISOString()
    };
    repositoryState.user = {
        id: USER_ID,
        username: 'turn-test-user',
        role: 'user',
        is_active: true
    };

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    baseUrl = 'http://127.0.0.1:' + server.address().port;

    try {
        await t.test('rejects requests without a bearer token', async () => {
            const response = await requestIce();
            assert.equal(response.status, 401);
        });

        await t.test('fails closed while Redis is unavailable', async () => {
            redisState.isReady = false;
            const response = await requestIce(issueToken());
            assert.equal(response.status, 503);
            redisState.isReady = true;
        });

        await t.test('rejects expired JWTs', async () => {
            const expired = jwt.sign(
                { sessionId: SESSION_ID },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    issuer: 'student-management-api',
                    audience: 'student-management-client',
                    subject: String(USER_ID),
                    expiresIn: -1
                }
            );
            const response = await requestIce(expired);
            assert.equal(response.status, 401);
        });

        await t.test('rejects access tokens absent from the Redis allowlist', async () => {
            redisState.tokenUserId = null;
            const response = await requestIce(issueToken());
            assert.equal(response.status, 401);
            redisState.tokenUserId = String(USER_ID);
        });

        await t.test('rejects revoked sessions', async () => {
            repositoryState.session = {
                id: SESSION_ID,
                user_id: USER_ID,
                revoked_at: new Date().toISOString(),
                last_used_at: new Date().toISOString()
            };
            const response = await requestIce(issueToken());
            assert.equal(response.status, 401);
            repositoryState.session.revoked_at = null;
        });

        await t.test('rejects inactive accounts', async () => {
            repositoryState.user.is_active = false;
            const response = await requestIce(issueToken());
            assert.equal(response.status, 403);
            repositoryState.user.is_active = true;
        });

        await t.test('returns authenticated user TURN credentials without caching secrets', async () => {
            const token = issueToken();
            redisState.tokenUserId = String(USER_ID);
            const response = await requestIce(token);
            const body = await response.json();

            assert.equal(response.status, 200);
            assert.equal(response.headers.get('cache-control'), 'no-store, private');
            assert.equal(response.headers.get('pragma'), 'no-cache');
            assert.equal(body.turnAvailable, true);
            assert.match(body.iceServers[1].username, /^\d+:73$/);
            assert.equal(body.iceServers[1].urls.length, 2);
            assert.ok(body.iceServers[1].credential);
            assert.equal(JSON.stringify(body).includes(TURN_SECRET), false);
        });

        await t.test('returns 503 when TURN shared-secret configuration is invalid', async () => {
            process.env.TURN_SHARED_SECRET = 'invalid';
            const response = await requestIce(issueToken());
            const body = await response.json();
            assert.equal(response.status, 503);
            assert.equal(body.code, 'TURN_CONFIG_INVALID');
            assert.equal(JSON.stringify(body).includes('invalid'), false);
            process.env.TURN_SHARED_SECRET = TURN_SECRET;
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
        for (const [key, value] of Object.entries(previousEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        if (originalRedisModule) require.cache[redisPath] = originalRedisModule;
        else delete require.cache[redisPath];
        if (originalRepositoryModule) require.cache[repositoryPath] = originalRepositoryModule;
        else delete require.cache[repositoryPath];
        if (originalMiddlewareModule) require.cache[middlewarePath] = originalMiddlewareModule;
        else delete require.cache[middlewarePath];
        if (originalRouterModule) require.cache[routerPath] = originalRouterModule;
        else delete require.cache[routerPath];
    }
});
