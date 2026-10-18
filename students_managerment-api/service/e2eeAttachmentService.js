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
    const size = body.ciphertextSize;
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_CIPHERTEXT_BYTES) {
        throw fail(400, 'ciphertextSize phải từ 1 byte đến 500 MB');
    }
    const config = getConfig();
    const attachmentId = crypto.randomUUID();
    const objectKey = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);
    await pool.query(
        `INSERT INTO e2ee_attachment_objects
            (id, conversation_id, uploaded_by, object_key, ciphertext_size, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
        [attachmentId, id, userId, objectKey, size, expiresAt]
    );
    const ticket = makeTicket(config, {
        method: 'PUT', attachmentId, objectKey, conversationId: id,
        userId: Number(userId), expectedSize: size, ttl: UPLOAD_TTL_SECONDS
    });
    return {
        attachmentId,
        uploadUrl: workerUrl(config, attachmentId),
        uploadToken: ticket,
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
    await pool.query(
        `UPDATE e2ee_attachment_objects SET status = 'uploaded', uploaded_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND uploaded_by = $2 AND status = 'pending'`,
        [attachmentId, userId]
    );
    return { attachmentId, status: 'uploaded', ciphertextSize: actualSize };
};

const createDownloadTicket = async (userId, attachmentId) => {
    if (typeof attachmentId !== 'string' || !UUID_RE.test(attachmentId)) throw fail(400, 'attachmentId không hợp lệ');
    const config = getConfig();
    const { rows } = await pool.query(
        `SELECT id, conversation_id, object_key, ciphertext_size, status
           FROM e2ee_attachment_objects WHERE id = $1 LIMIT 1`,
        [attachmentId]
    );
    const row = rows[0];
    if (!row || row.status !== 'uploaded') throw fail(404, 'Không tìm thấy tệp E2EE đã tải lên');
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
