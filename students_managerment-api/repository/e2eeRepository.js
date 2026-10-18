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

const conflictError = (message) => {
    const error = new Error(message);
    error.statusCode = 409;
    return error;
};

const registerDevice = async (userId, device, prekeys) => withTransaction(async (client) => {
    const existingResult = await client.query(
        `SELECT id, identity_key_public, revoked_at
         FROM e2ee_devices
         WHERE user_id = $1 AND device_id = $2
         FOR UPDATE`,
        [userId, device.deviceId]
    );
    const existing = existingResult.rows[0];

    // A device ID is bound to its first identity key. Never silently replace
    // that identity or reactivate a revoked device during normal registration.
    if (existing && existing.identity_key_public !== device.identityKeyPublic) {
        throw conflictError('Identity key của thiết bị đã thay đổi; cần quy trình xác minh/khôi phục riêng.');
    }
    if (existing?.revoked_at) {
        throw conflictError('Thiết bị đã bị thu hồi. Hãy đăng ký bằng deviceId mới.');
    }

    const { rows } = await client.query(
        `INSERT INTO e2ee_devices (
            user_id, device_id, device_name, identity_key_public,
            signed_prekey_public, signed_prekey_signature,
            signed_prekey_id, registration_id, last_seen_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT (user_id, device_id) DO UPDATE SET
            device_name = EXCLUDED.device_name,
            signed_prekey_public = EXCLUDED.signed_prekey_public,
            signed_prekey_signature = EXCLUDED.signed_prekey_signature,
            signed_prekey_id = EXCLUDED.signed_prekey_id,
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
        // Re-uploading a device bundle must not make an already claimed
        // one-time prekey available a second time.
        await client.query(
            `INSERT INTO e2ee_one_time_prekeys (device_pk, prekey_id, public_key)
             VALUES ($1, $2, $3)
             ON CONFLICT (device_pk, prekey_id) DO NOTHING`,
            [saved.id, key.id, key.publicKey]
        );
    }

    return saved;
});

const listDevicesForUser = async (userId) => {
    const { rows } = await pool.query(
        `SELECT id, user_id, device_id, device_name, identity_key_public,
                signed_prekey_public, signed_prekey_signature, signed_prekey_id,
                registration_id, created_at, last_seen_at
         FROM e2ee_devices
         WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY last_seen_at DESC, id`,
        [userId]
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

const getConversationDeviceBundles = async (conversationId, requesterId) => {
    const membership = await pool.query(
        `SELECT 1 FROM conversation_members
         WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL LIMIT 1`,
        [conversationId, requesterId]
    );
    if (!membership.rowCount) {
        const error = new Error('Bạn không thuộc conversation này');
        error.statusCode = 403;
        throw error;
    }

    // Listing device identities must not consume one-time prekeys. Claim a
    // prekey only for the specific recipient device when starting a session.
    const { rows } = await pool.query(
        `SELECT d.user_id, d.device_id, d.device_name,
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

    return rows.map((device) => ({
        userId: device.user_id,
        deviceId: device.device_id,
        deviceName: device.device_name,
        identityKeyPublic: device.identity_key_public,
        signedPrekey: {
            id: device.signed_prekey_id,
            publicKey: device.signed_prekey_public,
            signature: device.signed_prekey_signature
        },
        registrationId: device.registration_id
    }));
};

const claimConversationDevicePrekey = async (conversationId, requesterId, targetDeviceId) => withTransaction(async (client) => {
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

    const deviceResult = await client.query(
        `SELECT d.id
         FROM e2ee_devices d
         JOIN conversation_members cm ON cm.user_id = d.user_id
         WHERE cm.conversation_id = $1
           AND cm.left_at IS NULL
           AND d.device_id = $2
           AND d.revoked_at IS NULL
         LIMIT 1
         FOR UPDATE OF d`,
        [conversationId, targetDeviceId]
    );
    if (!deviceResult.rows[0]) {
        const error = new Error('Không tìm thấy thiết bị E2EE đang hoạt động trong conversation');
        error.statusCode = 404;
        throw error;
    }

    const prekeyResult = await client.query(
        `SELECT id, prekey_id, public_key
         FROM e2ee_one_time_prekeys
         WHERE device_pk = $1 AND claimed_at IS NULL
         ORDER BY prekey_id
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [deviceResult.rows[0].id]
    );
    if (!prekeyResult.rows[0]) return null;

    const claimed = await client.query(
        `UPDATE e2ee_one_time_prekeys
         SET claimed_at = NOW()
         WHERE id = $1 AND claimed_at IS NULL
         RETURNING prekey_id, public_key`,
        [prekeyResult.rows[0].id]
    );
    if (!claimed.rows[0]) return null;

    return {
        id: claimed.rows[0].prekey_id,
        publicKey: claimed.rows[0].public_key
    };
});

// Fail closed for legacy plaintext sends after a conversation is explicitly marked E2EE.
// The to_regclass check keeps the existing application usable before the additive
// migration is applied; it does not create or modify schema.
const isConversationE2EEEnabled = async (conversationId) => {
    const tableCheck = await pool.query(
        "SELECT to_regclass('public.conversation_e2ee_settings') IS NOT NULL AS table_exists"
    );
    if (!tableCheck.rows[0]?.table_exists) return false;

    const { rows } = await pool.query(
        'SELECT 1 FROM conversation_e2ee_settings WHERE conversation_id = $1 LIMIT 1',
        [conversationId]
    );
    return rows.length > 0;
};

module.exports = {
    isConversationE2EEEnabled,
    registerDevice,
    listDevicesForUser,
    revokeDevice,
    getConversationDeviceBundles,
    claimConversationDevicePrekey
};
