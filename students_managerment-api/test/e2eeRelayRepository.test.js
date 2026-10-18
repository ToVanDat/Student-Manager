const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/config/database');
const repository = require('../repository/e2eeRelayRepository');

test('device revocation removes pending mailbox/prekeys and revokes the device in one transaction', async () => {
    const oldConnect = pool.connect;
    const calls = [];
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            calls.push({ statement, params });
            if (statement.startsWith('BEGIN') || statement.startsWith('COMMIT') || statement.startsWith('ROLLBACK')) {
                return { rows: [], rowCount: 0 };
            }
            if (statement.startsWith('SELECT id FROM e2ee_sdk_devices')) {
                return { rows: [{ id: 12 }], rowCount: 1 };
            }
            if (statement.startsWith('UPDATE e2ee_sdk_devices SET revoked_at')) {
                return { rows: [{ id: 12, device_id: 2 }], rowCount: 1 };
            }
            return { rows: [], rowCount: 2 };
        },
        release() { calls.push({ statement: 'RELEASE', params: [] }); }
    };
    pool.connect = async () => client;
    try {
        assert.deepEqual(await repository.removeDevice(44, 2), { deviceId: 2 });
        assert.equal(calls[0].statement, 'BEGIN');
        assert.ok(calls.some(call => call.statement.startsWith('DELETE FROM e2ee_sdk_envelopes') &&
            call.statement.includes('acknowledged_at IS NULL')));
        assert.ok(calls.some(call => call.statement.startsWith('DELETE FROM e2ee_sdk_prekeys')));
        assert.ok(calls.some(call => call.statement.startsWith('UPDATE e2ee_sdk_devices SET revoked_at') &&
            call.statement.includes('enabled = FALSE')));
        assert.equal(calls.at(-2).statement, 'COMMIT');
    } finally {
        pool.connect = oldConnect;
    }
});

test('mailbox pull is scoped to the active recipient device and excludes acknowledged/expired envelopes', async () => {
    const oldQuery = pool.query;
    const calls = [];
    pool.query = async (sql, params = []) => {
        const statement = sql.replace(/\s+/g, ' ').trim();
        calls.push({ statement, params });
        if (statement.startsWith('SELECT * FROM e2ee_sdk_devices')) {
            return { rows: [{ id: 91, user_id: 44, device_id: 2 }], rowCount: 1 };
        }
        return {
            rows: [{
                id: 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d',
                sender_user_id: 33,
                sender_device_id: 1,
                ciphertext: 'Y2lwaGVydGV4dA==',
                message_type: 'ciphertext',
                delivery_class: 'user-visible',
                content_kind: 'message',
                client_timestamp_ms: 100,
                operation_epoch_ms: null,
                server_timestamp_ms: 200,
                client_message_id: 'd7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d',
                recipient_registration_id: null
            }],
            rowCount: 1
        };
    };
    try {
        const envelopes = await repository.pullEnvelopes(44, 2, 500);
        assert.equal(envelopes.length, 1);
        assert.equal(envelopes[0].targetUserId, '44');
        assert.equal(envelopes[0].targetDeviceId, 2);
        const mailboxQuery = calls[1];
        assert.ok(mailboxQuery.statement.includes('e.recipient_device_pk = $1'));
        assert.ok(mailboxQuery.statement.includes('e.acknowledged_at IS NULL'));
        assert.ok(mailboxQuery.statement.includes('e.expires_at IS NULL OR e.expires_at > NOW()'));
        assert.deepEqual(mailboxQuery.params, [91, 200]);
    } finally {
        pool.query = oldQuery;
    }
});

test('mailbox acknowledgement is idempotent and bound to the requested user/device', async () => {
    const oldQuery = pool.query;
    let observed;
    pool.query = async (sql, params = []) => {
        observed = { statement: sql.replace(/\s+/g, ' ').trim(), params };
        return { rows: [{ id: params[0] }], rowCount: 1 };
    };
    try {
        const id = 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d';
        assert.deepEqual(await repository.markDelivered(44, 2, id), { id, acknowledged: true });
        assert.ok(observed.statement.includes('acknowledged_at = COALESCE(acknowledged_at, NOW())'));
        assert.ok(observed.statement.includes('d.user_id = $2 AND d.device_id = $3'));
        assert.deepEqual(observed.params, [id, 44, 2]);
    } finally {
        pool.query = oldQuery;
    }
});
