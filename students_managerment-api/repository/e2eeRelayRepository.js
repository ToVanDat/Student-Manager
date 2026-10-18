const crypto = require('crypto');
const pool = require('../src/config/database');

const httpError = (statusCode, message, code) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (code) error.code = code;
    return error;
};

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

const assertConversationMember = async (client, conversationId, userId) => {
    const { rowCount } = await client.query(
        'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL LIMIT 1',
        [conversationId, userId]
    );
    if (!rowCount) throw httpError(403, 'Bạn không thuộc conversation này');
};

const assertE2EEEnabled = async (client, conversationId) => {
    const { rowCount } = await client.query(
        'SELECT 1 FROM conversation_e2ee_settings WHERE conversation_id = $1 LIMIT 1',
        [conversationId]
    );
    if (!rowCount) throw httpError(409, 'E2EE chưa được kích hoạt cho conversation này', 'E2EE_NOT_ENABLED');
};

const getDeviceRow = async (client, userId, deviceId, identityType = 'aci', lock = false) => {
    const { rows } = await client.query(
        `SELECT * FROM e2ee_sdk_devices
         WHERE user_id = $1 AND device_id = $2 AND identity_type = $3
           AND revoked_at IS NULL AND enabled = TRUE AND registered = TRUE
         ${lock ? 'FOR UPDATE' : ''}`,
        [userId, deviceId, identityType]
    );
    return rows[0] || null;
};

const registerDevice = async (userId, input) => withTransaction(async (client) => {
    const requested = input.deviceId;
    let deviceId = requested;
    if (requested == null) {
        const { rows } = await client.query(
            'SELECT device_id FROM e2ee_sdk_devices WHERE user_id = $1 AND revoked_at IS NULL ORDER BY device_id',
            [userId]
        );
        const used = new Set(rows.map(row => Number(row.device_id)));
        deviceId = [2, 3, 4, 5].find(id => !used.has(id));
        if (!deviceId) throw httpError(409, 'Tài khoản đã đạt giới hạn 5 thiết bị E2EE');
    }
    if (deviceId === 1) {
        const existing = await getDeviceRow(client, userId, 1, 'aci', true);
        if (existing) throw httpError(409, 'Thiết bị chính đã đăng ký; cần quy trình khôi phục riêng');
    } else {
        const existing = await getDeviceRow(client, userId, deviceId, 'aci', true);
        if (existing) throw httpError(409, 'Device slot đã được sử dụng');
    }
    const { rows } = await client.query(
        `INSERT INTO e2ee_sdk_devices
          (user_id, device_id, registration_id, device_type, encrypted_device_name, linked, identity_type)
         VALUES ($1,$2,$3,$4,$5,$6,'aci')
         RETURNING device_id, registration_id, device_type, registered, linked, enabled, created_at`,
        [userId, deviceId, input.registrationId, input.deviceType || 'web',
            input.encryptedDeviceName || null, deviceId !== 1]
    );
    return rows[0];
});

const getDevices = async (userId, requesterId) => {
    if (Number(userId) !== Number(requesterId)) {
        throw httpError(403, 'Chỉ được xem thiết bị của chính tài khoản');
    }
    const { rows } = await pool.query(
        `SELECT device_id, device_type, registered, linked, enabled, last_seen_at, created_at
         FROM e2ee_sdk_devices
         WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY device_id`,
        [userId]
    );
    return rows.map(row => ({ ...row, deviceId: Number(row.device_id) }));
};

const removeDevice = async (userId, deviceId) => {
    if (deviceId === 1) throw httpError(409, 'Không thể thu hồi thiết bị chính bằng API liên kết thiết bị');
    const { rows } = await pool.query(
        `UPDATE e2ee_sdk_devices SET revoked_at = NOW(), enabled = FALSE
         WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL
         RETURNING id, device_id`,
        [userId, deviceId]
    );
    if (!rows[0]) throw httpError(404, 'Không tìm thấy thiết bị E2EE đang hoạt động');
    return { deviceId: Number(rows[0].device_id) };
};

