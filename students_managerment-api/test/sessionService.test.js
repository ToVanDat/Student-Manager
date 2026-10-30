const test = require('node:test');
const assert = require('node:assert/strict');

const authRepository = require('../repository/authRepository');
const accessTokenStore = require('../service/accessTokenStore');
const sessionService = require('../service/sessionService');

const withOverrides = async (overrides, run) => {
    const originals = {};
    for (const [target, values] of Object.entries(overrides)) {
        originals[target] = {};
        for (const [key, value] of Object.entries(values)) {
            originals[target][key] = target === 'repository'
                ? authRepository[key]
                : accessTokenStore[key];
            if (target === 'repository') authRepository[key] = value;
            else accessTokenStore[key] = value;
        }
    }
    try {
        await run();
    } finally {
        for (const [target, values] of Object.entries(originals)) {
            for (const [key, value] of Object.entries(values)) {
                if (target === 'repository') authRepository[key] = value;
                else accessTokenStore[key] = value;
            }
        }
    }
};

test('revoking an already-revoked session is idempotent and skips Redis cleanup', async () => {
    let cleanupCalls = 0;
    await withOverrides({
        repository: {
            findSessionByIdAndUserId: async () => ({ id: 's-1', revoked_at: new Date() }),
            revokeSessionForUserAndRefreshTokens: async () => {
                throw new Error('must not issue a second database revoke');
            }
        },
        accessTokenStore: {
            removeAccessTokensForSession: async () => { cleanupCalls += 1; }
        }
    }, async () => {
        const result = await sessionService.revokeSession('s-1', 7);
        assert.equal(result.alreadyRevoked, true);
        assert.equal(result.session.id, 's-1');
        assert.equal(cleanupCalls, 0);
    });
});

test('concurrent single-session revocation returns the latest state without repeating cleanup', async () => {
    let cleanupCalls = 0;
    await withOverrides({
        repository: {
            findSessionByIdAndUserId: async () => ({ id: 's-1', revoked_at: null }),
            revokeSessionForUserAndRefreshTokens: async () => null
        },
        accessTokenStore: {
            removeAccessTokensForSession: async () => { cleanupCalls += 1; }
        }
    }, async () => {
        const result = await sessionService.revokeSession('s-1', 7);
        assert.equal(result.alreadyRevoked, true);
        assert.equal(result.session.id, 's-1');
        assert.equal(cleanupCalls, 0);
    });
});

test('revoking other sessions delegates one atomic bulk operation and reports the affected count', async () => {
    let repositoryCalls = 0;
    let cleanupCalls = [];
    await withOverrides({
        repository: {
            revokeOtherSessionsAndRefreshTokens: async (userId, currentSessionId) => {
                repositoryCalls += 1;
                assert.equal(userId, 7);
                assert.equal(currentSessionId, 'current');
                return [];
            }
        },
        accessTokenStore: {
            removeAccessTokensForSession: async id => cleanupCalls.push(id)
        }
    }, async () => {
        const result = await sessionService.revokeOtherSessions(7, 'current');
        assert.deepEqual(result, { revokedCount: 0 });
        assert.equal(repositoryCalls, 1);
        assert.deepEqual(cleanupCalls, []);
    });
});


test('successful single-session revocation clears the access-token cache after the database commit', async () => {
    const cleanupCalls = [];
    await withOverrides({
        repository: {
            findSessionByIdAndUserId: async () => ({ id: 's-2', revoked_at: null }),
            revokeSessionForUserAndRefreshTokens: async () => ({
                id: 's-2',
                user_id: 7,
                revoked_at: new Date()
            })
        },
        accessTokenStore: {
            removeAccessTokensForSession: async id => cleanupCalls.push(id)
        }
    }, async () => {
        const result = await sessionService.revokeSession('s-2', 7);
        assert.equal(result.alreadyRevoked, false);
        assert.equal(result.session.id, 's-2');
        assert.deepEqual(cleanupCalls, ['s-2']);
    });
});

test('successful bulk revocation attempts access-token cleanup for every revoked session', async () => {
    const cleanupCalls = [];
    await withOverrides({
        repository: {
            revokeOtherSessionsAndRefreshTokens: async () => [
                { id: 's-old-1' },
                { id: 's-old-2' }
            ]
        },
        accessTokenStore: {
            removeAccessTokensForSession: async id => cleanupCalls.push(id)
        }
    }, async () => {
        const result = await sessionService.revokeOtherSessions(7, 'current');
        assert.deepEqual(result, { revokedCount: 2 });
        assert.deepEqual(cleanupCalls, ['s-old-1', 's-old-2']);
    });
});
