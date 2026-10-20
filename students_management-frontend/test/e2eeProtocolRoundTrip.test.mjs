import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignalProtocolClient } from '@open-e2ee/signal-protocol-sdk';
import { inMemoryStore } from '@open-e2ee/signal-protocol-sdk/local/store/memory';
import { generateCompositeSafetyNumber } from '@open-e2ee/signal-protocol-sdk/safety';

const memoryStore = () => inMemoryStore();

class InMemoryRelay {
    constructor() {
        this.devices = new Map();
        this.identities = new Map();
        this.prekeys = new Map();
        this.mailboxes = new Map();
        this.subscribers = new Map();
        this.states = new Set();
        this._connectionState = { state: 'connected', since: Date.now() };
    }

    key(userId, deviceId) { return `${String(userId)}:${Number(deviceId)}`; }

    get relayConnectionState() { return { ...this._connectionState }; }
    subscribeRelayConnectionState(listener) {
        this.states.add(listener);
        return () => this.states.delete(listener);
    }

    async registerDevice(userId, device = {}) {
        const deviceId = Number(device.deviceId ?? 1);
        const key = this.key(userId, deviceId);
        const record = this.devices.get(key) || {
            userId: String(userId), deviceId, registrationId: 0,
            deviceType: 'web', registered: true, enabled: true, linked: deviceId > 1
        };
        this.devices.set(key, record);
        if (!this.prekeys.has(key)) this.prekeys.set(key, []);
        if (!this.mailboxes.has(key)) this.mailboxes.set(key, []);
        return deviceId;
    }

    async getDevices(userId) {
        return [...this.devices.values()].filter(d => d.userId === String(userId) && d.enabled)
            .map(d => ({ ...d, lastSeenAt: Date.now(), createdAt: Date.now() }));
    }

    async getActiveDevices(userId) {
        return (await this.getDevices(userId)).map(d => ({ userId: String(userId), deviceId: d.deviceId }));
    }

    async removeDevice(userId, deviceId) {
        const d = this.devices.get(this.key(userId, deviceId));
        if (d) d.enabled = false;
    }

    async provisionIdentityKey(request) {
        const identityKey = String(request.userId);
        const existing = this.identities.get(identityKey);
        if (existing && JSON.stringify(existing) !== JSON.stringify(request.identity)) {
            throw new Error('Identity mismatch');
        }
        this.identities.set(identityKey, request.identity);
        const d = this.devices.get(this.key(request.userId, request.deviceId));
        if (!d) throw new Error('Device missing');
        d.registrationId = Number(request.registrationId);
    }

    async rotateIdentityKey() { throw new Error('Not used in round-trip test'); }
    async getIdentityKey(userId) { return this.identities.get(String(userId)) || null; }

    async uploadPreKeys(userId, deviceId, keys, identityType = 'aci') {
        const list = this.prekeys.get(this.key(userId, deviceId)) || [];
        for (const key of keys) {
            const id = `${key.type}:${key.keyId}`;
            const old = list.find(k => `${k.type}:${k.keyId}` === id);
            if (old && (old.publicKey !== key.publicKey || old.signature !== key.signature)) {
                throw new Error('Prekey ID collision');
            }
            if (!old) list.push({ ...key, claimed: false, identityType, createdAt: Date.now() });
        }
        this.prekeys.set(this.key(userId, deviceId), list);
    }

    async getPreKeyInventory(userId, deviceId) {
        const list = this.prekeys.get(this.key(userId, deviceId)) || [];
        const latest = type => list.filter(k => k.type === type).sort((a, b) => b.createdAt - a.createdAt)[0];
        const signed = latest('ecSignedPreKey');
        const kem = latest('kemLastResortPreKey');
        return {
            ecSignedPreKey: signed ? { keyId: signed.keyId, publicKey: signed.publicKey, createdAt: signed.createdAt, expiresAt: null } : null,
            kemLastResortPreKey: kem ? { keyId: kem.keyId, publicKey: kem.publicKey, createdAt: kem.createdAt, expiresAt: null } : null,
            ecOneTimePreKeyCount: list.filter(k => k.type === 'ecPreKey' && !k.claimed).length,
            kemOneTimePreKeyCount: list.filter(k => k.type === 'kemOneTimePreKey' && !k.claimed).length
        };
    }

    async getEcSignedPreKeyMetadata(userId, deviceId) {
        return (await this.getPreKeyInventory(userId, deviceId)).ecSignedPreKey;
    }

    async getKemLastResortPreKeyMetadata(userId, deviceId) {
        return (await this.getPreKeyInventory(userId, deviceId)).kemLastResortPreKey;
    }

