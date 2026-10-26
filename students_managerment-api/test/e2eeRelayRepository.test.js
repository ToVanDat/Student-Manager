const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

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
            const statement = sql.replace(/\s+/g, ' ').trim();
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


test('revoked device credentials cannot authenticate, pull mailbox or acknowledge envelopes', async t => {
    const oldConnect = pool.connect;
    const oldQuery = pool.query;
    let revoked = false;
    const transactionCalls = [];
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            transactionCalls.push({ statement, params });
            if (statement === 'BEGIN' || statement === 'COMMIT' || statement === 'ROLLBACK') {
                return { rows: [], rowCount: 0 };
            }
            if (statement.startsWith('SELECT id FROM e2ee_sdk_devices')) {
                return { rows: revoked ? [] : [{ id: 12 }], rowCount: revoked ? 0 : 1 };
            }
            if (statement.startsWith('UPDATE e2ee_sdk_devices SET revoked_at')) {
                revoked = true;
                return { rows: [{ id: 12, device_id: 2 }], rowCount: 1 };
            }
            return { rows: [], rowCount: 1 };
        },
        release() {}
    };
    pool.connect = async () => client;
    pool.query = async (sql, params = []) => {
        const statement = sql.replace(/\s+/g, ' ').trim();
        if (statement.startsWith('SELECT id, user_id, device_id, registration_id FROM e2ee_sdk_devices')) {
            assert.ok(statement.includes('revoked_at IS NULL AND enabled = TRUE AND registered = TRUE'));
            return { rows: revoked ? [] : [{ id: 12, user_id: 44, device_id: 2 }], rowCount: revoked ? 0 : 1 };
        }
        if (statement.startsWith('SELECT * FROM e2ee_sdk_devices')) {
            assert.ok(statement.includes('revoked_at IS NULL AND enabled = TRUE AND registered = TRUE'));
            return { rows: revoked ? [] : [{ id: 12, user_id: 44, device_id: 2 }], rowCount: revoked ? 0 : 1 };
        }
        if (statement.startsWith('UPDATE e2ee_sdk_envelopes')) {
            assert.ok(statement.includes('d.revoked_at IS NULL'));
            return { rows: [], rowCount: 0 };
        }
        throw new Error('Unexpected query after revocation: ' + statement);
    };
    t.after(() => {
        pool.connect = oldConnect;
        pool.query = oldQuery;
    });

    assert.deepEqual(await repository.removeDevice(44, 2), { deviceId: 2 });
    assert.equal(revoked, true);
    assert.equal(await repository.authenticateDeviceCredential(44, 2, 'x'.repeat(48)), null);
    await assert.rejects(repository.pullEnvelopes(44, 2), error => error.statusCode === 403);
    await assert.rejects(
        repository.markDelivered(44, 2, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d'),
        error => error.statusCode === 404
    );
    assert.ok(transactionCalls.some(call => call.statement.startsWith('UPDATE e2ee_sdk_devices SET revoked_at')));
});


test('primary E2EE device slot remains protected from linked-device revocation API', async t => {
    const oldConnect = pool.connect;
    const calls = [];
    const client = {
        async query(sql) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            calls.push(statement);
            return { rows: [], rowCount: 0 };
        },
        release() {}
    };
    pool.connect = async () => client;
    t.after(() => { pool.connect = oldConnect; });

    await assert.rejects(repository.removeDevice(44, 1), error => error.statusCode === 409);
    assert.deepEqual(calls, ['BEGIN', 'ROLLBACK']);
});


