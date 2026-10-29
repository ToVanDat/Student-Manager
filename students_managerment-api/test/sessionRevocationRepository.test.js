const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/config/database');
const authRepository = require('../repository/authRepository');

const withMockQuery = async (handler, run) => {
    const originalQuery = pool.query;
    const calls = [];
    pool.query = async (sql, params = []) => {
        const statement = sql.replace(/\\s+/g, ' ').trim();
        calls.push({ statement, params });
        return handler(statement, params, calls);
    };

    try {
        return await run(calls);
    } finally {
        pool.query = originalQuery;
    }
};

test('single-session revocation scopes the session by both session ID and owner, then revokes its refresh tokens in the same statement', async () => {
    await withMockQuery(async (sql, params) => {
        assert.deepEqual(params, ['session-1', 42]);
        assert.match(sql, /^WITH revoked_session AS/);
        assert.match(sql, /UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP/);
        assert.match(sql, /WHERE id = \$1 AND user_id = \$2 AND revoked_at IS NULL/);
        assert.match(sql, /UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP/);
        assert.match(sql, /session_id IN \(SELECT id FROM revoked_session\)/);
        assert.match(sql, /revoked_at IS NULL/);
        return { rows: [{ id: 'session-1', user_id: 42, revoked_at: new Date() }], rowCount: 1 };
    }, async () => {
        const result = await authRepository.revokeSessionForUserAndRefreshTokens('session-1', 42);
        assert.equal(result.id, 'session-1');
        assert.equal(result.user_id, 42);
    });
});

test('bulk session revocation preserves the current session and scopes all revoked rows to the user', async () => {
    await withMockQuery(async (sql, params) => {
        assert.deepEqual(params, [42, 'current-session']);
        assert.match(sql, /^WITH revoked_sessions AS/);
        assert.match(sql, /WHERE user_id = \$1 AND id <> \$2 AND revoked_at IS NULL/);
        assert.match(sql, /UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP/);
        assert.match(sql, /session_id IN \(SELECT id FROM revoked_sessions\)/);
        return { rows: [{ id: 'other-1' }, { id: 'other-2' }], rowCount: 2 };
    }, async () => {
        const result = await authRepository.revokeOtherSessionsAndRefreshTokens(42, 'current-session');
        assert.deepEqual(result.map(row => row.id), ['other-1', 'other-2']);
    });
});

test('single-session revocation returns null when the session is already revoked or is not owned by the user', async () => {
    await withMockQuery(async () => ({ rows: [], rowCount: 0 }), async () => {
        const result = await authRepository.revokeSessionForUserAndRefreshTokens('foreign-session', 42);
        assert.equal(result, null);
    });
});
