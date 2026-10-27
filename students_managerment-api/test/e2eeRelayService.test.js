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

test('prekey upload accepts the SDK tagged ML-KEM-1024 public-key encoding', async () => {
    const oldUpload = relayRepository.uploadPreKeys;
    let received;
    relayRepository.uploadPreKeys = async (...args) => { received = args; };
    try {
        const publicKeyBytes = Buffer.alloc(1569);
        publicKeyBytes[0] = 0x0A;
        const publicKey = publicKeyBytes.toString('base64');
        const result = await service.uploadPreKeys(11, 1, {
            identityType: 'aci',
            keys: [{ type: 'kemOneTimePreKey', keyId: 7, publicKey, signature: Buffer.alloc(64).toString('base64') }]
        });
        assert.deepEqual(result, { uploaded: 1 });
        assert.equal(received[0], 11);
        assert.equal(received[1], 1);
        assert.equal(received[2][0].publicKey, publicKey);
    } finally {
        relayRepository.uploadPreKeys = oldUpload;
    }
});

test('prekey upload rejects untagged ML-KEM public keys and invalid algorithm tags', async () => {
    const oldUpload = relayRepository.uploadPreKeys;
    let writes = 0;
    relayRepository.uploadPreKeys = async () => { writes += 1; };
    try {
        const signature = Buffer.alloc(64).toString('base64');
        const untagged = Buffer.alloc(1568).toString('base64');
        await assert.rejects(
            service.uploadPreKeys(11, 1, {
                keys: [{ type: 'kemOneTimePreKey', keyId: 8, publicKey: untagged, signature }]
            }),
            error => error.statusCode === 400
        );

        const wrongTagBytes = Buffer.alloc(1569);
        wrongTagBytes[0] = 0x08;
        await assert.rejects(
            service.uploadPreKeys(11, 1, {
                keys: [{ type: 'kemOneTimePreKey', keyId: 9, publicKey: wrongTagBytes.toString('base64'), signature }]
            }),
            error => error.statusCode === 400 && /algorithm tag 0x0A/.test(error.message)
        );
        assert.equal(writes, 0);
    } finally {
        relayRepository.uploadPreKeys = oldUpload;
    }
});



test('prekey bundle lookup requires an existing direct conversation before claiming keys', async () => {
    const oldFind = conversationRepository.findDirectConversation;
    const oldFetch = relayRepository.fetchPreKeyBundle;
    let fetchCalls = 0;
    conversationRepository.findDirectConversation = async (requesterId, targetUserId) => {
        assert.equal(requesterId, 11);
        assert.equal(targetUserId, 22);
        return null;
    };
    relayRepository.fetchPreKeyBundle = async () => { fetchCalls += 1; return { deviceId: 2 }; };
    try {
        await assert.rejects(
            service.fetchPreKeyBundle(11, 22, 2),
            error => error.statusCode === 404
        );
        assert.equal(fetchCalls, 0);
    } finally {
        conversationRepository.findDirectConversation = oldFind;
        relayRepository.fetchPreKeyBundle = oldFetch;
    }
});

test('prekey bundle lookup allows a direct-chat peer and own linked devices', async () => {
    const oldFind = conversationRepository.findDirectConversation;
    const oldFetch = relayRepository.fetchPreKeyBundle;
    const calls = [];
    conversationRepository.findDirectConversation = async (requesterId, targetUserId) => {
        calls.push(['conversation', requesterId, targetUserId]);
        return { id: 99 };
    };
    relayRepository.fetchPreKeyBundle = async (...args) => {
        calls.push(['bundle', ...args]);
        return { deviceId: args[1] };
    };
    try {
        assert.deepEqual(await service.fetchPreKeyBundle(11, 22, 2), { deviceId: 2 });
        assert.deepEqual(await service.fetchPreKeyBundle(11, 11, 3), { deviceId: 3 });
        assert.deepEqual(calls, [
            ['conversation', 11, 22],
            ['bundle', 22, 2, 'aci'],
            ['bundle', 11, 3, 'aci']
        ]);
    } finally {
        conversationRepository.findDirectConversation = oldFind;
        relayRepository.fetchPreKeyBundle = oldFetch;
    }
});


