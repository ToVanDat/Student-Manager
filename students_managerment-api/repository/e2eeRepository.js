const pool = require('../src/config/database');

const withTransaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const registerDevice = async (userId, device, prekeys) => withTransaction(async (client) => {
    const { rows } = await client.query(
        `INSERT INTO e2ee_devices (
            user_id, device_id, device_name, identity_key_public,
            signed_prekey_public, signed_prekey_signature,
            signed_prekey_id, registration_id, revoked_at, last_seen_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,NOW())
        ON CONFLICT (user_id, device_id) DO UPDATE SET
            device_name = EXCLUDED.device_name,
            identity_key_public = EXCLUDED.identity_key_public,
            signed_prekey_public = EXCLUDED.signed_prekey_public,
            signed_prekey_signature = EXCLUDED.signed_prekey_signature,
            signed_prekey_id = EXCLUDED.signed_prekey_id,
            registration_id = EXCLUDED.registration_id,
            revoked_at = NULL,
            last_seen_at = NOW()
        RETURNING id, user_id, device_id, device_name, signed_prekey_id,
            registration_id, created_at, last_seen_at, revoked_at`,
        [
            userId, device.deviceId, device.deviceName,
            device.identityKeyPublic, device.signedPrekeyPublic,
            device.signedPrekeySignature, device.signedPrekeyId,
            device.registrationId
        ]
    );
    const saved = rows[0];

    for (const key of prekeys) {
        await client.query(
            `INSERT INTO e2ee_one_time_prekeys (device_pk, prekey_id, public_key)
             VALUES ($1, $2, $3)
             ON CONFLICT (device_pk, prekey_id) DO UPDATE
             SET public_key = EXCLUDED.public_key, claimed_at = NULL`,
            [saved.id, key.id, key.publicKey]
        );
    }

    return saved;
});

const listDevicesForUser = async (userId, requesterId) => {
    const { rows } = await pool.query(
        `SELECT id, user_id, device_id, device_name, identity_key_public,
                signed_prekey_public, signed_prekey_signature, signed_prekey_id,
                registration_id, created_at, last_seen_at
         FROM e2ee_devices
         WHERE user_id = $1 AND revoked_at IS NULL
           AND ($1 = $2 OR $2 IS NOT NULL)
         ORDER BY last_seen_at DESC, id`,
        [userId, requesterId]
    );
    return rows;
};

const revokeDevice = async (userId, deviceId) => {
    const { rows } = await pool.query(
        `UPDATE e2ee_devices
         SET revoked_at = NOW()
         WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL
         RETURNING id, device_id, revoked_at`,
        [userId, deviceId]
    );
    return rows[0] || null;
};

const getConversationDeviceBundles = async (conversationId, requesterId) => withTransaction(async (client) => {
    const membership = await client.query(
        `SELECT 1 FROM conversation_members
         WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL LIMIT 1`,
        [conversationId, requesterId]
    );
    if (!membership.rowCount) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }

    const { rows: devices } = await client.query(
        `SELECT d.id, d.user_id, d.device_id, d.device_name,
                d.identity_key_public, d.signed_prekey_public,
                d.signed_prekey_signature, d.signed_prekey_id,
                d.registration_id
         FROM e2ee_devices d
         JOIN conversation_members cm ON cm.user_id = d.user_id
         WHERE cm.conversation_id = $1
           AND cm.left_at IS NULL
           AND d.revoked_at IS NULL
         ORDER BY d.user_id, d.last_seen_at DESC, d.id`,
        [conversationId]
    );

    const bundles = [];
    for (const device of devices) {
        const { rows: prekeys } = await client.query(
            `SELECT id, prekey_id, public_key
             FROM e2ee_one_time_prekeys
             WHERE device_pk = $1 AND claimed_at IS NULL
             ORDER BY prekey_id
             LIMIT 1
             FOR UPDATE SKIP LOCKED`,
            [device.id]
        );

        let oneTimePrekey = null;
        if (prekeys[0]) {
            const claimed = await client.query(
                `UPDATE e2ee_one_time_prekeys
                 SET claimed_at = NOW()
                 WHERE id = $1 AND claimed_at IS NULL
                 RETURNING prekey_id, public_key`,
                [prekeys[0].id]
            );
            if (claimed.rows[0]) {
                oneTimePrekey = {
                    id: claimed.rows[0].prekey_id,
                    publicKey: claimed.rows[0].public_key
                };
            }
        }

        bundles.push({
            userId: device.user_id,
            deviceId: device.device_id,
            deviceName: device.device_name,
            identityKeyPublic: device.identity_key_public,
            signedPrekey: {
                id: device.signed_prekey_id,
                publicKey: device.signed_prekey_public,
                signature: device.signed_prekey_signature
            },
            registrationId: device.registration_id,
            oneTimePrekey
        });
    }
    return bundles;
});

module.exports = {
    registerDevice,
    listDevicesForUser,
    revokeDevice,
    getConversationDeviceBundles
};
