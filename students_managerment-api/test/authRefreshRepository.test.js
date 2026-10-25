const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/config/database');
const authRepository = require('../repository/authRepository');

const withMockClient = async (handler, run) => {
    const originalConnect = pool.connect;
    const calls = [];
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\\s+/g, ' ').trim();
            calls.push({ statement, params });
            return handler(statement, params, calls);
        },
        release() {
            calls.push({ statement: 'RELEASE', params: [] });
        }
    };

    pool.connect = async () => client;
    try {
        return await run(calls);
    } finally {
        pool.connect = originalConnect;
    }
};

test('refresh rotation locks active session before consuming token and commits replacement atomically', async () => {
    await withMockClient(async (sql) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rows: [], rowCount: 0 };
        }
        if (sql.startsWith('SELECT id FROM sessions')) {
            return { rows: [{ id: 'session-1' }], rowCount: 1 };
        }
        if (sql.startsWith('UPDATE refresh_tokens SET revoked_at')) {
            return { rows: [{ id: 10 }], rowCount: 1 };
        }
        if (sql.startsWith('INSERT INTO refresh_tokens')) {
            return { rows: [{ id: 11, user_id: 7, session_id: 'session-1' }], rowCount: 1 };
        }
        if (sql.startsWith('UPDATE sessions SET last_used_at')) {
            return { rows: [], rowCount: 1 };
        }
        throw new Error('Unexpected SQL: ' + sql);
    }, async (calls) => {
        const result = await authRepository.rotateRefreshToken(
            10, 7, 'session-1', 'replacement-hash', new Date('2030-01-01T00:00:00Z')
        );

        assert.equal(result.id, 11);
        assert.equal(calls[0].statement, 'BEGIN');
        const sessionLockIndex = calls.findIndex(call => call.statement.startsWith('SELECT id FROM sessions'));
        const consumeIndex = calls.findIndex(call => call.statement.startsWith('UPDATE refresh_tokens SET revoked_at'));
        const insertIndex = calls.findIndex(call => call.statement.startsWith('INSERT INTO refresh_tokens'));
        assert.ok(sessionLockIndex > 0);
        assert.ok(calls[sessionLockIndex].statement.includes('FOR UPDATE'));
        assert.ok(consumeIndex > sessionLockIndex);
        assert.ok(insertIndex > consumeIndex);
        assert.equal(calls.at(-2).statement, 'COMMIT');
        assert.equal(calls.at(-1).statement, 'RELEASE');
    });
});

test('refresh rotation rolls back and does not consume a token when its session is inactive', async () => {
    await withMockClient(async (sql) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
        if (sql.startsWith('SELECT id FROM sessions')) return { rows: [], rowCount: 0 };
        throw new Error('Token must not be touched for inactive session: ' + sql);
    }, async (calls) => {
        const result = await authRepository.rotateRefreshToken(
            10, 7, 'session-revoked', 'replacement-hash', new Date()
        );
        assert.equal(result, null);
        assert.equal(calls.at(-2).statement, 'ROLLBACK');
        assert.equal(calls.at(-1).statement, 'RELEASE');
        assert.equal(calls.some(call => call.statement.startsWith('UPDATE refresh_tokens')), false);
        assert.equal(calls.some(call => call.statement.startsWith('INSERT INTO refresh_tokens')), false);
    });
});

test('refresh-token replay revokes only the matching active session after locking it first', async () => {
    await withMockClient(async (sql) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rows: [], rowCount: 0 };
        }
        if (sql.startsWith('SELECT id FROM sessions')) return { rows: [{ id: 'session-1' }], rowCount: 1 };
        if (sql.startsWith('SELECT id FROM refresh_tokens')) return { rows: [{ id: 10 }], rowCount: 1 };
        if (sql.startsWith('UPDATE sessions SET revoked_at')) return { rows: [{ id: 'session-1' }], rowCount: 1 };
        if (sql.startsWith('UPDATE refresh_tokens SET revoked_at')) return { rows: [], rowCount: 4 };
        throw new Error('Unexpected SQL: ' + sql);
    }, async (calls) => {
        const result = await authRepository.revokeSessionOnRefreshTokenReuse(
            'old-token-hash', 7, 'session-1'
        );

        assert.deepEqual(result, { id: 'session-1' });
        const sessionLockIndex = calls.findIndex(call => call.statement.startsWith('SELECT id FROM sessions'));
        const replayLookupIndex = calls.findIndex(call => call.statement.startsWith('SELECT id FROM refresh_tokens'));
        const revokeSessionIndex = calls.findIndex(call => call.statement.startsWith('UPDATE sessions SET revoked_at'));
        const revokeTokensIndex = calls.findIndex(call => call.statement.startsWith('UPDATE refresh_tokens SET revoked_at'));
        assert.ok(sessionLockIndex > 0);
        assert.ok(calls[sessionLockIndex].statement.includes('FOR UPDATE'));
        assert.ok(replayLookupIndex > sessionLockIndex);
        assert.ok(calls[replayLookupIndex].statement.includes('revoked_at IS NOT NULL'));
        assert.ok(calls[replayLookupIndex].statement.includes('expires_at > CURRENT_TIMESTAMP'));
        assert.ok(revokeSessionIndex > replayLookupIndex);
        assert.ok(revokeTokensIndex > revokeSessionIndex);
        assert.equal(calls.at(-2).statement, 'COMMIT');
    });
});

test('refresh-token replay transaction rolls back when the token does not belong to the active session', async () => {
    await withMockClient(async (sql) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
        if (sql.startsWith('SELECT id FROM sessions')) return { rows: [{ id: 'session-1' }], rowCount: 1 };
        if (sql.startsWith('SELECT id FROM refresh_tokens')) return { rows: [], rowCount: 0 };
        throw new Error('Session must not be revoked for a non-matching token: ' + sql);
    }, async (calls) => {
        const result = await authRepository.revokeSessionOnRefreshTokenReuse(
            'unrelated-token-hash', 7, 'session-1'
        );
        assert.equal(result, null);
        assert.equal(calls.at(-2).statement, 'ROLLBACK');
        assert.equal(calls.some(call => call.statement.startsWith('UPDATE sessions SET revoked_at')), false);
        assert.equal(calls.some(call => call.statement.startsWith('UPDATE refresh_tokens SET revoked_at')), false);
    });
});
