const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/config/database');
const authRepository = require('../repository/authRepository');

const withMockQuery = async (handler, run) => {
    const originalQuery = pool.query;
    const calls = [];
    pool.query = async (sql, params = []) => {
        const statement = sql.replace(/\s+/g, ' ').trim();
        calls.push({ statement, params });
        return handler(statement, params, calls);
    };
    try {
        return await run(calls);
    } finally {
        pool.query = originalQuery;
    }
};

test('password login session creation locks and rechecks the active account in the insert statement', async () => {
    await withMockQuery(async (sql, params) => {
        assert.match(params[0], /^[0-9a-f-]{36}$/i);
        assert.deepEqual(params.slice(1), [17, 'Chrome', 'test-agent', '127.0.0.1']);
        assert.match(sql, /WITH active_user AS/);
        assert.match(sql, /WHERE id = \$2 AND is_active = TRUE FOR UPDATE/);
        assert.match(sql, /INSERT INTO sessions/);
        assert.match(sql, /SELECT \$1, id, \$3, \$4, \$5 FROM active_user/);
        return {
            rows: [{ id: params[0], user_id: 17 }],
            rowCount: 1
        };
    }, async calls => {
        const session = await authRepository.createSessionForActiveUser(
            17, 'Chrome', 'test-agent', '127.0.0.1'
        );
        assert.match(session.id, /^[0-9a-f-]{36}$/i);
        assert.equal(calls.length, 1);
    });
});

test('password login session creation returns null when the account is disabled', async () => {
    await withMockQuery(async (sql, params) => {
        assert.match(sql, /is_active = TRUE/);
        assert.match(params[0], /^[0-9a-f-]{36}$/i);
        assert.deepEqual(params.slice(1), [17, 'Chrome', 'test-agent', '127.0.0.1']);
        return { rows: [], rowCount: 0 };
    }, async () => {
        const session = await authRepository.createSessionForActiveUser(
            17, 'Chrome', 'test-agent', '127.0.0.1'
        );
        assert.equal(session, null);
    });
});


test('password session issuance compares the exact hash verified before the database lock', async () => {
    await withMockQuery(async (sql, params) => {
        assert.match(params[0], /^[0-9a-f-]{36}$/i);
        assert.deepEqual(params.slice(1), [
            17, 'Chrome', 'test-agent', '127.0.0.1', '$2b$12$verified-hash'
        ]);
        assert.match(sql, /is_active = TRUE/);
        assert.match(sql, /password_hash = \$6/);
        assert.match(sql, /FOR UPDATE/);
        return { rows: [{ id: params[0], user_id: 17 }], rowCount: 1 };
    }, async () => {
        const session = await authRepository.createSessionForVerifiedPassword(
            17, '$2b$12$verified-hash', 'Chrome', 'test-agent', '127.0.0.1'
        );
        assert.ok(session);
        assert.match(session.id, /^[0-9a-f-]{36}$/i);
    });
});

test('password session issuance refuses a missing verified password hash without touching the database', async () => {
    await withMockQuery(async () => {
        throw new Error('Database must not be queried without a verified password hash');
    }, async calls => {
        const session = await authRepository.createSessionForVerifiedPassword(
            17, null, 'Chrome', 'test-agent', '127.0.0.1'
        );
        assert.equal(session, null);
        assert.equal(calls.length, 0);
    });
});
