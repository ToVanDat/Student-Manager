const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const enabled = process.env.E2EE_POSTGRES_INTEGRATION === '1';
test('live PostgreSQL E2EE relay integration: prekey claims, mailbox, dedupe, acknowledgement, revocation', {
    skip: !enabled && 'Set E2EE_POSTGRES_INTEGRATION=1 only against a disposable PostgreSQL database'
}, async t => {
    const pool = require('../src/config/database');
    const repository = require('../repository/e2eeRelayRepository');
    const migration = fs.readFileSync(
        path.join(__dirname, '..', 'sql', 'e2ee_foundation_migration.sql'),
        'utf8'
    );
    const pauseModeMigration = fs.readFileSync(
        path.join(__dirname, '..', 'sql', 'e2ee_pause_mode_migration.sql'),
        'utf8'
    );

    try {
        await pool.query('CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY)');
        await pool.query('CREATE TABLE IF NOT EXISTS conversations (id BIGSERIAL PRIMARY KEY, type TEXT NOT NULL DEFAULT \'direct\')');
        await pool.query('CREATE TABLE IF NOT EXISTS messages (id BIGSERIAL PRIMARY KEY)');
        await pool.query(`CREATE TABLE IF NOT EXISTS conversation_members (
            conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            left_at TIMESTAMPTZ,
            PRIMARY KEY (conversation_id, user_id)
        )`);
        await pool.query(migration);
        await pool.query(pauseModeMigration);

        const userRows = await pool.query(
            'INSERT INTO users DEFAULT VALUES RETURNING id'
        );
        const senderId = Number(userRows.rows[0].id);
        const recipientRows = await pool.query('INSERT INTO users DEFAULT VALUES RETURNING id');
        const recipientId = Number(recipientRows.rows[0].id);
        const conversationRows = await pool.query(
            'INSERT INTO conversations (type) VALUES (\'direct\') RETURNING id'
        );
        const conversationId = Number(conversationRows.rows[0].id);
        await pool.query(
            'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2),($1,$3)',
            [conversationId, senderId, recipientId]
        );
        await pool.query(
            "INSERT INTO conversation_e2ee_settings (conversation_id, protocol, enabled_by, mode) VALUES ($1, 'open-e2ee-signal-v11', $2, 'direct')",
            [conversationId, senderId]
        );

        const sender = await repository.registerDevice(senderId, { registrationId: 1001, deviceType: 'web' });
        const recipientPrimary = await repository.registerDevice(recipientId, { registrationId: 2001, deviceType: 'web' });
        const recipientSecondary = await repository.registerDevice(recipientId, { registrationId: 2002, deviceType: 'web' });
        const identity = {
            version: 1,
            x25519PublicKey: Buffer.alloc(32, 7).toString('base64'),
            ed25519PublicKey: Buffer.alloc(32, 8).toString('base64')
        };
        await pool.query(
            'UPDATE e2ee_sdk_devices SET identity_public = $2::jsonb WHERE user_id = $1',
            [recipientId, JSON.stringify(identity)]
        );
        await pool.query(
            'INSERT INTO e2ee_sdk_identities (user_id, identity_type, identity_public) VALUES ($1, \'aci\', $2::jsonb)',
            [recipientId, JSON.stringify(identity)]
        );

        const primaryPk = (await pool.query(
            'SELECT id FROM e2ee_sdk_devices WHERE user_id = $1 AND device_id = 1',
            [recipientId]
        )).rows[0].id;
        const secondaryPk = (await pool.query(
            'SELECT id FROM e2ee_sdk_devices WHERE user_id = $1 AND device_id = 2',
            [recipientId]
        )).rows[0].id;
        const signedKey = Buffer.alloc(32, 9).toString('base64');
        const ecOneTimeKey = Buffer.alloc(32, 10).toString('base64');
        const kemOneTimeKey = Buffer.alloc(1568, 11).toString('base64');
        const signature = Buffer.alloc(64, 12).toString('base64');
        await pool.query(
            `INSERT INTO e2ee_sdk_prekeys (device_pk, identity_type, key_type, key_id, public_key, signature)
             VALUES ($1, 'aci', 'ecSignedPreKey', 100, $2, $5),
                    ($1, 'aci', 'ecPreKey', 101, $3, NULL),
                    ($1, 'aci', 'ecPreKey', 102, $4, NULL),
                    ($1, 'aci', 'kemOneTimePreKey', 201, $6, $5),
                    ($1, 'aci', 'kemOneTimePreKey', 202, $7, $5),
                    ($1, 'aci', 'kemLastResortPreKey', 299, $7, $5)`,
            [primaryPk, signedKey, ecOneTimeKey, Buffer.alloc(32, 13).toString('base64'), signature,
                kemOneTimeKey, Buffer.alloc(1568, 14).toString('base64')]
        );

        const [bundleA, bundleB] = await Promise.all([
            repository.fetchPreKeyBundle(recipientId, 1),
            repository.fetchPreKeyBundle(recipientId, 1)
        ]);
        assert.ok(bundleA.ecOneTimePreKey);
        assert.ok(bundleB.ecOneTimePreKey);
        assert.notEqual(bundleA.ecOneTimePreKey.keyId, bundleB.ecOneTimePreKey.keyId,
            'concurrent bundle claims must not return the same EC one-time prekey');
        assert.ok(bundleA.kemOneTimePreKey);
        assert.ok(bundleB.kemOneTimePreKey);
        assert.notEqual(bundleA.kemOneTimePreKey.keyId, bundleB.kemOneTimePreKey.keyId,
            'concurrent bundle claims must not return the same KEM one-time prekey');

        const clientMessageId = 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d';
        const makeEnvelope = targetDeviceId => ({
            targetUserId: recipientId,
            targetDeviceId,
            senderDeviceId: sender.device_id,
            ciphertext: Buffer.from(`opaque-${targetDeviceId}`).toString('base64'),
            messageType: 'ciphertext',
            deliveryClass: 'user-visible',
            contentKind: 'message',
            timestamp: Date.now(),
            clientMessageId
        });
        const first = await repository.sendEnvelope(senderId, conversationId, makeEnvelope(recipientPrimary.device_id));
        const second = await repository.sendEnvelope(senderId, conversationId, makeEnvelope(recipientSecondary.device_id));
        const retry = await repository.sendEnvelope(senderId, conversationId, makeEnvelope(recipientPrimary.device_id));
        assert.equal(first.notifyRecipient, true);
        assert.equal(second.notifyRecipient, false, 'additional recipient devices must not duplicate notifications');
        assert.equal(retry.duplicate, true);
        assert.equal(retry.notifyRecipient, false);

        const primaryMailbox = await repository.pullEnvelopes(recipientId, recipientPrimary.device_id, 20);
        const secondaryMailbox = await repository.pullEnvelopes(recipientId, recipientSecondary.device_id, 20);
        assert.equal(primaryMailbox.length, 1);
        assert.equal(secondaryMailbox.length, 1);
        assert.equal(primaryMailbox[0].ciphertext, makeEnvelope(1).ciphertext);
        assert.deepEqual(
            await repository.markDelivered(recipientId, recipientPrimary.device_id, first.id),
            { id: first.id, acknowledged: true }
        );
        assert.deepEqual(
            await repository.markDelivered(recipientId, recipientPrimary.device_id, first.id),
            { id: first.id, acknowledged: true },
            'acknowledgement should be idempotent'
        );
        assert.equal((await repository.pullEnvelopes(recipientId, recipientPrimary.device_id, 20)).length, 0);

        await repository.removeDevice(recipientId, recipientSecondary.device_id);
        await assert.rejects(
            repository.pullEnvelopes(recipientId, recipientSecondary.device_id, 20),
            error => error.statusCode === 403
        );
        const remaining = await pool.query(
            'SELECT COUNT(*)::int AS count FROM e2ee_sdk_envelopes WHERE recipient_device_pk = $1 AND acknowledged_at IS NULL',
            [secondaryPk]
        );
        assert.equal(remaining.rows[0].count, 0, 'revocation must remove pending envelopes for the device');

        await t.test('device provisioning expiry and rollback do not leave an active linked device', async () => {
            const session = await repository.createProvisioningSession(senderId, Buffer.alloc(32, 21).toString('base64'));
            await repository.connectNewDevice(
                senderId,
                session.sessionId,
                Buffer.alloc(32, 22).toString('base64'),
                { deviceType: 'web' }
            );
            await repository.sendProvisioningMessage(senderId, session.sessionId, Buffer.from('encrypted-provisioning-payload').toString('base64'));
            const linked = await repository.completeProvisioning(senderId, session.sessionId, null, { deviceType: 'web' });
            assert.ok(linked.deviceToken);
            assert.ok(linked.deviceId >= 2 && linked.deviceId <= 5);

            await repository.rollbackProvisioning(senderId, session.sessionId);
            const rolledBackDevice = await pool.query(
                'SELECT id FROM e2ee_sdk_devices WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL',
                [senderId, linked.deviceId]
            );
            assert.equal(rolledBackDevice.rowCount, 0, 'rollback must remove the unacknowledged linked device');
            const rolledBackSession = await pool.query(
                'SELECT status FROM e2ee_sdk_provisioning_sessions WHERE session_id = $1',
                [session.sessionId]
            );
            assert.equal(rolledBackSession.rows[0].status, 'rolled_back');

            const expired = await repository.createProvisioningSession(senderId, Buffer.alloc(32, 23).toString('base64'));
            await pool.query(
                "UPDATE e2ee_sdk_provisioning_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE session_id = $1",
                [expired.sessionId]
            );
            await assert.rejects(
                repository.connectNewDevice(
                    senderId,
                    expired.sessionId,
                    Buffer.alloc(32, 24).toString('base64'),
                    { deviceType: 'web' }
                ),
                error => error.statusCode === 404
            );
        });
    } finally {
        await pool.end();
    }
});
