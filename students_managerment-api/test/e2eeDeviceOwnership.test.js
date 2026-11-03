const test = require('node:test');
const assert = require('node:assert/strict');

const databaseModulePath = require.resolve('../src/config/database');
const repositoryModulePath = require.resolve('../repository/e2eeRepository');

const calls = [];
let responses = [];
const fakePool = {
    query: async (sql, values = []) => {
        calls.push({ sql: String(sql), values });
        if (responses.length === 0) throw new Error('Unexpected database query in test');
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
    }
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

test('device listing is scoped to the requested owner and excludes revoked devices', async () => {
    setup({ rows: [{ user_id: 42, device_id: 'device-a' }] });

    const result = await repository.listDevicesForUser(42);

    assert.deepEqual(result, [{ user_id: 42, device_id: 'device-a' }]);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /WHERE user_id = \$1 AND revoked_at IS NULL/);
    assert.deepEqual(calls[0].values, [42]);
});

test('device revocation requires both owner ID and device ID', async () => {
    setup({ rows: [] });

    const result = await repository.revokeDevice(42, 'device-owned-by-another-user');

    assert.equal(result, null);
    assert.match(calls[0].sql, /WHERE user_id = \$1 AND device_id = \$2 AND revoked_at IS NULL/);
    assert.deepEqual(calls[0].values, [42, 'device-owned-by-another-user']);
});

test('conversation device bundles deny non-members before reading device keys', async () => {
    setup({ rows: [], rowCount: 0 });

    await assert.rejects(
        repository.getConversationDeviceBundles(90, 42),
        error => error.statusCode === 403
    );

    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /conversation_id = \$1 AND user_id = \$2 AND left_at IS NULL/);
    assert.deepEqual(calls[0].values, [90, 42]);
});

test('conversation device bundles only include active devices of active members', async () => {
    setup(
        { rows: [{ '?column?': 1 }], rowCount: 1 },
        { rows: [{
            user_id: 22,
            device_id: 'device-b',
            device_name: 'Phone',
            identity_key_public: 'identity-public',
            signed_prekey_public: 'signed-prekey',
            signed_prekey_signature: 'signature',
            signed_prekey_id: 7,
            registration_id: 8
        }] }
    );

    const result = await repository.getConversationDeviceBundles(90, 42);

    assert.deepEqual(result, [{
        userId: 22,
        deviceId: 'device-b',
        deviceName: 'Phone',
        identityKeyPublic: 'identity-public',
        signedPrekey: { id: 7, publicKey: 'signed-prekey', signature: 'signature' },
        registrationId: 8
    }]);
    assert.equal(calls.length, 2);
    assert.match(calls[1].sql, /cm\.conversation_id = \$1/);
    assert.match(calls[1].sql, /cm\.left_at IS NULL/);
    assert.match(calls[1].sql, /d\.revoked_at IS NULL/);
    assert.deepEqual(calls[1].values, [90]);
});
