const test = require('node:test');
const assert = require('node:assert/strict');

const relayRepository = require('../repository/e2eeRelayRepository');
const conversationRepository = require('../repository/conversationRepository');
const service = require('../service/e2eeRelayService');

test('E2EE identity key lookup permits the authenticated account own identity', async () => {
    const oldFind = conversationRepository.findDirectConversation;
    const oldGet = relayRepository.getIdentityKey;
    let conversationLookups = 0;
    let lookup;
    conversationRepository.findDirectConversation = async () => {
        conversationLookups += 1;
        return null;
    };
    relayRepository.getIdentityKey = async (...args) => {
        lookup = args;
        return { version: 1, x25519PublicKey: 'public-key' };
    };

    try {
        const result = await service.getIdentityKey(11, 11, 'aci');
        assert.deepEqual(result, { version: 1, x25519PublicKey: 'public-key' });
        assert.deepEqual(lookup, [11, 'aci']);
        assert.equal(conversationLookups, 0);
    } finally {
        conversationRepository.findDirectConversation = oldFind;
        relayRepository.getIdentityKey = oldGet;
    }
});

test('E2EE identity key lookup permits an established direct-chat peer', async () => {
    const oldFind = conversationRepository.findDirectConversation;
    const oldGet = relayRepository.getIdentityKey;
    let lookup;
    conversationRepository.findDirectConversation = async (requesterId, targetUserId) => {
        assert.equal(requesterId, 11);
        assert.equal(targetUserId, 22);
        return { id: 90, type: 'direct' };
    };
    relayRepository.getIdentityKey = async (...args) => {
        lookup = args;
        return { version: 1 };
    };

    try {
        assert.deepEqual(await service.getIdentityKey(11, 22, 'pni'), { version: 1 });
        assert.deepEqual(lookup, [22, 'pni']);
    } finally {
        conversationRepository.findDirectConversation = oldFind;
        relayRepository.getIdentityKey = oldGet;
    }
});

test('E2EE identity key lookup denies unrelated accounts before reading key material', async () => {
    const oldFind = conversationRepository.findDirectConversation;
    const oldGet = relayRepository.getIdentityKey;
    let repositoryReads = 0;
    conversationRepository.findDirectConversation = async () => null;
    relayRepository.getIdentityKey = async () => {
        repositoryReads += 1;
        return { version: 1 };
    };

    try {
        await assert.rejects(
            service.getIdentityKey(11, 22, 'aci'),
            error => error.statusCode === 404
        );
        assert.equal(repositoryReads, 0);
    } finally {
        conversationRepository.findDirectConversation = oldFind;
        relayRepository.getIdentityKey = oldGet;
    }
});

test('E2EE identity key lookup rejects unsupported identity types', async () => {
    await assert.rejects(
        service.getIdentityKey(11, 11, 'root'),
        error => error.statusCode === 400
    );
});
