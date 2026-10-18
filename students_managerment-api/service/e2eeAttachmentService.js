const crypto = require('crypto');
const pool = require('../src/config/database');
const conversationRepository = require('../repository/conversationRepository');
const relayService = require('./e2eeRelayService');

const MAX_CIPHERTEXT_BYTES = 500 * 1024 * 1024;
const UPLOAD_TTL_SECONDS = 10 * 60;
const DOWNLOAD_TTL_SECONDS = 5 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fail = (statusCode, message, code) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (code) error.code = code;
    return error;
};

const getConfig = () => {
    const workerUrl = process.env.E2EE_R2_WORKER_URL;
    const secret = process.env.E2EE_ATTACHMENT_TICKET_SECRET;
    if (!workerUrl || !secret || Buffer.byteLength(secret, 'utf8') < 32) {
        throw fail(503, 'E2EE attachment storage chưa được cấu hình đầy đủ', 'E2EE_ATTACHMENT_STORAGE_UNAVAILABLE');
    }
    let parsed;
    try { parsed = new URL(workerUrl); } catch {
        throw fail(503, 'E2EE_R2_WORKER_URL không hợp lệ', 'E2EE_ATTACHMENT_STORAGE_UNAVAILABLE');
    }
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
        throw fail(503, 'E2EE R2 Worker phải dùng HTTPS', 'E2EE_ATTACHMENT_STORAGE_UNAVAILABLE');
    }
    return { workerUrl: parsed.origin, secret };
};

const signTicket = (payload, secret) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
};

const makeTicket = (config, payload) => signTicket({
    v: 1,
    ...payload,
    exp: Math.floor(Date.now() / 1000) + payload.ttl
}, config.secret);

const workerUrl = (config, attachmentId) =>
    `${config.workerUrl}/v1/objects/${encodeURIComponent(attachmentId)}`;

const assertConversationAccess = async (userId, conversationId) => {
    const id = Number(conversationId);
    if (!Number.isSafeInteger(id) || id < 1) throw fail(400, 'conversationId không hợp lệ');
    if (!await conversationRepository.isConversationMember(id, userId)) {
        throw fail(403, 'Bạn không thuộc conversation này');
    }
    const status = await relayService.getConversationE2EEStatus(userId, id);
    if (!status.available || !status.enabled) {
        throw fail(409, 'Chỉ conversation đã kích hoạt E2EE mới được dùng tệp đính kèm E2EE', 'E2EE_NOT_ENABLED');
    }
    return id;
};

