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


test('notification decision is deduplicated across recipient devices and retries', async () => {
    const oldConnect = pool.connect;
    const records = new Map();
    const calls = [];
    const messageId = 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d';
    const keyFor = (senderId, clientId, recipientDevicePk) => `${senderId}:${clientId}:${recipientDevicePk}`;
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\\s+/g, ' ').trim();
            calls.push({ statement, params });
            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT 1 FROM conversation_members')) return { rows: [{}], rowCount: 1 };
            if (statement.includes('AS ready')) return { rows: [{ ready: true }], rowCount: 1 };
            if (statement.startsWith('SELECT 1 FROM conversation_e2ee_settings')) return { rows: [{}], rowCount: 1 };
            if (statement.startsWith('SELECT * FROM e2ee_sdk_devices')) {
                const [userId, deviceId] = params;
                return { rows: [{ id: Number(userId) * 10 + Number(deviceId), user_id: userId, device_id: deviceId, registration_id: 7 }], rowCount: 1 };
            }
            if (statement.startsWith('SELECT id, server_timestamp_ms FROM e2ee_sdk_envelopes')) {
                const record = records.get(keyFor(params[0], params[1], params[2]));
                return { rows: record ? [{ id: record.id, server_timestamp_ms: record.serverTimestamp }] : [], rowCount: record ? 1 : 0 };
            }
            if (statement.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}], rowCount: 1 };
            if (statement.startsWith('SELECT 1 FROM e2ee_sdk_envelopes')) {
                const found = [...records.values()].some(record =>
                    String(record.senderId) === String(params[0]) &&
                    record.clientMessageId === params[1] &&
                    String(record.recipientUserId) === String(params[2]));
                return { rows: found ? [{}] : [], rowCount: found ? 1 : 0 };
            }
            if (statement.startsWith('INSERT INTO e2ee_sdk_envelopes')) {
                const [id, conversationId, senderId, senderDevicePk, recipientUserId, recipientDevicePk, clientMessageId, , , deliveryClass, contentKind, , , , serverTimestamp] = params;
                const record = { id, conversationId, senderId, senderDevicePk, recipientUserId, recipientDevicePk, clientMessageId, deliveryClass, contentKind, serverTimestamp };
                records.set(keyFor(senderId, clientMessageId, recipientDevicePk), record);
                return { rows: [{ id, server_timestamp_ms: serverTimestamp, expires_at: null }], rowCount: 1 };
            }
            throw new Error(`Unexpected SQL in test: ${statement}`);
        },
        release() {}
    };
    pool.connect = async () => client;
    const payload = targetDeviceId => ({
        targetUserId: 22,
        targetDeviceId,
        senderDeviceId: 1,
        ciphertext: 'Y2lwaGVydGV4dA==',
        messageType: 'ciphertext',
        deliveryClass: 'user-visible',
        contentKind: 'message',
        timestamp: Date.now(),
        clientMessageId: messageId
    });
    try {
        const firstDevice = await repository.sendEnvelope(11, 99, payload(1));
        const secondDevice = await repository.sendEnvelope(11, 99, payload(2));
        const retry = await repository.sendEnvelope(11, 99, payload(1));

        assert.equal(firstDevice.notifyRecipient, true);
        assert.equal(secondDevice.notifyRecipient, false);
        assert.equal(retry.duplicate, true);
        assert.equal(retry.notifyRecipient, false);
        assert.equal(records.size, 2);
        assert.equal(calls.filter(call => call.statement.startsWith('SELECT pg_advisory_xact_lock')).length, 2);
    } finally {
        pool.connect = oldConnect;
    }
});
