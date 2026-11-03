const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const service = require('../service/e2eeAttachmentService');

test('E2EE attachment ticket signatures are HMAC-SHA256 and tamper-evident', () => {
    const secret = 'test-secret-with-at-least-thirty-two-bytes';
    const payload = { v: 1, method: 'PUT', attachmentId: 'a3b7f38d-1c5a-4d89-9c13-2a8b3f0c1d22', ttl: 600 };
    const ticket = service.signTicket(payload, secret);
    const [encoded, signature] = ticket.split('.');
    assert.equal(ticket.split('.').length, 2);
    assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')), payload);
    const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    assert.equal(signature, expected);
    assert.notEqual(service.signTicket({ ...payload, method: 'GET' }, secret), ticket);
});

test('E2EE attachment size ceiling is 500 MiB', () => {
    assert.equal(service.MAX_CIPHERTEXT_BYTES, 500 * 1024 * 1024);
});


test('E2EE attachment authorization blocks new reservations when conversation is paused', async () => {
    const conversationRepository = require('../repository/conversationRepository');
    const relayService = require('../service/e2eeRelayService');
    const oldMember = conversationRepository.isConversationMember;
    const oldStatus = relayService.getConversationE2EEStatus;
    conversationRepository.isConversationMember = async () => true;
    relayService.getConversationE2EEStatus = async () => ({
        available: true, enabled: true, mode: 'paused'
    });
    try {
        await assert.rejects(
            service.assertConversationAccess(11, 99, { requireActive: true }),
            error => error.statusCode === 409 && error.code === 'E2EE_PAUSED'
        );
        // Historical access paths intentionally do not require active mode.
        assert.equal(await service.assertConversationAccess(11, 99), 99);
    } finally {
        conversationRepository.isConversationMember = oldMember;
        relayService.getConversationE2EEStatus = oldStatus;
    }
});

test('E2EE attachment authorization remains fail-closed when E2EE is unavailable or disabled', async () => {
    const conversationRepository = require('../repository/conversationRepository');
    const relayService = require('../service/e2eeRelayService');
    const oldMember = conversationRepository.isConversationMember;
    const oldStatus = relayService.getConversationE2EEStatus;
    conversationRepository.isConversationMember = async () => true;
    try {
        relayService.getConversationE2EEStatus = async () => ({ available: false, enabled: false, mode: 'active' });
        await assert.rejects(service.assertConversationAccess(11, 99), error => error.code === 'E2EE_NOT_ENABLED');
        relayService.getConversationE2EEStatus = async () => ({ available: true, enabled: false, mode: 'active' });
        await assert.rejects(service.assertConversationAccess(11, 99), error => error.code === 'E2EE_NOT_ENABLED');
    } finally {
        conversationRepository.isConversationMember = oldMember;
        relayService.getConversationE2EEStatus = oldStatus;
    }
});

test('E2EE download ticket is denied to users who are not active conversation members', async () => {
    const pool = require('../src/config/database');
    const conversationRepository = require('../repository/conversationRepository');
    const relayService = require('../service/e2eeRelayService');
    const originalQuery = pool.query;
    const originalMembership = conversationRepository.isConversationMember;
    const originalStatus = relayService.getConversationE2EEStatus;
    const originalWorkerUrl = process.env.E2EE_R2_WORKER_URL;
    const originalSecret = process.env.E2EE_ATTACHMENT_TICKET_SECRET;

    const attachmentId = 'a3b7f38d-1c5a-4d89-9c13-2a8b3f0c1d22';
    const capability = Buffer.alloc(32, 7).toString('base64url');
    const capabilityDigest = crypto.createHash('sha256')
        .update(Buffer.from(capability, 'base64url'))
        .digest();

    process.env.E2EE_R2_WORKER_URL = 'https://attachments.example.test';
    process.env.E2EE_ATTACHMENT_TICKET_SECRET = 'test-secret-with-at-least-thirty-two-bytes';
    pool.query = async () => ({
        rows: [{
            id: attachmentId,
            conversation_id: 99,
            object_key: 'opaque-object-key',
            ciphertext_size: 128,
            ciphertext_sha256: crypto.createHash('sha256').update('ciphertext').digest(),
            read_capability_digest: capabilityDigest,
            status: 'uploaded'
        }]
    });
    conversationRepository.isConversationMember = async () => false;
    relayService.getConversationE2EEStatus = async () => ({
        available: true, enabled: true, mode: 'active'
    });

    try {
        await assert.rejects(
            service.createDownloadTicket(22, attachmentId, capability),
            error => error.statusCode === 403
        );
    } finally {
        pool.query = originalQuery;
        conversationRepository.isConversationMember = originalMembership;
        relayService.getConversationE2EEStatus = originalStatus;
        if (originalWorkerUrl === undefined) delete process.env.E2EE_R2_WORKER_URL;
        else process.env.E2EE_R2_WORKER_URL = originalWorkerUrl;
        if (originalSecret === undefined) delete process.env.E2EE_ATTACHMENT_TICKET_SECRET;
        else process.env.E2EE_ATTACHMENT_TICKET_SECRET = originalSecret;
    }
});