const provisionIdentity = async (userId, deviceId, identity, registrationId, identityType = 'aci') =>
    withTransaction(async client => {
        const device = await getDeviceRow(client, userId, deviceId, identityType, true);
        if (!device) throw httpError(404, 'Không tìm thấy thiết bị E2EE đang hoạt động');
        if (Number(device.registration_id) !== registrationId) {
            throw httpError(409, 'registrationId không khớp thiết bị');
        }
        const canonical = await client.query(
            'SELECT identity_public FROM e2ee_sdk_identities WHERE user_id = $1 AND identity_type = $2 FOR UPDATE',
            [userId, identityType]
        );
        if (canonical.rows[0]) {
            if (JSON.stringify(canonical.rows[0].identity_public) !== JSON.stringify(identity)) {
                throw httpError(409, 'Identity tài khoản đã tồn tại; linked device phải dùng cùng CompositeIdentityV1');
            }
        } else {
            await client.query(
                'INSERT INTO e2ee_sdk_identities (user_id, identity_type, identity_public) VALUES ($1,$2,$3::jsonb)',
                [userId, identityType, JSON.stringify(identity)]
            );
        }
        const { rows } = await client.query(
            `UPDATE e2ee_sdk_devices SET identity_public = $4::jsonb, last_seen_at = NOW()
             WHERE user_id = $1 AND device_id = $2 AND identity_type = $3
             AND (identity_public IS NULL OR identity_public = $4::jsonb)
             RETURNING device_id`,
            [userId, deviceId, identityType, JSON.stringify(identity)]
        );
        if (!rows[0]) throw httpError(409, 'Identity thiết bị đã tồn tại và không thể thay đổi bằng provisioning thường');
    });

const uploadPreKeys = async (userId, deviceId, keys, identityType = 'aci') => withTransaction(async client => {
    const device = await getDeviceRow(client, userId, deviceId, identityType, true);
    if (!device) throw httpError(404, 'Không tìm thấy thiết bị E2EE đang hoạt động');
    for (const key of keys) {
        await client.query(
            `INSERT INTO e2ee_sdk_prekeys (device_pk, identity_type, key_type, key_id, public_key, signature)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (device_pk, identity_type, key_type, key_id)
             DO UPDATE SET public_key = EXCLUDED.public_key, signature = EXCLUDED.signature
             WHERE e2ee_sdk_prekeys.claimed_at IS NULL`,
            [device.id, identityType, key.type, key.keyId, key.publicKey, key.signature || null]
        );
    }
});

