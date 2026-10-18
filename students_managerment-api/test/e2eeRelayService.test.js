const test = require('node:test');
const assert = require('node:assert/strict');

const relayRepository = require('../repository/e2eeRelayRepository');
const conversationRepository = require('../repository/conversationRepository');
const service = require('../service/e2eeRelayService');

const validEnvelope = overrides => ({
    targetUserId: 22,
    targetDeviceId: 2,
    senderDeviceId: 1,
    ciphertext: 'Y2lwaGVydGV4dA==',
    messageType: 'ciphertext',
    deliveryClass: 'user-visible',
    contentKind: 'message',
    timestamp: Date.now(),
    clientMessageId: 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d',
    ...overrides
});

test('E2EE relay validates and forwards a valid direct encrypted envelope', async () => {
    const oldFind = conversationRepository.findDirectConversation;
    const oldSend = relayRepository.sendEnvelope;
    let received;
    conversationRepository.findDirectConversation = async (senderId, targetId) => {
        assert.equal(senderId, 11);
        assert.equal(targetId, 22);
        return { id: 99 };
    };
    relayRepository.sendEnvelope = async (senderId, conversationId, payload) => {
        received = { senderId, conversationId, payload };
        return { id: 'opaque-envelope-id' };
    };
    try {
        const result = await service.sendDirectEnvelope(11, 22, validEnvelope());
        assert.equal(result.id, 'opaque-envelope-id');
        assert.equal(received.senderId, 11);
        assert.equal(received.conversationId, 99);
        assert.equal(received.payload.targetUserId, 22);
        assert.equal(received.payload.targetDeviceId, 2);
        assert.equal(received.payload.senderDeviceId, 1);
        assert.equal(received.payload.ciphertext, 'Y2lwaGVydGV4dA==');
    } finally {
        conversationRepository.findDirectConversation = oldFind;
        relayRepository.sendEnvelope = oldSend;
    }
});

test('E2EE direct send rejects URL/body recipient mismatch before relay write', async () => {
    const oldFind = conversationRepository.findDirectConversation;
    let lookedUp = false;
    conversationRepository.findDirectConversation = async () => { lookedUp = true; return { id: 99 }; };
    try {
        await assert.rejects(
            service.sendDirectEnvelope(11, 22, validEnvelope({ targetUserId: 23 })),
            error => error.statusCode === 400
        );
        assert.equal(lookedUp, false);
    } finally {
        conversationRepository.findDirectConversation = oldFind;
    }
});

test('E2EE relay rejects malformed ciphertext, message type, and retry IDs', async t => {
    const oldSend = relayRepository.sendEnvelope;
    let writes = 0;
    relayRepository.sendEnvelope = async () => { writes += 1; };
    t.after(() => { relayRepository.sendEnvelope = oldSend; });

    for (const overrides of [
        { ciphertext: 'not base64!' },
        { messageType: 'plaintext' },
        { clientMessageId: 'not-a-uuid' },
        { deliveryClass: 'public' },
        { timestamp: 0 }
    ]) {
        await assert.rejects(
            service.sendEnvelope(11, 99, validEnvelope(overrides)),
            error => error.statusCode === 400
        );
    }
    assert.equal(writes, 0);
});

test('E2EE direct send fails closed when no direct conversation exists', async () => {
    const oldFind = conversationRepository.findDirectConversation;
    conversationRepository.findDirectConversation = async () => null;
    try {
        await assert.rejects(
            service.sendDirectEnvelope(11, 22, validEnvelope()),
            error => error.statusCode === 404
        );
    } finally {
        conversationRepository.findDirectConversation = oldFind;
    }
});

test('mailbox pull constrains device slots and delegates the requested device', async () => {
    const oldPull = relayRepository.pullEnvelopes;
    let call;
    relayRepository.pullEnvelopes = async (...args) => { call = args; return []; };
    try {
        await service.pullEnvelopes(22, '2', '25');
        assert.deepEqual(call, [22, 2, '25']);
        await assert.rejects(service.pullEnvelopes(22, 6, 25), error => error.statusCode === 400);
        await assert.rejects(service.pullEnvelopes(22, 0, 25), error => error.statusCode === 400);
    } finally {
        relayRepository.pullEnvelopes = oldPull;
    }
});

test('mailbox acknowledgement validates envelope IDs and device slots', async () => {
    const oldAck = relayRepository.markDelivered;
    let call;
    relayRepository.markDelivered = async (...args) => { call = args; return { acknowledged: true }; };
    try {
        const envelopeId = 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d';
        assert.deepEqual(await service.markDelivered(22, 2, envelopeId), { acknowledged: true });
        assert.deepEqual(call, [22, 2, envelopeId]);
        await assert.rejects(service.markDelivered(22, 2, 'bad-id'), error => error.statusCode === 400);
        await assert.rejects(service.markDelivered(22, 6, envelopeId), error => error.statusCode === 400);
    } finally {
        relayRepository.markDelivered = oldAck;
    }
});