test('E2EE download ticket is bound to the authenticated active conversation member', async () => {
    const pool = require('../src/config/database');
    const conversationRepository = require('../repository/conversationRepository');
    const relayService = require('../service/e2eeRelayService');
    const originalQuery = pool.query;
    const originalMembership = conversationRepository.isConversationMember;
    const originalStatus = relayService.getConversationE2EEStatus;
    const originalWorkerUrl = process.env.E2EE_R2_WORKER_URL;
    const originalSecret = process.env.E2EE_ATTACHMENT_TICKET_SECRET;

    const attachmentId = 'a3b7f38d-1c5a-4d89-9c13-2a8b3f0c1d22';
    const userId = 22;
    const capability = Buffer.alloc(32, 9).toString('base64url');
    const capabilityDigest = crypto.createHash('sha256')
        .update(Buffer.from(capability, 'base64url'))
        .digest();

    process.env.E2EE_R2_WORKER_URL = 'https://attachments.example.test';
    process.env.E2EE_ATTACHMENT_TICKET_SECRET = 'test-secret-with-at-least-thirty-two-bytes';
    pool.query = async () => ({
        rows: [{
            id: attachmentId,
            conversation_id: 99,
            object_key: 'opaque-object-key',
            ciphertext_size: 128,
            ciphertext_sha256: crypto.createHash('sha256').update('ciphertext').digest(),
            read_capability_digest: capabilityDigest,
            status: 'uploaded'
        }]
    });
    conversationRepository.isConversationMember = async (conversationId, requesterId) => {
        assert.equal(conversationId, 99);
        assert.equal(requesterId, userId);
        return true;
    };
    relayService.getConversationE2EEStatus = async () => ({
        available: true, enabled: true, mode: 'paused'
    });

    try {
        const result = await service.createDownloadTicket(userId, attachmentId, capability);
        assert.equal(result.attachmentId, attachmentId);
        assert.equal(result.downloadUrl, 'https://attachments.example.test/v1/objects/' + attachmentId);
        const [encoded, signature] = result.downloadToken.split('.');
        assert.ok(signature);
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        assert.equal(payload.method, 'GET');
        assert.equal(payload.userId, userId);
        assert.equal(payload.conversationId, 99);
        assert.equal(payload.expectedSize, 128);
        assert.equal(payload.ttl, 300);
    } finally {
        pool.query = originalQuery;
        conversationRepository.isConversationMember = originalMembership;
        relayService.getConversationE2EEStatus = originalStatus;
        if (originalWorkerUrl === undefined) delete process.env.E2EE_R2_WORKER_URL;
        else process.env.E2EE_R2_WORKER_URL = originalWorkerUrl;
        if (originalSecret === undefined) delete process.env.E2EE_ATTACHMENT_TICKET_SECRET;
        else process.env.E2EE_ATTACHMENT_TICKET_SECRET = originalSecret;
    }
});

