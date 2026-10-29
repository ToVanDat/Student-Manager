const test = require('node:test');
const assert = require('node:assert/strict');
const { isSocketSessionActive } = require('../service/socketSessionGuard');

test('accepts an active session owned by an active account', async () => {
    const calls = [];
    const repository = {
        async findSessionByIdAndUserId(sessionId, userId) {
            calls.push(['session', sessionId, userId]);
            return { id: sessionId, user_id: userId, revoked_at: null };
        },
        async findUserById(userId) {
            calls.push(['user', userId]);
            return { id: userId, is_active: true };
        }
    };
    assert.equal(await isSocketSessionActive(repository, 's-1', 7), true);
    assert.deepEqual(calls, [['session', 's-1', 7], ['user', 7]]);
});

test('rejects a revoked or missing session without relying on cached socket claims', async () => {
    let userLookups = 0;
    const repository = {
        async findSessionByIdAndUserId() {
            return { id: 's-1', revoked_at: new Date() };
        },
        async findUserById() {
            userLookups += 1;
            return { id: 7, is_active: true };
        }
    };
    assert.equal(await isSocketSessionActive(repository, 's-1', 7), false);
    assert.equal(userLookups, 0);
});

test('rejects sessions belonging to disabled or deleted accounts', async () => {
    for (const user of [null, { id: 7, is_active: false }]) {
        const repository = {
            async findSessionByIdAndUserId() {
                return { id: 's-1', revoked_at: null };
            },
            async findUserById() {
                return user;
            }
        };
        assert.equal(await isSocketSessionActive(repository, 's-1', 7), false);
    }
});

test('propagates database failures so the Socket.IO caller can fail closed', async () => {
    const repository = {
        async findSessionByIdAndUserId() {
            throw new Error('database unavailable');
        },
        async findUserById() {
            assert.fail('user lookup must not run after session lookup fails');
        }
    };
    await assert.rejects(
        isSocketSessionActive(repository, 's-1', 7),
        /database unavailable/
    );
});