test('provisioning serializes device-slot allocation by locking the owning account row', async t => {
    const oldConnect = pool.connect;
    const calls = [];
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            calls.push({ statement, params });
            if (statement === 'BEGIN' || statement === 'COMMIT' || statement === 'ROLLBACK') {
                return { rows: [], rowCount: 0 };
            }
            if (statement.startsWith('SELECT session_id, status, assigned_device_id, completed_at')) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT * FROM e2ee_sdk_provisioning_sessions')) {
                return { rows: [{ session_id: 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d' }], rowCount: 1 };
            }
            if (statement === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
                return { rows: [{ id: 44 }], rowCount: 1 };
            }
            if (statement.startsWith('SELECT device_id FROM e2ee_sdk_devices')) {
                return { rows: [{ device_id: 1 }, { device_id: 2 }], rowCount: 2 };
            }
            if (statement.startsWith('INSERT INTO e2ee_sdk_devices')) return { rows: [], rowCount: 1 };
            if (statement.startsWith('UPDATE e2ee_sdk_provisioning_sessions SET assigned_device_id')) return { rows: [], rowCount: 1 };
            throw new Error('Unexpected SQL in provisioning allocation test: ' + statement);
        },
        release() {}
    };
    pool.connect = async () => client;
    t.after(() => { pool.connect = oldConnect; });

    const result = await repository.completeProvisioning(44, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', null, {});
    assert.equal(result.deviceId, 3);
    const deviceInsert = calls.find(call => call.statement.startsWith('INSERT INTO e2ee_sdk_devices'));
    assert.ok(deviceInsert.statement.includes('enabled'));
    assert.ok(deviceInsert.statement.includes("VALUES ($1,$2,$3,$4,$5,TRUE,'aci',$6,FALSE)"));
    const accountLock = calls.findIndex(call => call.statement === 'SELECT id FROM users WHERE id = $1 FOR UPDATE');
    const slotRead = calls.findIndex(call => call.statement.startsWith('SELECT device_id FROM e2ee_sdk_devices'));
    assert.ok(accountLock > 0);
    assert.ok(slotRead > accountLock);
    assert.deepEqual(calls[accountLock].params, [44]);
});

test('provisioning rollback cannot delete a later device that reused the assigned slot', async t => {
    const oldConnect = pool.connect;
    const calls = [];
    const completedAt = new Date('2026-10-26T10:00:00.000Z');
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            calls.push({ statement, params });
            if (statement === 'BEGIN' || statement === 'COMMIT' || statement === 'ROLLBACK') {
                return { rows: [], rowCount: 0 };
            }
            if (statement.startsWith('SELECT session_id, status, assigned_device_id, completed_at')) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT assigned_device_id, completed_at')) {
                return { rows: [{ assigned_device_id: 2, completed_at: completedAt }], rowCount: 1 };
            }
            if (statement.startsWith('DELETE FROM e2ee_sdk_devices')) return { rows: [], rowCount: 0 };
            if (statement.startsWith("UPDATE e2ee_sdk_provisioning_sessions SET status = 'rolled_back'")) return { rows: [], rowCount: 1 };
            throw new Error('Unexpected SQL in provisioning rollback test: ' + statement);
        },
        release() {}
    };
    pool.connect = async () => client;
    t.after(() => { pool.connect = oldConnect; });

    await repository.rollbackProvisioning(44, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d');
    const deletion = calls.find(call => call.statement.startsWith('DELETE FROM e2ee_sdk_devices'));
    assert.ok(deletion.statement.includes('revoked_at IS NULL'));
    assert.ok(deletion.statement.includes('created_at <= $3'));
    assert.deepEqual(deletion.params, [44, 2, completedAt]);
});


