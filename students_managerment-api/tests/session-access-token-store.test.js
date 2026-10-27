const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const path = require('node:path');

const redisConfigPath = require.resolve('../src/config/redis.js');
const accessTokenStorePath = require.resolve('../service/accessTokenStore.js');
const sessionRepositoryPath = require.resolve('../repository/authRepository.js');
const sessionStorePath = require.resolve('../service/sessionService.js');

const createRedisMock = () => {
    const values = new Map();
    const sets = new Map();

    return {
        values,
        sets,
        client: {
            async set(key, value, options = {}) {
                values.set(key, { value, expiresIn: options.EX });
                return 'OK';
            },
            async get(key) {
                return values.get(key)?.value ?? null;
            },
            async del(keys) {
                const list = Array.isArray(keys) ? keys : [keys];
                let removed = 0;
                for (const key of list) {
                    if (values.delete(key)) removed += 1;
                    if (sets.delete(key)) removed += 1;
                }
                return removed;
            },
            async sAdd(key, value) {
                if (!sets.has(key)) sets.set(key, new Set());
                const set = sets.get(key);
                const before = set.size;
                set.add(value);
                return set.size - before;
            },
            async sRem(key, value) {
                return sets.get(key)?.delete(value) ? 1 : 0;
            },
            async sMembers(key) {
                return [...(sets.get(key) || [])];
            },
            async expire(key, seconds) {
                if (sets.has(key)) return 1;
                return 0;
            },
        },
    };
};

const createAccessToken = (sessionId, userId = 'user-1') => jwt.sign(
    { sub: userId, sessionId },
    'test-secret',
    { expiresIn: '5m', issuer: 'student-management-api', audience: 'student-management-client', jwtid: crypto.randomUUID() }
);

const installRedisMock = (mock) => {
    require.cache[redisConfigPath] = {
        id: redisConfigPath,
        filename: redisConfigPath,
        loaded: true,
        exports: { redisClient: mock.client },
    };
    delete require.cache[accessTokenStorePath];
};

test('saves access-token hash and indexes it under its session', async () => {
    const mock = createRedisMock();
    installRedisMock(mock);
    const store = require('../service/accessTokenStore.js');
    const token = createAccessToken('session-A');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenKey = `access_token:${hash}`;

    await store.saveAccessTokenToRedis(token, 'user-1');

    assert.equal(await mock.client.get(tokenKey), 'user-1');
    assert.deepEqual(
        await mock.client.sMembers('session_access_tokens:session-A'),
        [tokenKey]
    );
    assert.ok(mock.values.get(tokenKey).expiresIn > 0);
});

test('removes one access token and its session index member', async () => {
    const mock = createRedisMock();
    installRedisMock(mock);
    const store = require('../service/accessTokenStore.js');
    const token = createAccessToken('session-A');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenKey = `access_token:${hash}`;

    await store.saveAccessTokenToRedis(token, 'user-1');
    await store.removeAccessTokenFromRedis(token);

    assert.equal(await mock.client.get(tokenKey), null);
    assert.deepEqual(await mock.client.sMembers('session_access_tokens:session-A'), []);
});

test('removes every indexed access token for a revoked session only', async () => {
    const mock = createRedisMock();
    installRedisMock(mock);
    const store = require('../service/accessTokenStore.js');
    const tokenA1 = createAccessToken('session-A');
    const tokenA2 = createAccessToken('session-A');
    const tokenB = createAccessToken('session-B');
    const keyFor = token => `access_token:${crypto.createHash('sha256').update(token).digest('hex')}`;

    await store.saveAccessTokenToRedis(tokenA1, 'user-1');
    await store.saveAccessTokenToRedis(tokenA2, 'user-1');
    await store.saveAccessTokenToRedis(tokenB, 'user-1');

    const removed = await store.removeAccessTokensForSession('session-A');

    assert.equal(removed, 2);
    assert.equal(await mock.client.get(keyFor(tokenA1)), null);
    assert.equal(await mock.client.get(keyFor(tokenA2)), null);
    assert.equal(await mock.client.get(keyFor(tokenB)), 'user-1');
    assert.deepEqual(await mock.client.sMembers('session_access_tokens:session-A'), []);
    assert.deepEqual(await mock.client.sMembers('session_access_tokens:session-B'), [keyFor(tokenB)]);
});

test('revoke-other-sessions preserves current session and clears other session tokens', async (t) => {
    const mock = createRedisMock();
    installRedisMock(mock);

    const repositoryCalls = [];
    const sessions = [
        { id: 'current', revoked_at: null },
        { id: 'other-1', revoked_at: null },
        { id: 'already-revoked', revoked_at: new Date() },
        { id: 'other-2', revoked_at: null },
    ];
    const repositoryMock = {
        async findSessionsByUserId(userId) {
            repositoryCalls.push(['list', userId]);
            return sessions;
        },
        async revokeSession(sessionId) {
            repositoryCalls.push(['revoke-session', sessionId]);
        },
        async revokeRefreshTokensBySessionId(sessionId) {
            repositoryCalls.push(['revoke-refresh', sessionId]);
        },
    };

    require.cache[sessionRepositoryPath] = {
        id: sessionRepositoryPath,
        filename: sessionRepositoryPath,
        loaded: true,
        exports: repositoryMock,
    };
    delete require.cache[sessionStorePath];

    const sessionService = require('../service/sessionService.js');
    const currentToken = createAccessToken('current');
    const otherToken1 = createAccessToken('other-1');
    const otherToken2 = createAccessToken('other-2');
    await require('../service/accessTokenStore.js').saveAccessTokenToRedis(currentToken, 'user-1');
    await require('../service/accessTokenStore.js').saveAccessTokenToRedis(otherToken1, 'user-1');
    await require('../service/accessTokenStore.js').saveAccessTokenToRedis(otherToken2, 'user-1');

    const result = await sessionService.revokeOtherSessions('user-1', 'current');

    assert.equal(result.revokedCount, 2);
    assert.deepEqual(
        repositoryCalls.filter(call => call[0] === 'revoke-session').map(call => call[1]),
        ['other-1', 'other-2']
    );
    assert.deepEqual(
        repositoryCalls.filter(call => call[0] === 'revoke-refresh').map(call => call[1]),
        ['other-1', 'other-2']
    );

    const store = require('../service/accessTokenStore.js');
    assert.equal(await mock.client.get(`access_token:${crypto.createHash('sha256').update(currentToken).digest('hex')}`), 'user-1');
    assert.equal(await mock.client.get(`access_token:${crypto.createHash('sha256').update(otherToken1).digest('hex')}`), null);
    assert.equal(await mock.client.get(`access_token:${crypto.createHash('sha256').update(otherToken2).digest('hex')}`), null);
    t.after(() => {
        delete require.cache[sessionRepositoryPath];
        delete require.cache[sessionStorePath];
        delete require.cache[accessTokenStorePath];
        delete require.cache[redisConfigPath];
    });
});