test('E2EE device inventory is visible to self and established direct-chat peers only', async t => {
    const oldFind = conversationRepository.findDirectConversation;
    const oldDevices = relayRepository.getDevices;
    const oldActive = relayRepository.getActiveDevices;
    const calls = [];
    conversationRepository.findDirectConversation = async (requesterId, targetUserId) => {
        calls.push(['conversation', requesterId, targetUserId]);
        return requesterId === 11 && targetUserId === 22 ? { id: 99 } : null;
    };
    relayRepository.getDevices = async userId => { calls.push(['devices', userId]); return [{ deviceId: 2 }]; };
    relayRepository.getActiveDevices = async userId => { calls.push(['active', userId]); return [{ deviceId: 2 }]; };
    t.after(() => {
        conversationRepository.findDirectConversation = oldFind;
        relayRepository.getDevices = oldDevices;
        relayRepository.getActiveDevices = oldActive;
    });

    assert.deepEqual(await service.getDevices(11, 11), [{ deviceId: 2 }]);
    assert.deepEqual(await service.getActiveDevices(11, 11), [{ deviceId: 2 }]);
    assert.deepEqual(await service.getDevices(11, 22), [{ deviceId: 2 }]);
    assert.deepEqual(await service.getActiveDevices(11, 22), [{ deviceId: 2 }]);
    await assert.rejects(service.getDevices(11, 33), error => error.statusCode === 404);
    await assert.rejects(service.getActiveDevices(11, 33), error => error.statusCode === 404);

    assert.deepEqual(calls, [
        ['devices', 11],
        ['active', 11],
        ['conversation', 11, 22],
        ['devices', 22],
        ['conversation', 11, 22],
        ['active', 22],
        ['conversation', 11, 33],
        ['conversation', 11, 33]
    ]);
});

test('provisioning rollback requires a device credential and forwards it to the repository', async t => {
    const oldRollback = relayRepository.rollbackProvisioning;
    let received;
    relayRepository.rollbackProvisioning = async (...args) => { received = args; return { rolledBack: true }; };
    t.after(() => { relayRepository.rollbackProvisioning = oldRollback; });

    const token = 'device-token-for-new-device-which-is-long-enough';
    assert.deepEqual(
        await service.rollbackProvisioning(11, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', token),
        { rolledBack: true }
    );
    assert.deepEqual(received, [11, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', token]);
    await assert.rejects(
        service.rollbackProvisioning(11, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', null),
        error => error.statusCode === 401
    );
});

test('provisioning acknowledgement reports expiry only after repository cleanup commits', async t => {
    const oldAck = relayRepository.acknowledgeProvisioning;
    let received;
    relayRepository.acknowledgeProvisioning = async (...args) => {
        received = args;
        return { expiredOrUnavailable: true };
    };
    t.after(() => { relayRepository.acknowledgeProvisioning = oldAck; });

    await assert.rejects(
        service.acknowledgeProvisioning(11, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', 'device-token-for-new-device-which-is-long-enough'),
        error => error.statusCode === 409
    );
    assert.deepEqual(received, [
        11,
        'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d',
        'device-token-for-new-device-which-is-long-enough',
        null
    ]);
});


test('proof v1 provisioning session is explicitly opt-in and rejects unsupported versions', async t => {
    const oldCreate = relayRepository.createProvisioningSession;
    let received;
    relayRepository.createProvisioningSession = async (...args) => { received = args; return { sessionId: 'created' }; };
    t.after(() => { relayRepository.createProvisioningSession = oldCreate; });

    await service.createProvisioningSession(11, {
        ephemeralPublicKey: Buffer.alloc(32, 1).toString('base64'),
        proofProtocolVersion: 1
    });
    assert.deepEqual(received, [11, Buffer.alloc(32, 1).toString('base64'), 1]);
    await assert.rejects(
        service.createProvisioningSession(11, {
            ephemeralPublicKey: Buffer.alloc(32, 1).toString('base64'),
            proofProtocolVersion: 2
        }),
        error => error.statusCode === 400
    );
});

test('proof v1 commitment must be canonical 32-byte Base64 before repository write', async t => {
    const oldSend = relayRepository.sendProvisioningMessage;
    let calls = 0;
    relayRepository.sendProvisioningMessage = async () => { calls += 1; };
    t.after(() => { relayRepository.sendProvisioningMessage = oldSend; });

    await assert.rejects(
        service.sendProvisioningMessage(11, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', {
            encryptedMessage: 'opaque-ciphertext',
            proofCommitment: 'not-base64'
        }),
        error => error.statusCode === 400 && error.code === 'E2EE_PROVISIONING_PROOF_INVALID'
    );
    await service.sendProvisioningMessage(11, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', {
        encryptedMessage: 'opaque-ciphertext',
        proofCommitment: Buffer.alloc(32, 2).toString('base64')
    });
    assert.equal(calls, 1);
});

test('proof ACK is forwarded separately from the per-device credential', async t => {
    const oldAck = relayRepository.acknowledgeProvisioning;
    let received;
    relayRepository.acknowledgeProvisioning = async (...args) => { received = args; return { acknowledged: true }; };
    t.after(() => { relayRepository.acknowledgeProvisioning = oldAck; });
    const token = 'device-token-for-new-device-which-is-long-enough';
    const proof = Buffer.alloc(32, 3).toString('base64');
    assert.deepEqual(
        await service.acknowledgeProvisioning(11, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', token, proof),
        { acknowledged: true }
    );
    assert.deepEqual(received, [11, 'c7b9e8a0-8b7e-4b8d-8b7e-4b8d8b7e4b8d', token, proof]);
});
