const crypto = require('crypto');
const pool = require('../src/config/database');
const { decodeCanonical32, digestProvisioningCiphertext, verifyProvisioningProof } = require('../utils/e2eeProvisioningProof');

const httpError = (statusCode, message, code) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (code) error.code = code;
    return error;
};

const compositeIdentityBytes = identity => {
    if (!identity || Number(identity.version) !== 1) throw httpError(400, 'CompositeIdentityV1 không hợp lệ');
    const decodeKey = (value, name) => {
        if (typeof value !== 'string') throw httpError(400, `${name} không hợp lệ`);
        const bytes = Buffer.from(value, 'base64');
        if (bytes.length !== 32 || bytes.toString('base64') !== value) throw httpError(400, `${name} phải là base64 canonical 32 byte`);
        return bytes;
    };
    const x = decodeKey(identity.x25519PublicKey, 'x25519PublicKey');
    const ed = decodeKey(identity.ed25519PublicKey, 'ed25519PublicKey');
    const encoded = Buffer.alloc(67);
    encoded[0] = 1; encoded[1] = 1; x.copy(encoded, 2); encoded[34] = 2; ed.copy(encoded, 35);
    return encoded;
};

const identityCommitment = identity => crypto.createHash('sha256')
    .update(Buffer.concat([Buffer.from('signal-protocol-js composite identity v1', 'utf8'), compositeIdentityBytes(identity)]))
    .digest();

const identityCommitmentBase64 = identity => identityCommitment(identity).toString('base64');
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
        "SELECT 1 FROM conversation_e2ee_settings WHERE conversation_id = $1 AND e2ee_state = 'active' LIMIT 1",
        [conversationId]
    );
    if (!rowCount) throw httpError(409, 'E2EE chưa ở trạng thái hoạt động cho conversation này', 'E2EE_NOT_ACTIVE');
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
        deviceId = rows.length === 0 ? 1 : [2, 3, 4, 5].find(id => !used.has(id));
        if (!deviceId) throw httpError(409, 'Tài khoản đã đạt giới hạn 5 thiết bị E2EE');
    }
    const existingResult = await client.query(
        'SELECT id, revoked_at, registration_id, device_type, registered, linked, enabled, created_at FROM e2ee_sdk_devices WHERE user_id = $1 AND device_id = $2 AND identity_type = \'aci\' AND revoked_at IS NULL FOR UPDATE',
        [userId, deviceId]
    );
    if (existingResult.rows[0]) {
        const existing = existingResult.rows[0];
        if (existing.revoked_at) throw httpError(409, 'Device slot đã bị thu hồi; không được tái sử dụng');
        await client.query('UPDATE e2ee_sdk_devices SET last_seen_at = NOW() WHERE id = $1', [existing.id]);
        return {
            device_id: Number(deviceId),
            registration_id: Number(existing.registration_id),
            device_type: existing.device_type,
            registered: Boolean(existing.registered),
            linked: Boolean(existing.linked),
            enabled: Boolean(existing.enabled),
            created_at: existing.created_at
        };
    }
    const deviceToken = crypto.randomBytes(32).toString('base64url');
    const deviceTokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    const { rows } = await client.query(
        `INSERT INTO e2ee_sdk_devices
          (user_id, device_id, registration_id, device_type, encrypted_device_name, linked, identity_type, device_token_hash)
         VALUES ($1,$2,$3,$4,$5,$6,'aci',$7)
         RETURNING device_id, registration_id, device_type, registered, linked, enabled, created_at`,
        [userId, deviceId, input.registrationId, input.deviceType || 'web',
            input.encryptedDeviceName || null, deviceId !== 1, deviceTokenHash]
    );
    return { ...rows[0], device_token: deviceToken };
});

