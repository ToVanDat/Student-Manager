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
            'SELECT device_id FROM e2ee_sdk_devices WHERE user_id = $1 ORDER BY device_id',
            [userId]
        );
        const used = new Set(rows.map(row => Number(row.device_id)));
        deviceId = rows.length === 0 ? 1 : [2, 3, 4, 5].find(id => !used.has(id));
        if (!deviceId) throw httpError(409, 'Tài khoản đã đạt giới hạn 5 thiết bị E2EE');
    }
    const existingResult = await client.query(
        'SELECT id, revoked_at FROM e2ee_sdk_devices WHERE user_id = $1 AND device_id = $2 AND identity_type = \'aci\' FOR UPDATE',
        [userId, deviceId]
    );
    if (existingResult.rows[0]) {
        throw httpError(409, existingResult.rows[0].revoked_at
            ? 'Device slot đã bị thu hồi; không được tái sử dụng'
            : 'Device slot đã được sử dụng');
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

const getDevices = async (userId) => {
    const { rows } = await pool.query(
        `SELECT device_id, device_type, registered, linked, enabled, last_seen_at, created_at
         FROM e2ee_sdk_devices
         WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY device_id`,
        [userId]
    );
    return rows.map(row => ({
        deviceId: Number(row.device_id),
        deviceType: row.device_type,
        registered: Boolean(row.registered),
        linked: Boolean(row.linked),
        enabled: Boolean(row.enabled),
        lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : null,
        createdAt: new Date(row.created_at).getTime()
    }));
};

const removeDevice = async (userId, deviceId) => withTransaction(async client => {
    if (deviceId === 1) throw httpError(409, 'Không thể thu hồi thiết bị chính bằng API liên kết thiết bị');
    const deviceResult = await client.query(
        'SELECT id FROM e2ee_sdk_devices WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL FOR UPDATE',
        [userId, deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device) throw httpError(404, 'Không tìm thấy thiết bị E2EE đang hoạt động');
    await client.query('DELETE FROM e2ee_sdk_envelopes WHERE recipient_device_pk = $1 AND acknowledged_at IS NULL', [device.id]);
    await client.query('DELETE FROM e2ee_sdk_prekeys WHERE device_pk = $1', [device.id]);
    const { rows } = await client.query(
        'UPDATE e2ee_sdk_devices SET revoked_at = NOW(), enabled = FALSE WHERE id = $1 RETURNING id, device_id',
        [device.id]
    );
    return { deviceId: Number(rows[0].device_id) };
});

const getIdentityKey = async (userId, identityType = 'aci') => {
    const { rows } = await pool.query(
        'SELECT identity_public FROM e2ee_sdk_identities WHERE user_id = $1 AND identity_type = $2 LIMIT 1',
        [userId, identityType]
    );
    return rows[0]?.identity_public || null;
};

const getActiveDevices = async (userId) => {
    const { rows } = await pool.query(
        'SELECT user_id, device_id FROM e2ee_sdk_devices WHERE user_id = $1 AND revoked_at IS NULL AND enabled = TRUE AND registered = TRUE ORDER BY device_id',
        [userId]
    );
    return rows.map(row => ({ userId: String(row.user_id), deviceId: Number(row.device_id) }));
};

const clearStaleKemPreKeys = async (userId, deviceId, identityType = 'aci') => {
    const { rows } = await pool.query(
        `DELETE FROM e2ee_sdk_prekeys p USING e2ee_sdk_devices d
         WHERE p.device_pk = d.id AND d.user_id = $1 AND d.device_id = $2
           AND d.identity_type = $3 AND p.identity_type = $3 AND p.key_type = 'kemOneTimePreKey'
         RETURNING p.id`,
        [userId, deviceId, identityType]
    );
    return { cleared: rows.length };
};

const provisionIdentity = async (userId, deviceId, identity, registrationId, identityType = 'aci') =>
    withTransaction(async client => {
        const device = await getDeviceRow(client, userId, deviceId, identityType, true);
        if (!device) throw httpError(404, 'Không tìm thấy thiết bị E2EE đang hoạt động');
        if (Number(device.registration_id) !== registrationId) {
            if (device.identity_public) {
                throw httpError(409, 'registrationId không khớp thiết bị đã provision');
            }
            await client.query(
                'UPDATE e2ee_sdk_devices SET registration_id = $3 WHERE user_id = $1 AND device_id = $2 AND identity_type = $4',
                [userId, deviceId, registrationId, identityType]
            );
        }
        const canonical = await client.query(
            'SELECT identity_public FROM e2ee_sdk_identities WHERE user_id = $1 AND identity_type = $2 FOR UPDATE',
            [userId, identityType]
        );
        if (canonical.rows[0]) {
            const current = canonical.rows[0].identity_public;
            if (Number(current?.version) !== Number(identity?.version) ||
                current?.x25519PublicKey !== identity?.x25519PublicKey ||
                current?.ed25519PublicKey !== identity?.ed25519PublicKey) {
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

    const canonicalResult = await client.query(
        'SELECT identity_public FROM e2ee_sdk_identities WHERE user_id = $1 AND identity_type = $2',
        [targetUserId, identityType]
    );
    const identity = canonicalResult.rows[0]?.identity_public || device.identity_public;
    if (!identity) return null;

    const { rows: keyRows } = await client.query(
        `SELECT id, key_type, key_id, public_key, signature
         FROM e2ee_sdk_prekeys WHERE device_pk = $1 AND identity_type = $2 ORDER BY key_id`,
        [device.id, identityType]
    );
    const find = type => keyRows.find(row => row.key_type === type);
    const signed = find('ecSignedPreKey');
    const kemLast = find('kemLastResortPreKey');
    if (!signed) throw httpError(409, 'Thiết bị chưa có EC signed prekey');

    const claimOne = async type => {
        const { rows } = await client.query(
            `SELECT id, key_id, public_key, signature FROM e2ee_sdk_prekeys
             WHERE device_pk = $1 AND identity_type = $2 AND key_type = $3 AND claimed_at IS NULL
             ORDER BY key_id LIMIT 1 FOR UPDATE SKIP LOCKED`,
            [device.id, identityType, type]
        );
        if (!rows[0]) return null;
        await client.query('UPDATE e2ee_sdk_prekeys SET claimed_at = NOW() WHERE id = $1 AND claimed_at IS NULL', [rows[0].id]);
        return { keyId: Number(rows[0].key_id), publicKey: rows[0].public_key, ...(rows[0].signature ? { signature: rows[0].signature } : {}) };
    };
    const ecOne = await claimOne('ecPreKey');
    const kemOne = await claimOne('kemOneTimePreKey');
    if (!kemOne && !kemLast) throw httpError(409, 'Thiết bị chưa có KEM prekey');
    return {
        registrationId: Number(device.registration_id),
        deviceId: Number(device.device_id),
        identity,
        ecSignedPreKey: { keyId: Number(signed.key_id), publicKey: signed.public_key, signature: signed.signature },
        ecOneTimePreKey: ecOne,
        kemLastResortPreKey: kemOne ? null : (kemLast ? { keyId: Number(kemLast.key_id), publicKey: kemLast.public_key, signature: kemLast.signature } : null),
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
        `SELECT e.id, e.sender_user_id, sd.device_id AS sender_device_id,
                e.ciphertext, e.message_type, e.delivery_class, e.content_kind,
                e.client_timestamp_ms, e.operation_epoch_ms, e.server_timestamp_ms,
                e.client_message_id, e.recipient_registration_id
         FROM e2ee_sdk_envelopes e
         JOIN e2ee_sdk_devices sd ON sd.id = e.sender_device_pk
         WHERE e.recipient_device_pk = $1 AND e.acknowledged_at IS NULL
           AND (e.expires_at IS NULL OR e.expires_at > NOW())
         ORDER BY e.server_timestamp_ms, e.id LIMIT $2`,
        [device.id, Math.max(1, Math.min(Number(limit) || 100, 200))]
    );
    return rows.map(row => ({
        id: row.id,
        senderUserId: String(row.sender_user_id),
        senderDeviceId: Number(row.sender_device_id),
        targetUserId: String(userId),
        targetDeviceId: Number(deviceId),
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

const getConversationE2EEStatus = async (requesterId, conversationId) => {
    const member = await pool.query(
        'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL LIMIT 1',
        [conversationId, requesterId]
    );
    if (!member.rowCount) throw httpError(403, 'Bạn không thuộc conversation này');
    const { rows } = await pool.query(
        `SELECT c.type,
            EXISTS (SELECT 1 FROM conversation_e2ee_settings s WHERE s.conversation_id = c.id) AS enabled,
            (SELECT COUNT(*)::int FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.left_at IS NULL) AS member_count,
            (SELECT COUNT(*)::int FROM e2ee_sdk_devices d JOIN conversation_members cm ON cm.user_id = d.user_id
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE) AS active_device_count,
            (SELECT COUNT(*)::int FROM e2ee_sdk_devices d JOIN conversation_members cm ON cm.user_id = d.user_id
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE
               AND d.identity_public IS NOT NULL
               AND EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'ecSignedPreKey')
               AND (EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'kemLastResortPreKey')
                    OR EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'kemOneTimePreKey' AND p.claimed_at IS NULL))) AS ready_device_count
         FROM conversations c WHERE c.id = $1 LIMIT 1`,
        [conversationId]
    );
    if (!rows[0]) throw httpError(404, 'Không tìm thấy conversation');
    return {
        conversationId: Number(conversationId),
        type: rows[0].type,
        enabled: Boolean(rows[0].enabled),
        memberCount: Number(rows[0].member_count),
        activeDeviceCount: Number(rows[0].active_device_count),
        readyDeviceCount: Number(rows[0].ready_device_count),
        canEnable: rows[0].type === 'direct' && Number(rows[0].member_count) === 2 &&
            Number(rows[0].active_device_count) > 0 && Number(rows[0].active_device_count) === Number(rows[0].ready_device_count)
    };
};

const enableConversationE2EE = async (requesterId, conversationId) => withTransaction(async client => {
    await assertConversationMember(client, conversationId, requesterId);
    const statusResult = await client.query(
        `SELECT c.type,
            (SELECT COUNT(*)::int FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.left_at IS NULL) AS member_count,
            (SELECT COUNT(*)::int FROM e2ee_sdk_devices d JOIN conversation_members cm ON cm.user_id = d.user_id
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE) AS active_device_count,
            (SELECT COUNT(*)::int FROM e2ee_sdk_devices d JOIN conversation_members cm ON cm.user_id = d.user_id
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE
               AND d.identity_public IS NOT NULL
               AND EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'ecSignedPreKey')
               AND (EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'kemLastResortPreKey')
                    OR EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'kemOneTimePreKey' AND p.claimed_at IS NULL))) AS ready_device_count
         FROM conversations c WHERE c.id = $1 FOR UPDATE`,
        [conversationId]
    );
    const status = statusResult.rows[0];
    if (!status) throw httpError(404, 'Không tìm thấy conversation');
    if (status.type !== 'direct' || Number(status.member_count) !== 2) {
        throw httpError(409, 'Giai đoạn này chỉ hỗ trợ kích hoạt E2EE cho chat 1-1');
    }
    if (Number(status.active_device_count) < 2 || Number(status.active_device_count) !== Number(status.ready_device_count)) {
        throw httpError(409, 'Mọi thiết bị đang hoạt động của cả hai người cần đăng ký identity và prekey trước khi bật E2EE', 'E2EE_DEVICE_NOT_READY');
    }
    const { rows } = await client.query(
        `INSERT INTO conversation_e2ee_settings (conversation_id, protocol, enabled_by, mode)
         VALUES ($1, 'open-e2ee-signal-v11', $2, 'direct')
         ON CONFLICT (conversation_id) DO NOTHING
         RETURNING conversation_id, protocol, enabled_at, enabled_by, mode`,
        [conversationId, requesterId]
    );
    const current = rows[0] || (await client.query(
        'SELECT conversation_id, protocol, enabled_at, enabled_by, mode FROM conversation_e2ee_settings WHERE conversation_id = $1',
        [conversationId]
    )).rows[0];
    return { ...current, enabled: true };
});
const getDeviceBySlot = async (userId, deviceId) => {
    const { rows } = await pool.query(
        'SELECT id, device_id, registration_id FROM e2ee_sdk_devices WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL AND enabled = TRUE AND registered = TRUE',
        [userId, deviceId]
    );
    return rows[0] || null;
};

module.exports = {
    registerDevice, getDevices, removeDevice, getIdentityKey, getActiveDevices, clearStaleKemPreKeys, provisionIdentity,
    uploadPreKeys, getPreKeyCount, getPreKeyInventory, fetchPreKeyBundle,
    sendEnvelope, pullEnvelopes, markDelivered, getConversationE2EEStatus, enableConversationE2EE, getDeviceBySlot
};