    async getPreKeyCount(userId, deviceId, type) {
        const inventory = await this.getPreKeyInventory(userId, deviceId);
        return type === 'ec' ? inventory.ecOneTimePreKeyCount : inventory.kemOneTimePreKeyCount;
    }

    async clearStaleKemPreKeys(userId, deviceId) {
        const list = this.prekeys.get(this.key(userId, deviceId)) || [];
        const before = list.length;
        this.prekeys.set(this.key(userId, deviceId), list.filter(k => k.type !== 'kemOneTimePreKey'));
        return { cleared: before - this.prekeys.get(this.key(userId, deviceId)).length };
    }

    async publishPlannedPreKeys(userId, deviceId, plan, identityType = 'aci') {
        const inventory = await this.getPreKeyInventory(userId, deviceId, identityType);
        const uploads = await plan(inventory);
        if (uploads?.length) await this.uploadPreKeys(userId, deviceId, uploads, identityType);
    }

    async fetchPreKeyBundle(userId, deviceId) {
        const key = this.key(userId, deviceId);
        const device = this.devices.get(key);
        const identity = this.identities.get(String(userId));
        if (!device || !identity) return null;
        const list = this.prekeys.get(key) || [];
        const latest = type => list.filter(k => k.type === type).sort((a, b) => b.createdAt - a.createdAt)[0];
        const claim = type => {
            const item = list.find(k => k.type === type && !k.claimed);
            if (item) item.claimed = true;
            return item;
        };
        const signed = latest('ecSignedPreKey');
        const kemLast = latest('kemLastResortPreKey');
        if (!signed || !kemLast) throw new Error('Required signed prekeys missing');
        const ecOne = claim('ecPreKey');
        const kemOne = claim('kemOneTimePreKey');
        return {
            registrationId: device.registrationId,
            deviceId: Number(deviceId),
            identity,
            ecSignedPreKey: { keyId: signed.keyId, publicKey: signed.publicKey, signature: signed.signature },
            ecOneTimePreKey: ecOne ? { keyId: ecOne.keyId, publicKey: ecOne.publicKey } : null,
            kemLastResortPreKey: { keyId: kemLast.keyId, publicKey: kemLast.publicKey, signature: kemLast.signature },
            kemOneTimePreKey: kemOne ? { keyId: kemOne.keyId, publicKey: kemOne.publicKey, signature: kemOne.signature } : null
        };
    }

    async send(envelope) {
        const id = crypto.randomUUID();
        const serverTimestamp = Date.now();
        const stored = { ...envelope, id, serverTimestamp };
        const key = this.key(envelope.targetUserId, envelope.targetDeviceId);
        const mailbox = this.mailboxes.get(key) || [];
        mailbox.push(stored);
        this.mailboxes.set(key, mailbox);
        const subscriber = this.subscribers.get(key);
        if (subscriber) await subscriber(stored);
        return { messageId: id, serverTimestamp, duplicate: false };
    }

    subscribe(userId, deviceId, onEnvelope) {
        const key = this.key(userId, deviceId);
        this.subscribers.set(key, onEnvelope);
        for (const envelope of this.mailboxes.get(key) || []) {
            Promise.resolve(onEnvelope(envelope)).catch(() => {});
        }
        return () => this.subscribers.delete(key);
    }

    async markDelivered(envelopeId) {
        for (const [key, mailbox] of this.mailboxes) {
            this.mailboxes.set(key, mailbox.filter(item => item.id !== envelopeId));
        }
    }

    async createProvisioningSession() { throw new Error('Not used in round-trip test'); }
    async connectNewDevice() { throw new Error('Not used in round-trip test'); }
    async sendProvisioningMessage() { throw new Error('Not used in round-trip test'); }
    async getProvisioningMessage() { throw new Error('Not used in round-trip test'); }
    async completeProvisioning() { throw new Error('Not used in round-trip test'); }
    async acknowledgeProvisioning() { throw new Error('Not used in round-trip test'); }
    async rollbackProvisioning() { throw new Error('Not used in round-trip test'); }
    async deleteProvisioningSession() { throw new Error('Not used in round-trip test'); }
}