const getDevices = async (userId) => {
    // Give local installations a clear, actionable response when the additive
    // SDK relay migration has not been applied, instead of leaking a generic 500
    // caused by PostgreSQL's "relation does not exist" error.
    const schema = await pool.query(
        "SELECT to_regclass('public.e2ee_sdk_devices') IS NOT NULL AS devices_ready"
    );
    if (!schema.rows[0]?.devices_ready) {
        throw httpError(
            503,
            'E2EE relay chưa sẵn sàng: cần áp dụng sql/e2ee_foundation_migration.sql vào database đang được backend sử dụng rồi khởi động lại backend.',
            'E2EE_SCHEMA_NOT_READY'
        );
    }
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

const rotateIdentityKey = async (userId, deviceId, identity, registrationId, expectedCommitmentBase64, identityType = 'aci') =>
    withTransaction(async client => {
        const device = await getDeviceRow(client, userId, deviceId, identityType, true);
        if (!device) throw httpError(401, 'Thiết bị E2EE không còn hoạt động');
        const currentResult = await client.query(
            'SELECT identity_public, identity_commitment FROM e2ee_sdk_identities WHERE user_id = $1 AND identity_type = $2 FOR UPDATE',
            [userId, identityType]
        );
        const current = currentResult.rows[0];
        if (!current) throw httpError(404, 'Không có identity hiện tại để xoay khóa');
        const expected = Buffer.from(expectedCommitmentBase64, 'base64');
        if (expected.length !== 32 || expected.toString('base64') !== expectedCommitmentBase64) {
            throw httpError(400, 'expectedCurrentCommitment phải là base64 của 32 byte');
        }
        const currentCommitment = identityCommitment(current.identity_public);
        if (!crypto.timingSafeEqual(currentCommitment, expected)) {
            throw httpError(409, 'Identity đã thay đổi; cần tải lại trạng thái trước khi xoay khóa', 'E2EE_IDENTITY_COMMITMENT_MISMATCH');
        }
        const nextCommitment = identityCommitment(identity);
        if (crypto.timingSafeEqual(currentCommitment, nextCommitment)) {
            throw httpError(409, 'Identity mới trùng identity hiện tại');
        }
        await client.query(
            `UPDATE e2ee_sdk_identities SET identity_public = $3::jsonb, identity_commitment = $4,
                revision = revision + 1, updated_at = NOW()
             WHERE user_id = $1 AND identity_type = $2`,
            [userId, identityType, JSON.stringify(identity), nextCommitment.toString('base64')]
        );
        const revoked = await client.query(
            `UPDATE e2ee_sdk_devices SET enabled = FALSE, revoked_at = NOW(), device_token_hash = NULL
             WHERE user_id = $1 AND identity_type = $2 AND id <> $3 AND revoked_at IS NULL
             RETURNING id`,
            [userId, identityType, device.id]
        );
        if (revoked.rows.length) {
            const ids = revoked.rows.map(row => row.id);
            await client.query('DELETE FROM e2ee_sdk_prekeys WHERE device_pk = ANY($1::bigint[])', [ids]);
            await client.query('DELETE FROM e2ee_sdk_envelopes WHERE recipient_device_pk = ANY($1::bigint[]) AND acknowledged_at IS NULL', [ids]);
        }
        await client.query('DELETE FROM e2ee_sdk_prekeys WHERE device_pk = $1', [device.id]);
        await client.query(
            `UPDATE e2ee_sdk_devices SET identity_public = $2::jsonb, registration_id = $3, last_seen_at = NOW()
             WHERE id = $1`,
            [device.id, JSON.stringify(identity), registrationId]
        );
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
            'SELECT identity_public, identity_commitment FROM e2ee_sdk_identities WHERE user_id = $1 AND identity_type = $2 FOR UPDATE',
            [userId, identityType]
        );
        const commitment = identityCommitmentBase64(identity);
        if (canonical.rows[0]) {
            const current = canonical.rows[0].identity_public;
            if (Number(current?.version) !== Number(identity?.version) ||
                current?.x25519PublicKey !== identity?.x25519PublicKey ||
                current?.ed25519PublicKey !== identity?.ed25519PublicKey) {
                throw httpError(409, 'Identity tài khoản đã tồn tại; linked device phải dùng cùng CompositeIdentityV1');
            }
            if (!canonical.rows[0].identity_commitment) {
                await client.query(
                    'UPDATE e2ee_sdk_identities SET identity_commitment = $3, updated_at = NOW() WHERE user_id = $1 AND identity_type = $2',
                    [userId, identityType, commitment]
                );
            }
        } else {
            await client.query(
                'INSERT INTO e2ee_sdk_identities (user_id, identity_type, identity_public, identity_commitment) VALUES ($1,$2,$3::jsonb,$4)',
                [userId, identityType, JSON.stringify(identity), commitment]
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
             ON CONFLICT (device_pk, identity_type, key_type, key_id) DO NOTHING`,
            [device.id, identityType, key.type, key.keyId, key.publicKey, key.signature || null]
        );
        const existing = await client.query(
            `SELECT public_key, signature FROM e2ee_sdk_prekeys
             WHERE device_pk = $1 AND identity_type = $2 AND key_type = $3 AND key_id = $4`,
            [device.id, identityType, key.type, key.keyId]
        );
        if (existing.rows[0]?.public_key !== key.publicKey ||
            (existing.rows[0]?.signature || null) !== (key.signature || null)) {
            throw httpError(409, 'Prekey ID đã được sử dụng với nội dung khác; không ghi đè khóa đã công bố');
        }
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
    const first = type => rows.filter(row => row.key_type === type).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
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
         FROM e2ee_sdk_prekeys WHERE device_pk = $1 AND identity_type = $2 ORDER BY created_at DESC, key_id DESC`,
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
    const schema = await client.query(
        "SELECT to_regclass('public.conversation_e2ee_settings') IS NOT NULL AS ready"
    );
    if (!schema.rows[0]?.ready) throw httpError(503, 'Cần chạy migration E2EE trước khi gửi envelope', 'E2EE_SCHEMA_NOT_READY');
    const enabled = await client.query(
        'SELECT 1 FROM conversation_e2ee_settings WHERE conversation_id = $1 LIMIT 1',
        [conversationId]
    );
    if (!enabled.rowCount) throw httpError(409, 'Cuộc trò chuyện chưa bật E2EE', 'E2EE_NOT_ENABLED');
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
        return {
            id: existing.rows[0].id,
            serverTimestamp: Number(existing.rows[0].server_timestamp_ms),
            duplicate: true,
            notifyRecipient: false,
            conversationId: Number(conversationId),
            recipientUserId: Number(input.targetUserId),
            recipientDeviceId: Number(input.targetDeviceId)
        };
    }

    // A logical message is fanned out to every recipient device. Serialize
    // first-delivery notification decisions per sender/message/recipient user
    // so each device does not create a duplicate notification.
    const notificationLockKey = `${senderUserId}:${input.clientMessageId}:${input.targetUserId}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [notificationLockKey]);
    const priorRecipientEnvelope = await client.query(
        `SELECT 1 FROM e2ee_sdk_envelopes
         WHERE sender_user_id = $1 AND client_message_id = $2 AND recipient_user_id = $3
         LIMIT 1`,
        [senderUserId, input.clientMessageId, input.targetUserId]
    );
    const notifyRecipient = !priorRecipientEnvelope.rowCount &&
        input.deliveryClass === 'user-visible' && (input.contentKind || 'message') === 'message';

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
        notifyRecipient,
        conversationId: Number(conversationId),
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

// E2EE activation is paused by default. Existing enabled conversations remain untouched.
const isE2EEActivationEnabled = () => process.env.E2EE_ACTIVATION_ENABLED === 'true';

const getConversationE2EEStatus = async (requesterId, conversationId) => {
    const schema = await pool.query(
        "SELECT to_regclass('public.conversation_e2ee_settings') IS NOT NULL AS settings_ready, to_regclass('public.e2ee_sdk_devices') IS NOT NULL AS devices_ready"
    );
    if (!schema.rows[0]?.settings_ready || !schema.rows[0]?.devices_ready) {
        return {
            conversationId: Number(conversationId),
            available: false,
            enabled: false,
            activationEnabled: isE2EEActivationEnabled(),
            canEnable: false,
            memberCount: 0,
            activeDeviceCount: 0,
            readyDeviceCount: 0,
            membersWithoutDevices: 0
        };
    }
    const member = await pool.query(
        'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL LIMIT 1',
        [conversationId, requesterId]
    );
    if (!member.rowCount) throw httpError(403, 'Bạn không thuộc conversation này');
    const { rows } = await pool.query(
        `SELECT c.type,
            EXISTS (SELECT 1 FROM conversation_e2ee_settings s WHERE s.conversation_id = c.id) AS enabled,
            COALESCE((SELECT s.e2ee_state FROM conversation_e2ee_settings s WHERE s.conversation_id = c.id LIMIT 1), 'active') AS mode,
            (SELECT s.paused_at FROM conversation_e2ee_settings s WHERE s.conversation_id = c.id LIMIT 1) AS paused_at,
            (SELECT COUNT(*)::int FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.left_at IS NULL) AS member_count,
            (SELECT COUNT(*)::int FROM e2ee_sdk_devices d JOIN conversation_members cm ON cm.user_id = d.user_id
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE) AS active_device_count,
            (SELECT COUNT(*)::int FROM conversation_members cm
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM e2ee_sdk_devices d WHERE d.user_id = cm.user_id AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE)) AS members_without_devices,
            (SELECT COUNT(*)::int FROM e2ee_sdk_devices d JOIN conversation_members cm ON cm.user_id = d.user_id
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE AND d.device_token_hash IS NOT NULL
               AND d.identity_public IS NOT NULL
               AND EXISTS (SELECT 1 FROM e2ee_sdk_identities i WHERE i.user_id = d.user_id AND i.identity_type = d.identity_type AND i.identity_public = d.identity_public)
               AND EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'ecSignedPreKey' AND p.signature IS NOT NULL)
               AND (EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'kemLastResortPreKey' AND p.signature IS NOT NULL)
                    OR EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'kemOneTimePreKey' AND p.signature IS NOT NULL AND p.claimed_at IS NULL))) AS ready_device_count
         FROM conversations c WHERE c.id = $1 LIMIT 1`,
        [conversationId]
    );
    if (!rows[0]) throw httpError(404, 'Không tìm thấy conversation');
    return {
        conversationId: Number(conversationId),
        type: rows[0].type,
        available: true,
        enabled: Boolean(rows[0].enabled),
        mode: rows[0].mode || 'active',
        activationEnabled: isE2EEActivationEnabled(),
        memberCount: Number(rows[0].member_count),
        activeDeviceCount: Number(rows[0].active_device_count),
        readyDeviceCount: Number(rows[0].ready_device_count),
        membersWithoutDevices: Number(rows[0].members_without_devices),
        canEnable: isE2EEActivationEnabled() && rows[0].type === 'direct' && Number(rows[0].member_count) === 2 &&
            Number(rows[0].members_without_devices) === 0 &&
            Number(rows[0].active_device_count) > 0 && Number(rows[0].active_device_count) === Number(rows[0].ready_device_count)
    };
};

const pauseConversationE2EE = async (requesterId, conversationId) => withTransaction(async client => {
    const schema = await client.query("SELECT to_regclass('public.conversation_e2ee_settings') IS NOT NULL AS settings_ready");
    if (!schema.rows[0]?.settings_ready) throw httpError(503, 'Cần chạy migration E2EE trước khi tạm dừng', 'E2EE_SCHEMA_NOT_READY');
    await assertConversationMember(client, conversationId, requesterId);
    const result = await client.query(
        `UPDATE conversation_e2ee_settings SET e2ee_state = 'paused', paused_at = NOW(), paused_by = $2
         WHERE conversation_id = $1 AND e2ee_state = 'active'
         RETURNING conversation_id, e2ee_state AS mode, paused_at`,
        [conversationId, requesterId]
    );
    if (!result.rowCount) {
        const existing = await client.query('SELECT e2ee_state AS mode, paused_at FROM conversation_e2ee_settings WHERE conversation_id = $1 LIMIT 1', [conversationId]);
        if (!existing.rowCount) throw httpError(409, 'E2EE chưa được bật cho cuộc trò chuyện này', 'E2EE_NOT_ENABLED');
        return { conversationId: Number(conversationId), mode: existing.rows[0].mode, pausedAt: existing.rows[0].paused_at, alreadyPaused: true };
    }
    return { conversationId: Number(conversationId), mode: result.rows[0].mode, pausedAt: result.rows[0].paused_at, alreadyPaused: false };
});

const enableConversationE2EE = async (requesterId, conversationId) => withTransaction(async client => {
    // Server-side enforcement is authoritative; UI state is not a security boundary.
    if (!isE2EEActivationEnabled()) {
        throw httpError(503, 'E2EE đang tạm dừng kích hoạt mới. Lịch sử và các cuộc trò chuyện E2EE hiện có được giữ nguyên.', 'E2EE_ACTIVATION_PAUSED');
    }
    const schema = await client.query(
        "SELECT to_regclass('public.conversation_e2ee_settings') IS NOT NULL AS settings_ready, to_regclass('public.e2ee_sdk_devices') IS NOT NULL AS devices_ready"
    );
    if (!schema.rows[0]?.settings_ready || !schema.rows[0]?.devices_ready) {
        throw httpError(503, 'Cần chạy migration E2EE trước khi kích hoạt', 'E2EE_SCHEMA_NOT_READY');
    }
    await assertConversationMember(client, conversationId, requesterId);
    const statusResult = await client.query(
        `SELECT c.type,
            (SELECT COUNT(*)::int FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.left_at IS NULL) AS member_count,
            (SELECT COUNT(*)::int FROM e2ee_sdk_devices d JOIN conversation_members cm ON cm.user_id = d.user_id
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE) AS active_device_count,
            (SELECT COUNT(*)::int FROM conversation_members cm
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM e2ee_sdk_devices d WHERE d.user_id = cm.user_id AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE)) AS members_without_devices,
            (SELECT COUNT(*)::int FROM e2ee_sdk_devices d JOIN conversation_members cm ON cm.user_id = d.user_id
             WHERE cm.conversation_id = c.id AND cm.left_at IS NULL AND d.revoked_at IS NULL AND d.enabled = TRUE AND d.registered = TRUE AND d.device_token_hash IS NOT NULL
               AND d.identity_public IS NOT NULL
               AND EXISTS (SELECT 1 FROM e2ee_sdk_identities i WHERE i.user_id = d.user_id AND i.identity_type = d.identity_type AND i.identity_public = d.identity_public)
               AND EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'ecSignedPreKey' AND p.signature IS NOT NULL)
               AND (EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'kemLastResortPreKey' AND p.signature IS NOT NULL)
                    OR EXISTS (SELECT 1 FROM e2ee_sdk_prekeys p WHERE p.device_pk = d.id AND p.key_type = 'kemOneTimePreKey' AND p.signature IS NOT NULL AND p.claimed_at IS NULL))) AS ready_device_count
         FROM conversations c WHERE c.id = $1 FOR UPDATE`,
        [conversationId]
    );
    const status = statusResult.rows[0];
    if (!status) throw httpError(404, 'Không tìm thấy conversation');
    if (status.type !== 'direct' || Number(status.member_count) !== 2) {
        throw httpError(409, 'Giai đoạn này chỉ hỗ trợ kích hoạt E2EE cho chat 1-1');
    }
    if (Number(status.members_without_devices) > 0 || Number(status.active_device_count) < 2 || Number(status.active_device_count) !== Number(status.ready_device_count)) {
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
const expireProvisioningSessions = async (client, userId) => {
    const { rows } = await client.query(
        `SELECT session_id, status, assigned_device_id, completed_at
         FROM e2ee_sdk_provisioning_sessions
         WHERE owner_user_id = $1 AND expires_at <= NOW()
           AND status NOT IN ('rolled_back', 'expired')
         FOR UPDATE`,
        [userId]
    );
    if (!rows.length) return 0;

    // Expired linked-but-unacknowledged devices must not remain active.
    // The timestamp guard prevents deleting a later device that reused the slot.
    for (const session of rows) {
        if (session.status === 'linked_pending_ack' && session.assigned_device_id && session.completed_at) {
            await client.query(
                `DELETE FROM e2ee_sdk_devices
                 WHERE user_id = $1 AND device_id = $2 AND linked = TRUE
                   AND revoked_at IS NULL AND created_at < $3::timestamptz + INTERVAL '1 millisecond'`,
                [userId, session.assigned_device_id, session.completed_at]
            );
        }
    }

    const sessionIds = rows.map(row => row.session_id);
    await client.query(
        `UPDATE e2ee_sdk_provisioning_sessions
         SET status = CASE WHEN status = 'completed' THEN 'completed' ELSE 'expired' END,
             new_device_ephemeral_public_key = NULL, new_device_metadata = NULL,
             encrypted_message = NULL, encrypted_device_name = NULL,
             proof_challenge = NULL
         WHERE session_id = ANY($1::uuid[]) AND owner_user_id = $2
           AND status NOT IN ('rolled_back', 'expired')`,
        [sessionIds, userId]
    );
    return rows.length;
};

const createProvisioningSession = async (userId, ephemeralPublicKey, proofProtocolVersion = null) => {
    const primary = await getDeviceBySlot(userId, 1);
    if (!primary) throw httpError(409, 'Thiết bị chính chưa đăng ký E2EE');
    if (proofProtocolVersion !== null && proofProtocolVersion !== 1) {
        throw httpError(400, 'proofProtocolVersion không được hỗ trợ');
    }
    const sessionId = crypto.randomUUID();
    return withTransaction(async client => {
        await expireProvisioningSessions(client, userId);
        const { rows } = await client.query(
            `INSERT INTO e2ee_sdk_provisioning_sessions
                (session_id, owner_user_id, owner_ephemeral_public_key, proof_protocol_version)
             VALUES ($1,$2,$3,$4) RETURNING session_id, expires_at`,
            [sessionId, userId, ephemeralPublicKey, proofProtocolVersion]
        );
        return {
            sessionId: rows[0].session_id,
            expiresAt: new Date(rows[0].expires_at).getTime(),
            ...(proofProtocolVersion === 1 ? { proofProtocolVersion: 1 } : {})
        };
    });
};

const connectNewDevice = async (userId, sessionId, ephemeralPublicKey, metadata) => withTransaction(async client => {
    await expireProvisioningSessions(client, userId);
    const challenge = crypto.randomBytes(32);
    const { rows } = await client.query(
        `UPDATE e2ee_sdk_provisioning_sessions
         SET new_device_ephemeral_public_key = $3, new_device_metadata = $4::jsonb,
             proof_challenge = CASE WHEN proof_protocol_version = 1 THEN $5::bytea ELSE NULL END,
             status = 'connected'
         WHERE session_id = $1 AND owner_user_id = $2 AND status = 'waiting'
           AND expires_at > NOW()
         RETURNING session_id, proof_protocol_version, proof_challenge`,
        [sessionId, userId, ephemeralPublicKey, JSON.stringify(metadata || {}), challenge]
    );
    if (!rows[0]) throw httpError(404, 'Phiên liên kết thiết bị không tồn tại hoặc đã hết hạn');
    return rows[0].proof_protocol_version === 1
        ? { proofProtocolVersion: 1, proofChallenge: rows[0].proof_challenge.toString('base64') }
        : undefined;
});

const sendProvisioningMessage = async (userId, sessionId, encryptedMessage, proofCommitment = null) => withTransaction(async client => {
    await expireProvisioningSessions(client, userId);
    const commitment = proofCommitment == null ? null : decodeCanonical32(proofCommitment, 'commitment');
    const ciphertextDigest = proofCommitment == null ? null : Buffer.from(digestProvisioningCiphertext(encryptedMessage), 'base64');
    const { rows } = await client.query(
        `UPDATE e2ee_sdk_provisioning_sessions
         SET encrypted_message = $3, status = 'ready',
             proof_commitment = CASE WHEN proof_protocol_version = 1 THEN $4::bytea ELSE NULL END,
             proof_ciphertext_digest = CASE WHEN proof_protocol_version = 1 THEN $5::bytea ELSE NULL END
         WHERE session_id = $1 AND owner_user_id = $2 AND status = 'connected'
           AND expires_at > NOW() AND new_device_ephemeral_public_key IS NOT NULL
           AND ((proof_protocol_version IS NULL AND $4::bytea IS NULL)
             OR (proof_protocol_version = 1 AND proof_challenge IS NOT NULL AND $4::bytea IS NOT NULL AND $5::bytea IS NOT NULL))
         RETURNING session_id`,
        [sessionId, userId, encryptedMessage, commitment, ciphertextDigest]
    );
    if (!rows[0]) throw httpError(409, 'Phiên liên kết chưa sẵn sàng hoặc thiếu commitment proof');
});

const getProvisioningMessage = async (userId, sessionId) => withTransaction(async client => {
    await expireProvisioningSessions(client, userId);
    const { rows } = await client.query(
        `SELECT status, encrypted_message, new_device_ephemeral_public_key, expires_at,
                proof_protocol_version, proof_challenge
         FROM e2ee_sdk_provisioning_sessions
         WHERE session_id = $1 AND owner_user_id = $2 LIMIT 1`,
        [sessionId, userId]
    );
    if (!rows[0]) throw httpError(404, 'Không tìm thấy phiên liên kết thiết bị');
    return {
        status: rows[0].status,
        message: rows[0].encrypted_message || null,
        newDeviceEphemeralPublicKey: rows[0].new_device_ephemeral_public_key || null,
        expiresAt: rows[0].status === 'expired' ? null : new Date(rows[0].expires_at).getTime(),
        ...(rows[0].proof_protocol_version === 1 ? {
            proofProtocolVersion: 1,
            proofChallenge: rows[0].proof_challenge?.toString('base64') || null
        } : {})
    };
};

const completeProvisioning = async (userId, sessionId, encryptedDeviceName, metadata = {}) => withTransaction(async client => {
    await expireProvisioningSessions(client, userId);
    const sessionResult = await client.query(
        `SELECT * FROM e2ee_sdk_provisioning_sessions
         WHERE session_id = $1 AND owner_user_id = $2 AND status = 'ready' AND expires_at > NOW()
         FOR UPDATE`,
        [sessionId, userId]
    );
    const session = sessionResult.rows[0];
    if (!session) throw httpError(409, 'Phiên liên kết chưa sẵn sàng hoặc đã hết hạn');
    if (session.proof_protocol_version === 1 &&
        (!session.proof_challenge || !session.proof_commitment || !session.proof_ciphertext_digest)) {
        throw httpError(409, 'Phiên proof v1 chưa có challenge và commitment hợp lệ', 'E2EE_PROVISIONING_PROOF_NOT_READY');
    }
    // Serialize slot allocation across different provisioning sessions for the same account.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const slots = await client.query('SELECT device_id FROM e2ee_sdk_devices WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    const used = new Set(slots.rows.map(row => Number(row.device_id)));
    const deviceId = [2, 3, 4, 5].find(id => !used.has(id));
    if (!deviceId) throw httpError(409, 'Tài khoản đã đạt giới hạn 5 thiết bị E2EE');
    const registrationId = crypto.randomInt(1, 65536);
    const deviceToken = crypto.randomBytes(32).toString('base64url');
    const deviceTokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    await client.query(
        `INSERT INTO e2ee_sdk_devices (user_id, device_id, registration_id, device_type, encrypted_device_name, linked, identity_type, device_token_hash, enabled)
         VALUES ($1,$2,$3,$4,$5,TRUE,'aci',$6,FALSE)`,
        [userId, deviceId, registrationId, metadata.deviceType || 'web', encryptedDeviceName || null, deviceTokenHash]
    );
    await client.query(
        `UPDATE e2ee_sdk_provisioning_sessions SET assigned_device_id = $2, encrypted_device_name = $3,
             status = 'linked_pending_ack', completed_at = NOW(), expires_at = NOW() + INTERVAL '5 minutes'
         WHERE session_id = $1`,
        [sessionId, deviceId, encryptedDeviceName || null]
    );
    return { deviceId, deviceToken };
});

const acknowledgeProvisioning = async (userId, sessionId, deviceToken, proof = null) => withTransaction(async client => {
    await expireProvisioningSessions(client, userId);
    if (typeof deviceToken !== 'string' || deviceToken.length < 32 || deviceToken.length > 256) {
        throw httpError(401, 'Thiếu xác thực thiết bị mới', 'E2EE_DEVICE_AUTH_REQUIRED');
    }
    const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    const { rows } = await client.query(
        `SELECT assigned_device_id, completed_at, status, proof_protocol_version,
                proof_challenge, proof_commitment, proof_ciphertext_digest,
                encrypted_message, proof_ack_digest
         FROM e2ee_sdk_provisioning_sessions
         WHERE session_id = $1 AND owner_user_id = $2
           AND status IN ('linked_pending_ack', 'completed')
         FOR UPDATE`,
        [sessionId, userId]
    );
    const session = rows[0];
    if (!session?.assigned_device_id || !session.completed_at) {
        return { expiredOrUnavailable: true };
    }

    let proofBytes = null;
    let proofAckDigest = null;
    if (session.proof_protocol_version === 1) {
        if (typeof proof !== 'string' || !session.proof_challenge ||
            !session.proof_commitment || !session.proof_ciphertext_digest) {
            throw httpError(409, 'Phiên yêu cầu provisioning proof v1', 'E2EE_PROVISIONING_PROOF_REQUIRED');
        }
        try {
            proofBytes = decodeCanonical32(proof, 'proof');
        } catch {
            throw httpError(400, 'Provisioning proof không hợp lệ', 'E2EE_PROVISIONING_PROOF_INVALID');
        }
        const storedDigest = Buffer.from(session.proof_ciphertext_digest);
        const currentDigest = session.encrypted_message
            ? Buffer.from(digestProvisioningCiphertext(session.encrypted_message), 'base64')
            : null;
        if (!currentDigest || !crypto.timingSafeEqual(storedDigest, currentDigest) ||
            !verifyProvisioningProof({
                commitment: Buffer.from(session.proof_commitment).toString('base64'),
                proof
            })) {
            proofBytes.fill(0);
            throw httpError(401, 'Provisioning proof không khớp phiên liên kết', 'E2EE_PROVISIONING_PROOF_MISMATCH');
        }
        proofAckDigest = crypto.createHash('sha256').update(proofBytes).digest();
    } else if (proof != null) {
        throw httpError(400, 'Phiên provisioning legacy không nhận proof', 'E2EE_PROVISIONING_PROOF_UNEXPECTED');
    }

    if (session.status === 'completed') {
        const device = await client.query(
            `SELECT device_id FROM e2ee_sdk_devices
             WHERE user_id = $1 AND device_id = $2 AND linked = TRUE
               AND revoked_at IS NULL AND enabled = TRUE AND device_token_hash = $3
               AND created_at < $4::timestamptz + INTERVAL '1 millisecond'
             LIMIT 1`,
            [userId, session.assigned_device_id, tokenHash, session.completed_at]
        );
        const sameProof = session.proof_protocol_version === 1 && session.proof_ack_digest &&
            proofAckDigest && crypto.timingSafeEqual(Buffer.from(session.proof_ack_digest), proofAckDigest);
        if (!device.rows[0] || (session.proof_protocol_version === 1 && !sameProof)) {
            if (proofBytes) proofBytes.fill(0);
            throw httpError(409, 'ACK provisioning đã hoàn tất với thông tin khác', 'E2EE_PROVISIONING_ACK_CONFLICT');
        }
        if (proofBytes) proofBytes.fill(0);
        return { acknowledged: true, alreadyCompleted: true };
    }

    const activated = await client.query(
        `UPDATE e2ee_sdk_devices SET enabled = TRUE
         WHERE user_id = $1 AND device_id = $2 AND linked = TRUE
           AND revoked_at IS NULL AND enabled = FALSE AND device_token_hash = $3
           AND created_at < $4::timestamptz + INTERVAL '1 millisecond'
         RETURNING device_id`,
        [userId, session.assigned_device_id, tokenHash, session.completed_at]
    );
    if (!activated.rows[0]) {
        if (proofBytes) proofBytes.fill(0);
        throw httpError(401, 'Thông tin xác thực thiết bị mới không hợp lệ', 'E2EE_DEVICE_AUTH_FAILED');
    }
    const completed = await client.query(
        `UPDATE e2ee_sdk_provisioning_sessions
         SET status = 'completed',
             proof_consumed_at = CASE WHEN proof_protocol_version = 1 THEN NOW() ELSE NULL END,
             proof_ack_digest = $3::bytea,
             proof_challenge = CASE WHEN proof_protocol_version = 1 THEN NULL ELSE proof_challenge END
         WHERE session_id = $1 AND owner_user_id = $2
           AND status = 'linked_pending_ack' AND expires_at > NOW()
         RETURNING session_id`,
        [sessionId, userId, proofAckDigest]
    );
    if (proofBytes) proofBytes.fill(0);
    if (!completed.rows[0]) throw httpError(409, 'Không thể xác nhận phiên liên kết thiết bị');
    return { acknowledged: true };
});

const rollbackProvisioning = async (userId, sessionId, deviceToken) => withTransaction(async client => {
    await expireProvisioningSessions(client, userId);
    if (typeof deviceToken !== 'string' || deviceToken.length < 32 || deviceToken.length > 256) {
        throw httpError(401, 'Thiếu xác thực thiết bị mới', 'E2EE_DEVICE_AUTH_REQUIRED');
    }
    const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    const { rows } = await client.query(
        `SELECT assigned_device_id, completed_at, status
         FROM e2ee_sdk_provisioning_sessions
         WHERE session_id = $1 AND owner_user_id = $2
           AND status IN ('linked_pending_ack', 'completed')
         FOR UPDATE`,
        [sessionId, userId]
    );
    const session = rows[0];
    // Expiry cleanup may already have removed the pending device. A rollback
    // retry after that cleanup is a safe no-op; the adapter can still clear its
    // local credential and the SDK can clear partially stored local state.
    if (!session) {
        const existing = await client.query(
            `SELECT 1 FROM e2ee_sdk_provisioning_sessions
             WHERE session_id = $1 AND owner_user_id = $2
               AND status IN ('expired', 'rolled_back') LIMIT 1`,
            [sessionId, userId]
        );
        if (existing.rows[0]) return { rolledBack: false, alreadyFinalized: true };
        throw httpError(404, 'Không tìm thấy phiên liên kết cần khôi phục');
    }
    if (!session.assigned_device_id || !session.completed_at) {
        throw httpError(409, 'Phiên liên kết thiếu thông tin thiết bị được cấp');
    }
    if (session.status === 'completed') {
        const revoked = await client.query(
            `UPDATE e2ee_sdk_devices SET enabled = FALSE, revoked_at = NOW(), device_token_hash = NULL
             WHERE user_id = $1 AND device_id = $2 AND linked = TRUE
               AND revoked_at IS NULL AND enabled = TRUE AND device_token_hash = $3
               AND created_at < $4::timestamptz + INTERVAL '1 millisecond'
             RETURNING id`,
            [userId, session.assigned_device_id, tokenHash, session.completed_at]
        );
        if (!revoked.rows[0]) {
            throw httpError(401, 'Thông tin xác thực thiết bị mới không hợp lệ', 'E2EE_DEVICE_AUTH_FAILED');
        }
        await client.query('DELETE FROM e2ee_sdk_envelopes WHERE recipient_device_pk = $1 AND acknowledged_at IS NULL', [revoked.rows[0].id]);
        await client.query('DELETE FROM e2ee_sdk_prekeys WHERE device_pk = $1', [revoked.rows[0].id]);
    } else {
        const removed = await client.query(
            `DELETE FROM e2ee_sdk_devices
             WHERE user_id = $1 AND device_id = $2 AND linked = TRUE
               AND revoked_at IS NULL AND enabled = FALSE AND device_token_hash = $3
               AND created_at < $4::timestamptz + INTERVAL '1 millisecond'
             RETURNING id`,
            [userId, session.assigned_device_id, tokenHash, session.completed_at]
        );
        if (!removed.rows[0]) {
            throw httpError(401, 'Thông tin xác thực thiết bị mới không hợp lệ', 'E2EE_DEVICE_AUTH_FAILED');
        }
    }
    await client.query(
        `UPDATE e2ee_sdk_provisioning_sessions SET status = 'rolled_back'
         WHERE session_id = $1 AND owner_user_id = $2
           AND status IN ('linked_pending_ack', 'completed')`,
        [sessionId, userId]
    );
    return { rolledBack: true };
});

// Owner-authenticated cancellation closes the lost-complete-response gap. It
// can remove only an unacknowledged device; a completed device is never revoked
// through this endpoint. Locking the session serializes cancellation with ACK.
const abortProvisioningSession = async (userId, sessionId) => withTransaction(async client => {
    await expireProvisioningSessions(client, userId);
    const { rows } = await client.query(
        `SELECT assigned_device_id, completed_at, status
         FROM e2ee_sdk_provisioning_sessions
         WHERE session_id = $1 AND owner_user_id = $2
         FOR UPDATE`,
        [sessionId, userId]
    );
    const session = rows[0];
    if (!session) throw httpError(404, 'Không tìm thấy phiên liên kết cần hủy');
    if (session.status === 'completed') {
        return { aborted: false, alreadyCompleted: true };
    }
    if (session.status === 'expired' || session.status === 'rolled_back') {
        return { aborted: false, alreadyFinalized: true };
    }
    if (session.status === 'linked_pending_ack') {
        if (!session.assigned_device_id || !session.completed_at) {
            throw httpError(409, 'Phiên liên kết thiếu thông tin thiết bị được cấp');
        }
        const removed = await client.query(
            `DELETE FROM e2ee_sdk_devices
             WHERE user_id = $1 AND device_id = $2 AND linked = TRUE
               AND revoked_at IS NULL AND enabled = FALSE
               AND created_at < $3::timestamptz + INTERVAL '1 millisecond'
             RETURNING id`,
            [userId, session.assigned_device_id, session.completed_at]
        );
        if (!removed.rows[0]) {
            throw httpError(409, 'Không thể xác nhận trạng thái thiết bị đang chờ ACK');
        }
    } else if (!['waiting', 'connected', 'ready'].includes(session.status)) {
        throw httpError(409, 'Trạng thái phiên không cho phép hủy');
    }
    const updated = await client.query(
        `UPDATE e2ee_sdk_provisioning_sessions
         SET status = 'rolled_back', new_device_ephemeral_public_key = NULL,
             new_device_metadata = NULL, encrypted_message = NULL,
             encrypted_device_name = NULL
         WHERE session_id = $1 AND owner_user_id = $2
           AND status IN ('waiting', 'connected', 'ready', 'linked_pending_ack')
         RETURNING session_id`,
        [sessionId, userId]
    );
    if (!updated.rows[0]) throw httpError(409, 'Phiên liên kết đã thay đổi trạng thái');
    return { aborted: true };
});

const deleteProvisioningSession = async (userId, sessionId) => withTransaction(async client => {
    await expireProvisioningSessions(client, userId);
    await client.query(
        `DELETE FROM e2ee_sdk_provisioning_sessions WHERE session_id = $1 AND owner_user_id = $2
         AND status IN ('waiting', 'connected', 'ready', 'rolled_back', 'expired')`,
        [sessionId, userId]
    );
});

const authenticateDeviceCredential = async (userId, deviceId, token) => {
    if (typeof token !== 'string' || token.length < 32 || token.length > 256) return null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(
        `SELECT id, user_id, device_id, registration_id FROM e2ee_sdk_devices
         WHERE user_id = $1 AND device_id = $2 AND device_token_hash = $3
           AND revoked_at IS NULL AND enabled = TRUE AND registered = TRUE
         LIMIT 1`,
        [userId, deviceId, tokenHash]
    );
    return rows[0] || null;
};

const getDeviceBySlot = async (userId, deviceId) => {
    const { rows } = await pool.query(
        'SELECT id, device_id, registration_id FROM e2ee_sdk_devices WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL AND enabled = TRUE AND registered = TRUE',
        [userId, deviceId]
    );
    return rows[0] || null;
};

module.exports = {
    registerDevice, getDevices, removeDevice, getIdentityKey, getActiveDevices, clearStaleKemPreKeys, provisionIdentity, rotateIdentityKey,
    uploadPreKeys, getPreKeyCount, getPreKeyInventory, fetchPreKeyBundle,
    sendEnvelope, pullEnvelopes, markDelivered, getConversationE2EEStatus, pauseConversationE2EE, enableConversationE2EE, authenticateDeviceCredential,
    createProvisioningSession, connectNewDevice, sendProvisioningMessage, getProvisioningMessage,
    completeProvisioning, acknowledgeProvisioning, rollbackProvisioning, abortProvisioningSession, deleteProvisioningSession, getDeviceBySlot
};