const createUploadTicket = async (userId, conversationId, body = {}) => {
    const id = await assertConversationAccess(userId, conversationId);
    const size = body.ciphertextSize ?? body.contentLength;
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_CIPHERTEXT_BYTES) {
        throw fail(400, 'ciphertextSize phải từ 1 byte đến 500 MB');
    }

    // SDK retries must resolve to the same reservation; never mint a second object
    // for the same logical preparation. Older callers may omit these fields.
    const requestId = body.requestId;
    const preparedAt = body.preparedAt;
    let digest = null;
    let readCapabilityDigest = null;
    if (requestId != null || preparedAt != null || body.digest != null || body.readCapabilityDigest != null) {
        if (typeof requestId !== 'string' || !UUID_RE.test(requestId) ||
            !Number.isSafeInteger(preparedAt) || preparedAt <= 0 ||
            typeof body.digest !== 'string' || typeof body.readCapabilityDigest !== 'string') {
            throw fail(400, 'requestId, preparedAt, digest và readCapabilityDigest phải được gửi cùng nhau');
        }
        try {
            digest = Buffer.from(body.digest, 'base64');
        } catch {
            throw fail(400, 'digest không hợp lệ');
        }
        try { readCapabilityDigest = Buffer.from(body.readCapabilityDigest, 'base64'); } catch {
            throw fail(400, 'readCapabilityDigest không hợp lệ');
        }
        if (digest.length !== 32 || digest.toString('base64') !== body.digest ||
            readCapabilityDigest.length !== 32 || readCapabilityDigest.toString('base64') !== body.readCapabilityDigest) {
            throw fail(400, 'digest và readCapabilityDigest phải là SHA-256 Base64 chuẩn');
        }
    }

    const config = getConfig();
    let attachmentId;
    let objectKey;
    let expiresAt;
    if (requestId) {
        const existing = await pool.query(
            `SELECT id, object_key, ciphertext_size, ciphertext_sha256, read_capability_digest, status, expires_at
               FROM e2ee_attachment_objects
              WHERE uploaded_by = $1 AND conversation_id = $2 AND request_id = $3 AND prepared_at = $4
              LIMIT 1`,
            [userId, id, requestId, preparedAt]
        );
        const row = existing.rows[0];
        if (row) {
            if (Number(row.ciphertext_size) !== size ||
                !row.ciphertext_sha256 ||
                !Buffer.from(row.ciphertext_sha256).equals(digest) ||
                !row.read_capability_digest || !Buffer.from(row.read_capability_digest).equals(readCapabilityDigest)) {
                throw fail(409, 'Upload request identity was reused with different bytes', 'E2EE_ATTACHMENT_IDENTITY_CONFLICT');
            }
            if (row.status !== 'pending' || new Date(row.expires_at).getTime() <= Date.now()) {
                throw fail(409, 'Upload reservation is no longer pending; reconcile the original upload before retrying', 'E2EE_ATTACHMENT_RESERVATION_CLOSED');
            }
            attachmentId = row.id;
            objectKey = row.object_key;
            expiresAt = new Date(row.expires_at);
        }
    }

    if (!attachmentId) {
        attachmentId = crypto.randomUUID();
        objectKey = crypto.randomUUID();
        expiresAt = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);
        try {
            await pool.query(
                `INSERT INTO e2ee_attachment_objects
                    (id, conversation_id, uploaded_by, object_key, ciphertext_size, status, expires_at,
                     request_id, prepared_at, ciphertext_sha256, read_capability_digest)
                 VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10)`,
                [attachmentId, id, userId, objectKey, size, expiresAt, requestId || null, preparedAt || null, digest, readCapabilityDigest]
            );
        } catch (error) {
            // A concurrent retry may have won the unique reservation. Ask caller
            // to retry the same preparation; do not create an untracked object.
            if (error?.code === '23505' && requestId) {
                throw fail(409, 'Upload reservation was created concurrently; retry the same request', 'E2EE_ATTACHMENT_RESERVATION_RACE');
            }
            throw error;
        }
    }

    const ttl = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    const ticket = makeTicket(config, {
        method: 'PUT', attachmentId, objectKey, conversationId: id,
        userId: Number(userId), expectedSize: size, ttl
    });
    return {
        attachmentId,
        objectId: attachmentId,
        uploadUrl: workerUrl(config, attachmentId),
        uploadToken: ticket,
        headers: { Authorization: `Bearer ${ticket}`, 'Content-Type': 'application/octet-stream' },
        expiresAt: expiresAt.toISOString(),
        maxCiphertextBytes: MAX_CIPHERTEXT_BYTES
    };
};