test('Signal Protocol encrypts for two accounts and fans out to multiple recipient devices', async () => {
    const relay = new InMemoryRelay();
    const receivedPrimary = [];
    const receivedLinked = [];
    await relay.registerDevice('alice', { deviceId: 1 });
    const aliceStorage = memoryStore();
    const alice = await createSignalProtocolClient({
        identity: { userId: 'alice', deviceId: 1 },
        adapters: { storage: aliceStorage, relay }
    });

    await relay.registerDevice('bob', { deviceId: 1 });
    const bobPrimaryStorage = memoryStore();
    const bobPrimary = await createSignalProtocolClient({
        identity: { userId: 'bob', deviceId: 1 },
        adapters: { storage: bobPrimaryStorage, relay },
        hooks: {
            onMessageDecrypted: async message => { receivedPrimary.push(message); }
        }
    });

    // Simulate the SDK identity material transferred by the encrypted device
    // provisioning flow. Device 2 still generates its own signed and one-time keys.
    await relay.registerDevice('bob', { deviceId: 2 });
    const bobLinkedStorage = memoryStore();
    await bobLinkedStorage.storeIdentityKey(await bobPrimaryStorage.getIdentityKey());
    await bobLinkedStorage.setLocalRegistrationId(await bobPrimaryStorage.getLocalRegistrationId());
    const bobLinked = await createSignalProtocolClient({
        identity: { userId: 'bob', deviceId: 2 },
        adapters: { storage: bobLinkedStorage, relay },
        hooks: {
            onMessageDecrypted: async message => { receivedLinked.push(message); }
        }
    });

    try {
        const result = await alice.send('bob', { body: JSON.stringify({
            type: 'message',
            body: 'e2ee multi-device round-trip',
            timestamp: Date.now(),
            appMessageId: 'test-message-multi-device'
        }) });
        assert.ok(result.messageId);
        assert.equal(receivedPrimary.length, 1);
        assert.equal(receivedLinked.length, 1);
        // SDK v11 exposes the decrypted protocol content as a string. Custom
        // application fields are deliberately carried as JSON inside body.
        const getApplicationContent = received => {
            let content = typeof received.content === 'string'
                ? JSON.parse(received.content)
                : received.content;
            if (content?.dataMessage) content = content.dataMessage.body;
            if (typeof content === 'string') content = JSON.parse(content);
            return content;
        };
        const primaryContent = getApplicationContent(receivedPrimary[0]);
        const linkedContent = getApplicationContent(receivedLinked[0]);
        assert.equal(primaryContent.body, 'e2ee multi-device round-trip');
        assert.equal(linkedContent.body, 'e2ee multi-device round-trip');
        assert.equal(primaryContent.appMessageId, 'test-message-multi-device');

        // Safety Number / QR regression: two independently created accounts must
        // compute the same numeric code, and scanning the other side's SDK QR
        // protobuf must compare as a match. No project-defined hash is used.
        const [aliceVerified, bobVerified] = await Promise.all([
            alice.verify('bob'),
            bobPrimary.verify('alice')
        ]);
        assert.equal(
            aliceVerified.numeric.replaceAll(' ', ''),
            bobVerified.numeric.replaceAll(' ', '')
        );
        const [aliceRelayIdentity, bobRelayIdentity] = await Promise.all([
            relay.getIdentityKey('alice'),
            relay.getIdentityKey('bob')
        ]);
        const aliceIdentity = aliceRelayIdentity?.identity_public ?? aliceRelayIdentity;
        const bobIdentity = bobRelayIdentity?.identity_public ?? bobRelayIdentity;
        const aliceSafety = generateCompositeSafetyNumber(aliceIdentity, bobIdentity, 'alice', 'bob');
        const bobSafety = generateCompositeSafetyNumber(bobIdentity, aliceIdentity, 'bob', 'alice');
        assert.equal(aliceSafety.numeric.replaceAll(' ', ''), bobSafety.numeric.replaceAll(' ', ''));
        const decodeQr = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
        assert.equal(aliceSafety.scannable.compare(decodeQr(bobSafety.qrData)), 'match');
        assert.equal(bobSafety.scannable.compare(decodeQr(aliceSafety.qrData)), 'match');
        assert.equal(linkedContent.appMessageId, 'test-message-multi-device');

        const controls = [
            { type: 'edit', targetMessageId: 'test-message-multi-device', body: 'edited text', conversationId: '42', timestamp: Date.now() },
            { type: 'reaction', targetMessageId: 'test-message-multi-device', emoji: '👍', action: 'add', conversationId: '42', timestamp: Date.now() },
            { type: 'recall', targetMessageId: 'test-message-multi-device', conversationId: '42', timestamp: Date.now() }
        ];
        for (const control of controls) {
            await alice.send('bob', { body: JSON.stringify(control) });
        }

        assert.equal(receivedPrimary.length, 4);
        assert.equal(receivedLinked.length, 4);
        for (let index = 0; index < controls.length; index += 1) {
            assert.deepEqual(getApplicationContent(receivedPrimary[index + 1]), controls[index]);
            assert.deepEqual(getApplicationContent(receivedLinked[index + 1]), controls[index]);
        }
    } finally {
        await alice.stop?.();
        await bobPrimary.stop?.();
        await bobLinked.stop?.();
    }
});