test('expired pending-ack provisioning revokes its unacknowledged device and clears ephemeral payload', async t => {
    const oldConnect = pool.connect;
    const calls = [];
    const completedAt = new Date('2026-10-26T10:00:00.000Z');
    const sessionId = 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d';
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            calls.push({ statement, params });
            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT session_id, status, assigned_device_id, completed_at')) {
                return {
                    rows: [{ session_id: sessionId, status: 'linked_pending_ack', assigned_device_id: 2, completed_at: completedAt }],
                    rowCount: 1
                };
            }
            if (statement.startsWith('DELETE FROM e2ee_sdk_devices')) return { rows: [], rowCount: 1 };
            if (statement.startsWith('UPDATE e2ee_sdk_provisioning_sessions SET status = CASE')) return { rows: [], rowCount: 1 };
            if (statement.startsWith('SELECT status, encrypted_message, new_device_ephemeral_public_key, expires_at')) {
                return {
                    rows: [{ status: 'expired', encrypted_message: null, new_device_ephemeral_public_key: null, expires_at: new Date('2026-10-26T10:05:00.000Z') }],
                    rowCount: 1
                };
            }
            throw new Error('Unexpected SQL in expired provisioning test: ' + statement);
        },
        release() {}
    };
    pool.connect = async () => client;
    t.after(() => { pool.connect = oldConnect; });

    const state = await repository.getProvisioningMessage(44, sessionId);
    assert.deepEqual(state, {
        status: 'expired',
        message: null,
        newDeviceEphemeralPublicKey: null,
        expiresAt: null
    });
    const deletion = calls.find(call => call.statement.startsWith('DELETE FROM e2ee_sdk_devices'));
    assert.ok(deletion.statement.includes('created_at <= $3'));
    assert.deepEqual(deletion.params, [44, 2, completedAt]);
    const expiryUpdate = calls.find(call => call.statement.startsWith('UPDATE e2ee_sdk_provisioning_sessions SET status = CASE'));
    assert.ok(expiryUpdate.statement.includes('encrypted_message = NULL'));
    assert.ok(expiryUpdate.statement.includes('new_device_ephemeral_public_key = NULL'));
    assert.deepEqual(expiryUpdate.params, [[sessionId], 44]);
});


test('expired completed provisioning retains completion status but scrubs encrypted and ephemeral payloads', async t => {
    const oldConnect = pool.connect;
    const calls = [];
    const sessionId = 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d';
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            calls.push({ statement, params });
            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT session_id, status, assigned_device_id, completed_at')) {
                return {
                    rows: [{ session_id: sessionId, status: 'completed', assigned_device_id: 2, completed_at: new Date('2026-10-26T10:00:00.000Z') }],
                    rowCount: 1
                };
            }
            if (statement.startsWith('UPDATE e2ee_sdk_provisioning_sessions SET status = CASE')) return { rows: [], rowCount: 1 };
            if (statement.startsWith('SELECT status, encrypted_message, new_device_ephemeral_public_key, expires_at')) {
                return {
                    rows: [{ status: 'completed', encrypted_message: null, new_device_ephemeral_public_key: null, expires_at: new Date('2026-10-26T10:05:00.000Z') }],
                    rowCount: 1
                };
            }
            throw new Error('Unexpected SQL in completed provisioning cleanup test: ' + statement);
        },
        release() {}
    };
    pool.connect = async () => client;
    t.after(() => { pool.connect = oldConnect; });

    const state = await repository.getProvisioningMessage(44, sessionId);
    assert.equal(state.status, 'completed');
    assert.equal(state.message, null);
    assert.equal(state.newDeviceEphemeralPublicKey, null);
    assert.equal(state.expiresAt, new Date('2026-10-26T10:05:00.000Z').getTime());
    assert.equal(calls.some(call => call.statement.startsWith('DELETE FROM e2ee_sdk_devices')), false);

    const cleanup = calls.find(call => call.statement.startsWith('UPDATE e2ee_sdk_provisioning_sessions SET status = CASE'));
    assert.ok(cleanup.statement.includes("WHEN status = 'completed' THEN 'completed'"));
    assert.ok(cleanup.statement.includes('encrypted_message = NULL'));
    assert.ok(cleanup.statement.includes('new_device_ephemeral_public_key = NULL'));
    assert.ok(cleanup.statement.includes('new_device_metadata = NULL'));
    assert.deepEqual(cleanup.params, [[sessionId], 44]);
});