const getPreKeyCount = async (userId, deviceId, type, identityType = 'aci') => {
    const keyType = type === 'ec' ? 'ecPreKey' : 'kemOneTimePreKey';
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM e2ee_sdk_prekeys p
         JOIN e2ee_sdk_devices d ON d.id = p.device_pk
         WHERE d.user_id = $1 AND d.device_id = $2 AND d.identity_type = $4
           AND d.revoked_at IS NULL AND d.enabled = TRUE
           AND p.identity_type = $4 AND p.key_type = $3 AND p.claimed_at IS NULL`,
        [userId, deviceId, keyType, identityType]
    );
    return rows[0].count;
};

const getPreKeyInventory = async (userId, deviceId, identityType = 'aci') => {
    const { rows } = await pool.query(
        `SELECT p.key_type, p.key_id, p.public_key, p.signature, p.created_at, p.expires_at,
                p.claimed_at
         FROM e2ee_sdk_prekeys p JOIN e2ee_sdk_devices d ON d.id = p.device_pk
         WHERE d.user_id = $1 AND d.device_id = $2 AND d.identity_type = $3
           AND d.revoked_at IS NULL AND p.identity_type = $3
         ORDER BY p.key_type, p.key_id`,
        [userId, deviceId, identityType]
    );
    const count = type => rows.filter(row => row.key_type === type && !row.claimed_at).length;
    const first = type => rows.find(row => row.key_type === type);
    const toMetadata = row => row ? ({
        keyId: Number(row.key_id),
        publicKey: row.public_key,
        createdAt: new Date(row.created_at).getTime(),
        expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : Number.MAX_SAFE_INTEGER
    }) : null;
    return {
        ecSignedPreKey: toMetadata(first('ecSignedPreKey')),
        kemLastResortPreKey: toMetadata(first('kemLastResortPreKey')),
        ecOneTimePreKeyCount: count('ecPreKey'),
        kemOneTimePreKeyCount: count('kemOneTimePreKey')
    };
};

const fetchPreKeyBundle = async (targetUserId, targetDeviceId, identityType = 'aci') => withTransaction(async client => {
    const device = await getDeviceRow(client, targetUserId, targetDeviceId, identityType, true);
    if (!device || !device.identity_public) return null;

    const { rows: keyRows } = await client.query(
        `SELECT key_type, key_id, public_key, signature
         FROM e2ee_sdk_prekeys
         WHERE device_pk = $1 AND identity_type = $2
         ORDER BY key_id
         FOR UPDATE SKIP LOCKED`,
        [device.id, identityType]
    );
    const find = type => keyRows.find(row => row.key_type === type && row.key_type !== 'ecPreKey' && row.key_type !== 'kemOneTimePreKey');
    const signed = find('ecSignedPreKey');
    const kemLast = find('kemLastResortPreKey');
    if (!signed || !kemLast) throw httpError(409, 'Thiết bị chưa có signed/KEM prekey hoàn chỉnh');

    const claimOne = async type => {
        const { rows } = await client.query(
            `SELECT id, key_id, public_key FROM e2ee_sdk_prekeys
             WHERE device_pk = $1 AND identity_type = $2 AND key_type = $3 AND claimed_at IS NULL
             ORDER BY key_id LIMIT 1 FOR UPDATE SKIP LOCKED`,
            [device.id, identityType, type]
        );
        if (!rows[0]) return null;
        await client.query('UPDATE e2ee_sdk_prekeys SET claimed_at = NOW() WHERE id = $1 AND claimed_at IS NULL', [rows[0].id]);
        return { keyId: Number(rows[0].key_id), publicKey: rows[0].public_key };
    };
    const ecOne = await claimOne('ecPreKey');
    const kemOne = await claimOne('kemOneTimePreKey');
    return {
        identityKey: device.identity_public,
        registrationId: Number(device.registration_id),
        signedPreKey: { keyId: Number(signed.key_id), publicKey: signed.public_key, signature: signed.signature },
        kemLastResortPreKey: { keyId: Number(kemLast.key_id), publicKey: kemLast.public_key },
        oneTimePreKey: ecOne,
        kemOneTimePreKey: kemOne
    };
});

const sendEnvelope = async (senderUserId, conversationId, input) => withTransaction(async client => {
    await assertConversationMember(client, conversationId, senderUserId);
    await assertE2EEEnabled(client, conversationId);
    const sender = await getDeviceRow(client, senderUserId, input.senderDeviceId, 'aci', true);
    if (!sender) throw httpError(403, 'Thiết bị gửi chưa đăng ký hoặc đã bị thu hồi');
    const { rowCount: recipientMember } = await client.query(
        'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL LIMIT 1',
        [conversationId, input.targetUserId]
    );
    if (!recipientMember) throw httpError(403, 'Thiết bị nhận không thuộc conversation');
    const recipient = await getDeviceRow(client, input.targetUserId, input.targetDeviceId, 'aci', true);
    if (!recipient) throw httpError(410, 'Thiết bị nhận không còn hoạt động', 'STALE_DEVICE');
    if (input.messageType === 'prekey_bundle' && input.recipientRegistrationId != null &&
        Number(input.recipientRegistrationId) !== Number(recipient.registration_id)) {
        throw httpError(410, 'registrationId thiết bị nhận đã thay đổi', 'STALE_DEVICE');
    }

    const existing = await client.query(
        `SELECT id, server_timestamp_ms FROM e2ee_sdk_envelopes
         WHERE sender_user_id = $1 AND client_message_id = $2 AND recipient_device_pk = $3 LIMIT 1`,
        [senderUserId, input.clientMessageId, recipient.id]
    );
    if (existing.rows[0]) {
        return { id: existing.rows[0].id, serverTimestamp: Number(existing.rows[0].server_timestamp_ms), duplicate: true, recipientUserId: Number(input.targetUserId), recipientDeviceId: Number(input.targetDeviceId) };
    }

    const id = crypto.randomUUID();
    const serverTimestamp = Date.now();
    const expiresAt = input.deliveryClass === 'ephemeral' ? new Date(serverTimestamp + 5 * 60 * 1000) : null;
    const { rows } = await client.query(
        `INSERT INTO e2ee_sdk_envelopes (
            id, conversation_id, sender_user_id, sender_device_pk,
            recipient_user_id, recipient_device_pk, client_message_id, ciphertext,
            message_type, delivery_class, content_kind, client_timestamp_ms,
            operation_epoch_ms, recipient_registration_id, server_timestamp_ms, expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id, server_timestamp_ms, expires_at`,
        [id, conversationId, senderUserId, sender.id, input.targetUserId, recipient.id,
            input.clientMessageId, input.ciphertext, input.messageType, input.deliveryClass,
            input.contentKind || 'message', input.timestamp, input.operationEpochMilliseconds || null,
            input.recipientRegistrationId || null, serverTimestamp, expiresAt]
    );
    return {
        id: rows[0].id,
        serverTimestamp: Number(rows[0].server_timestamp_ms),
        expiresAt: rows[0].expires_at ? new Date(rows[0].expires_at).getTime() : undefined,
        duplicate: false,
        recipientUserId: Number(input.targetUserId),
        recipientDeviceId: Number(input.targetDeviceId)
    };
});

const pullEnvelopes = async (userId, deviceId, limit = 100) => {
    const device = await getDeviceRow(pool, userId, deviceId);
    if (!device) throw httpError(403, 'Thiết bị không hoạt động');
    const { rows } = await pool.query(
        `SELECT id, sender_user_id, sender_device_pk, ciphertext, message_type,
                delivery_class, content_kind, client_timestamp_ms, operation_epoch_ms,
                server_timestamp_ms, client_message_id, recipient_registration_id
         FROM e2ee_sdk_envelopes
         WHERE recipient_device_pk = $1 AND acknowledged_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY server_timestamp_ms, id LIMIT $2`,
        [device.id, Math.max(1, Math.min(Number(limit) || 100, 200))]
    );
    return rows.map(row => ({
        id: row.id,
        senderUserId: String(row.sender_user_id),
        senderDeviceId: Number(row.sender_device_pk),
        ciphertext: row.ciphertext,
        messageType: row.message_type,
        deliveryClass: row.delivery_class,
        contentKind: row.content_kind,
        timestamp: Number(row.client_timestamp_ms),
        operationEpochMilliseconds: row.operation_epoch_ms == null ? undefined : Number(row.operation_epoch_ms),
        serverTimestamp: Number(row.server_timestamp_ms),
        clientMessageId: row.client_message_id,
        recipientRegistrationId: row.recipient_registration_id == null ? undefined : Number(row.recipient_registration_id)
    }));
};

const markDelivered = async (userId, deviceId, envelopeId) => {
    const { rows } = await pool.query(
        `UPDATE e2ee_sdk_envelopes e SET delivered_at = COALESCE(delivered_at, NOW()),
            acknowledged_at = COALESCE(acknowledged_at, NOW())
         FROM e2ee_sdk_devices d
         WHERE e.id = $1 AND e.recipient_device_pk = d.id
           AND d.user_id = $2 AND d.device_id = $3 AND d.revoked_at IS NULL
         RETURNING e.id`,
        [envelopeId, userId, deviceId]
    );
    if (!rows[0]) throw httpError(404, 'Không tìm thấy envelope hoặc không thuộc thiết bị này');
    return { id: rows[0].id, acknowledged: true };
};

const getDeviceBySlot = async (userId, deviceId) => {
    const { rows } = await pool.query(
        'SELECT id, device_id, registration_id FROM e2ee_sdk_devices WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL AND enabled = TRUE AND registered = TRUE',
        [userId, deviceId]
    );
    return rows[0] || null;
};

module.exports = {
    registerDevice, getDevices, removeDevice, provisionIdentity,
    uploadPreKeys, getPreKeyCount, getPreKeyInventory, fetchPreKeyBundle,
    sendEnvelope, pullEnvelopes, markDelivered, getDeviceBySlot
};
