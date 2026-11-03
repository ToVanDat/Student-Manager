const test = require('node:test');
const assert = require('node:assert/strict');

const databaseModulePath = require.resolve('../src/config/database');
const middlewareModulePath = require.resolve('../middleware/permissionMiddleware');

const calls = [];
let queryResult;
let queryError;
const fakePool = {
    query: async (sql, values = []) => {
        calls.push({ sql: String(sql), values });
        if (queryError) throw queryError;
        return queryResult;
    }
};

require.cache[databaseModulePath] = {
    id: databaseModulePath,
    filename: databaseModulePath,
    loaded: true,
    exports: fakePool
};
delete require.cache[middlewareModulePath];
const requirePermission = require('../middleware/permissionMiddleware');

const setup = ({ rows = [], error = null } = {}) => {
    calls.length = 0;
    queryResult = { rows };
    queryError = error;
};

const invoke = async user => {
    let statusCode = 200;
    let responseBody = null;
    let nextCalled = false;
    let nextError = null;
    const req = { user };
    const res = {
        status(code) { statusCode = code; return this; },
        json(body) { responseBody = body; return this; }
    };
    await requirePermission('students.view')(req, res, error => {
        nextCalled = true;
        nextError = error || null;
    });
    return { statusCode, responseBody, nextCalled, nextError };
};

test('permission middleware rejects unauthenticated requests without querying grants', async () => {
    setup();
    const result = await invoke(undefined);
    assert.equal(result.statusCode, 401);
    assert.equal(result.nextCalled, false);
    assert.equal(calls.length, 0);
});

test('permission middleware allows only an explicit true grant for the authenticated role', async () => {
    setup({ rows: [{ allowed: true }] });
    const result = await invoke({ id: 7, role: 'user' });
    assert.equal(result.nextCalled, true);
    assert.equal(result.nextError, null);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /WHERE role = \$1 AND permission_key = \$2/);
    assert.deepEqual(calls[0].values, ['user', 'students.view']);
});

test('missing or false permission grants are denied', async () => {
    for (const rows of [[], [{ allowed: false }], [{ allowed: null }]]) {
        setup({ rows });
        const result = await invoke({ id: 7, role: 'user' });
        assert.equal(result.statusCode, 403);
        assert.equal(result.nextCalled, false);
        assert.equal(result.responseBody.permission, 'students.view');
    }
});

test('permission database failures are forwarded and never grant access', async () => {
    const databaseError = new Error('permission database unavailable');
    setup({ error: databaseError });
    const result = await invoke({ id: 7, role: 'admin' });
    assert.equal(result.nextCalled, true);
    assert.equal(result.nextError, databaseError);
    assert.equal(result.statusCode, 200);
    assert.equal(result.responseBody, null);
});