test('provisioning acknowledgement activates only the assigned linked device with its device credential', async t => {
    const oldConnect = pool.connect;
    const calls = [];
    const sessionId = 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d';
    const completedAt = new Date('2026-10-26T10:00:00.000Z');
    const token = 'device-token-for-new-device-which-is-long-enough';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            calls.push({ statement, params });
            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT session_id, status, assigned_device_id, completed_at')) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT assigned_device_id, completed_at')) {
                return { rows: [{ assigned_device_id: 3, completed_at: completedAt }], rowCount: 1 };
            }
            if (statement.startsWith('UPDATE e2ee_sdk_devices SET enabled = TRUE')) {
                return { rows: [{ device_id: 3 }], rowCount: 1 };
            }
            if (statement.startsWith("UPDATE e2ee_sdk_provisioning_sessions SET status = 'completed'")) {
                return { rows: [{ session_id: sessionId }], rowCount: 1 };
            }
            throw new Error('Unexpected SQL in provisioning acknowledgement test: ' + statement);
        },
        release() {}
    };
    pool.connect = async () => client;
    t.after(() => { pool.connect = oldConnect; });

    await repository.acknowledgeProvisioning(44, sessionId, token);
    const activation = calls.find(call => call.statement.startsWith('UPDATE e2ee_sdk_devices SET enabled = TRUE'));
    assert.deepEqual(activation.params, [44, 3, tokenHash, completedAt]);
    assert.ok(activation.statement.includes('device_token_hash = $3'));
    assert.ok(activation.statement.includes('created_at <= $4'));
    assert.ok(calls.find(call => call.statement.startsWith("UPDATE e2ee_sdk_provisioning_sessions SET status = 'completed'")));
});

test('provisioning acknowledgement rejects missing device credential before activating device', async t => {
    const oldConnect = pool.connect;
    const calls = [];
    const client = {
        async query(sql) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            calls.push(statement);
            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT session_id, status, assigned_device_id, completed_at')) return { rows: [], rowCount: 0 };
            throw new Error('Unexpected SQL in missing provisioning credential test: ' + statement);
        },
        release() {}
    };
    pool.connect = async () => client;
    t.after(() => { pool.connect = oldConnect; });

    await assert.rejects(
        repository.acknowledgeProvisioning(44, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', null),
        error => error.statusCode === 401 && error.code === 'E2EE_DEVICE_AUTH_REQUIRED'
    );
    assert.equal(calls.some(statement => statement.startsWith('UPDATE e2ee_sdk_devices SET enabled = TRUE')), false);
});

test('provisioning acknowledgement cannot reactivate an already-enabled or mismatched device', async t => {
    const oldConnect = pool.connect;
    const calls = [];
    const sessionId = 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d';
    const completedAt = new Date('2026-10-26T10:00:00.000Z');
    const token = 'device-token-for-new-device-which-is-long-enough';
    const client = {
        async query(sql, params = []) {
            const statement = sql.replace(/\s+/g, ' ').trim();
            calls.push({ statement, params });
            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT session_id, status, assigned_device_id, completed_at')) return { rows: [], rowCount: 0 };
            if (statement.startsWith('SELECT assigned_device_id, completed_at')) {
                return { rows: [{ assigned_device_id: 3, completed_at: completedAt }], rowCount: 1 };
            }
            if (statement.startsWith('UPDATE e2ee_sdk_devices SET enabled = TRUE')) {
                assert.ok(statement.includes('enabled = FALSE'));
                return { rows: [], rowCount: 0 };
            }
            throw new Error('Unexpected SQL in rejected provisioning acknowledgement test: ' + statement);
        },
        release() {}
    };
    pool.connect = async () => client;
    t.after(() => { pool.connect = oldConnect; });

    await assert.rejects(
        repository.acknowledgeProvisioning(44, sessionId, token),
        error => error.statusCode === 401 && error.code === 'E2EE_DEVICE_AUTH_FAILED'
    );
    assert.ok(calls.some(call => call.statement === 'ROLLBACK'));
    assert.equal(calls.some(call => call.statement.startsWith("UPDATE e2ee_sdk_provisioning_sessions SET status = 'completed'")), false);
    const activation = calls.find(call => call.statement.startsWith('UPDATE e2ee_sdk_devices SET enabled = TRUE'));
    assert.ok(activation.statement.includes('enabled = FALSE'));
});
