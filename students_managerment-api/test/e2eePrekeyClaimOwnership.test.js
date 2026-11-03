const test = require('node:test');
const assert = require('node:assert/strict');

const databaseModulePath = require.resolve('../src/config/database');
const repositoryModulePath = require.resolve('../repository/e2eeRepository');

const calls = [];
let responses = [];
const fakeClient = {
    query: async (sql, values = []) => {
        const normalized = String(sql).trim();
        calls.push({ sql: normalized, values });
        if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(normalized)) return { rows: [], rowCount: 0 };
        if (responses.length === 0) throw new Error('Unexpected database query in test');
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
    },
    release: () => { calls.push({ sql: 'RELEASE', values: [] }); }
};
const fakePool = {
    connect: async () => fakeClient,
    query: async () => { throw new Error('Unexpected pool-level query'); }
};

require.cache[databaseModulePath] = {
    id: databaseModulePath,
    filename: databaseModulePath,
    loaded: true,
    exports: fakePool
};
delete require.cache[repositoryModulePath];
const repository = require('../repository/e2eeRepository');

const setup = (...nextResponses) => {
    calls.length = 0;
    responses = [...nextResponses];
};
const ok = (rows = []) => ({ rows, rowCount: rows.length });

test('prekey claim rejects a requester who is not an active conversation member', async () => {
    setup(ok());

    await assert.rejects(
        repository.claimConversationDevicePrekey(90, 42, 22, 'device-b'),
        error => error.statusCode === 403
    );

    assert.equal(calls.filter(call => call.sql.includes('SELECT')).length, 1);
    assert.match(calls[0].sql, /conversation_id = \$1 AND user_id = \$2 AND left_at IS NULL/);
    assert.deepEqual(calls[0].values, [90, 42]);
    assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
});

test('prekey claim constrains the target device to the conversation, target user, and active device', async () => {
    setup(
        ok([{ '?column?': 1 }]),
        ok()
    );

    await assert.rejects(
        repository.claimConversationDevicePrekey(90, 42, 22, 'device-owned-elsewhere'),
        error => error.statusCode === 404
    );

    assert.equal(calls.filter(call => call.sql.includes('SELECT')).length, 2);
    assert.match(calls[1].sql, /cm\.conversation_id = \$1/);
    assert.match(calls[1].sql, /d\.user_id = \$2/);
    assert.match(calls[1].sql, /d\.device_id = \$3/);
    assert.match(calls[1].sql, /cm\.left_at IS NULL/);
    assert.match(calls[1].sql, /d\.revoked_at IS NULL/);
    assert.deepEqual(calls[1].values, [90, 22, 'device-owned-elsewhere']);
    assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
});

test('prekey claim atomically consumes only an unclaimed key for the authorized device', async () => {
    setup(
        ok([{ '?column?': 1 }]),
        ok([{ id: 501 }]),
        ok([{ id: 700, prekey_id: 17, public_key: 'one-time-public-key' }]),
        ok([{ prekey_id: 17, public_key: 'one-time-public-key' }])
    );

    const result = await repository.claimConversationDevicePrekey(90, 42, 22, 'device-b');

    assert.deepEqual(result, { id: 17, publicKey: 'one-time-public-key' });
    assert.match(calls[2].sql, /device_pk = \$1 AND claimed_at IS NULL/);
    assert.match(calls[2].sql, /FOR UPDATE SKIP LOCKED/);
    assert.deepEqual(calls[2].values, [501]);
    assert.match(calls[3].sql, /WHERE id = \$1 AND claimed_at IS NULL/);
    assert.deepEqual(calls[3].values, [700]);
    assert.ok(calls.some(call => call.sql === 'COMMIT'));
    assert.ok(calls.some(call => call.sql === 'RELEASE'));
});

test('prekey claim returns null when the authorized device has no available one-time prekey', async () => {
    setup(
        ok([{ '?column?': 1 }]),
        ok([{ id: 501 }]),
        ok()
    );

    const result = await repository.claimConversationDevicePrekey(90, 42, 22, 'device-b');

    assert.equal(result, null);
    assert.equal(calls.filter(call => call.sql.includes('UPDATE e2ee_one_time_prekeys')).length, 0);
    assert.ok(calls.some(call => call.sql === 'COMMIT'));
});
