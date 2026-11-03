const test = require('node:test');
const assert = require('node:assert/strict');

const databaseModulePath = require.resolve('../src/config/database');
const repositoryModulePath = require.resolve('../repository/callRepository');

const calls = [];
let nextResult;
const fakePool = {
    query: async (sql, values = []) => {
        calls.push({ sql: String(sql), values });
        if (!nextResult) throw new Error('Unexpected database query in test');
        const result = nextResult;
        nextResult = null;
        return result;
    }
};

require.cache[databaseModulePath] = {
    id: databaseModulePath,
    filename: databaseModulePath,
    loaded: true,
    exports: fakePool
};
delete require.cache[repositoryModulePath];
const repository = require('../repository/callRepository');

const setup = (result = { rows: [] }) => {
    calls.length = 0;
    nextResult = result;
};

test('call history is restricted to calls involving the authenticated user and excludes only their hidden rows', async () => {
    setup({ rows: [{ call_id: 'call-a' }] });

    const result = await repository.getCallHistory(42, 20, 5, 9);

    assert.deepEqual(result, [{ call_id: 'call-a' }]);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /ch\.caller_id = \$1 OR ch\.receiver_id = \$1/);
    assert.match(calls[0].sql, /hidden\.user_id = \$1/);
    assert.match(calls[0].sql, /ch\.conversation_id = \$4/);
    assert.deepEqual(calls[0].values, [42, 20, 5, 9]);
});

test('hiding a call history row requires the authenticated user to be a participant', async () => {
    setup({ rows: [{ user_id: 42 }] });

    const result = await repository.hideCallHistoryForUser(42, 'call-a');

    assert.equal(result, true);
    assert.match(calls[0].sql, /ch\.call_id = \$2/);
    assert.match(calls[0].sql, /ch\.caller_id = \$1 OR ch\.receiver_id = \$1/);
    assert.deepEqual(calls[0].values, [42, 'call-a']);
});

test('marking a call notification read is scoped to both notification and owner', async () => {
    setup({ rows: [] });

    const result = await repository.markCallNotificationRead(101, 42);

    assert.equal(result, null);
    assert.match(calls[0].sql, /WHERE id = \$1 AND user_id = \$2/);
    assert.deepEqual(calls[0].values, [101, 42]);
});