const completeUpload = async (userId, attachmentId) => {
    if (typeof attachmentId !== 'string' || !UUID_RE.test(attachmentId)) throw fail(400, 'attachmentId không hợp lệ');
    const config = getConfig();
    const { rows } = await pool.query(
        `SELECT id, conversation_id, uploaded_by, object_key, ciphertext_size, status, expires_at
           FROM e2ee_attachment_objects WHERE id = $1 LIMIT 1`,
        [attachmentId]
    );
    const row = rows[0];
    if (!row) throw fail(404, 'Không tìm thấy tệp E2EE');
    if (Number(row.uploaded_by) !== Number(userId)) throw fail(403, 'Chỉ người tải lên mới được hoàn tất tệp này');
    if (row.status === 'uploaded') return { attachmentId, status: 'uploaded', ciphertextSize: Number(row.ciphertext_size) };
    if (row.status !== 'pending' || new Date(row.expires_at).getTime() <= Date.now()) {
        throw fail(410, 'Phiên tải tệp đã hết hạn', 'E2EE_ATTACHMENT_TICKET_EXPIRED');
    }
    await assertConversationAccess(userId, row.conversation_id);
    const ticket = makeTicket(config, {
        method: 'HEAD', attachmentId, objectKey: row.object_key,
        conversationId: Number(row.conversation_id), userId: Number(userId),
        expectedSize: Number(row.ciphertext_size), ttl: 60
    });
    let response;
    try {
        response = await fetch(workerUrl(config, attachmentId), {
            method: 'HEAD', headers: { Authorization: `Bearer ${ticket}` }, signal: AbortSignal.timeout(8000)
        });
    } catch {
        throw fail(502, 'Không thể xác minh tệp trên R2; hãy thử lại', 'E2EE_ATTACHMENT_VERIFY_FAILED');
    }
    if (!response.ok) throw fail(409, 'Tệp ciphertext chưa được tải lên đầy đủ', 'E2EE_ATTACHMENT_NOT_UPLOADED');
    const actualSize = Number(response.headers.get('content-length'));
    if (!Number.isSafeInteger(actualSize) || actualSize !== Number(row.ciphertext_size)) {
        throw fail(409, 'Kích thước ciphertext trên object storage không khớp', 'E2EE_ATTACHMENT_SIZE_MISMATCH');
    }
    const finalized = await pool.query(
        `UPDATE e2ee_attachment_objects SET status = 'uploaded', uploaded_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND uploaded_by = $2 AND status = 'pending'`,
        [attachmentId, userId]
    );
    if (!finalized.rowCount) {
        const latest = await pool.query(
            'SELECT status FROM e2ee_attachment_objects WHERE id = $1 LIMIT 1',
            [attachmentId]
        );
        if (latest.rows[0]?.status !== 'uploaded') {
            throw fail(409, 'Tệp đã thay đổi trạng thái; không thể hoàn tất', 'E2EE_ATTACHMENT_STATE_CONFLICT');
        }
    }
    return { attachmentId, status: 'uploaded', ciphertextSize: actualSize };
};

const createDownloadTicket = async (userId, attachmentId, readCapability) => {
    if (typeof attachmentId !== 'string' || !UUID_RE.test(attachmentId)) throw fail(400, 'attachmentId không hợp lệ');
    const config = getConfig();
    const { rows } = await pool.query(
        `SELECT id, conversation_id, object_key, ciphertext_size, read_capability_digest, status
           FROM e2ee_attachment_objects WHERE id = $1 LIMIT 1`,
        [attachmentId]
    );
    const row = rows[0];
    if (!row || row.status !== 'uploaded') throw fail(404, 'Không tìm thấy tệp E2EE đã tải lên');
    if (!row.read_capability_digest || typeof readCapability !== 'string' || readCapability.length < 16 || readCapability.length > 512) {
        throw fail(403, 'Thiếu quyền đọc tệp E2EE', 'E2EE_ATTACHMENT_READ_AUTHORITY_REQUIRED');
    }
    const capabilityDigest = crypto.createHash('sha256').update(readCapability, 'utf8').digest();
    if (!crypto.timingSafeEqual(Buffer.from(row.read_capability_digest), capabilityDigest)) {
        throw fail(403, 'Quyền đọc tệp E2EE không hợp lệ', 'E2EE_ATTACHMENT_READ_AUTHORITY_INVALID');
    }
    await assertConversationAccess(userId, row.conversation_id);
    const ticket = makeTicket(config, {
        method: 'GET', attachmentId, objectKey: row.object_key,
        conversationId: Number(row.conversation_id), userId: Number(userId),
        expectedSize: Number(row.ciphertext_size), ttl: DOWNLOAD_TTL_SECONDS
    });
    return {
        attachmentId,
        downloadUrl: workerUrl(config, attachmentId),
        downloadToken: ticket,
        expiresInSeconds: DOWNLOAD_TTL_SECONDS,
        ciphertextSize: Number(row.ciphertext_size)
    };
};

module.exports = {
    MAX_CIPHERTEXT_BYTES, createUploadTicket, completeUpload, createDownloadTicket,
    // Exported for deterministic unit tests; never expose this signing key to clients.
    signTicket
};
