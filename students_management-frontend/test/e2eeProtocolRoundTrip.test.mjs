import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignalProtocolClient } from '@open-e2ee/signal-protocol-sdk';
import { inMemoryStore } from '@open-e2ee/signal-protocol-sdk/local/store/memory';

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
    const alice = await createSignalProtocolClient({
        identity: { userId: 'alice', deviceId: 1 },
        adapters: { storage: memoryStore(), relay }
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
        const result = await alice.send('bob', {
            type: 'message',
            body: 'e2ee multi-device round-trip',
            timestamp: Date.now(),
            appMessageId: 'test-message-multi-device'
        });
        assert.ok(result.messageId);
        assert.equal(receivedPrimary.length, 1);
        assert.equal(receivedLinked.length, 1);
        // SDK v11 intentionally returns decrypted plaintext as a string.
        const primaryContent = typeof receivedPrimary[0].content === 'string'
            ? JSON.parse(receivedPrimary[0].content)
            : receivedPrimary[0].content;
        const linkedContent = typeof receivedLinked[0].content === 'string'
            ? JSON.parse(receivedLinked[0].content)
            : receivedLinked[0].content;
        assert.equal(primaryContent.body, 'e2ee multi-device round-trip');
        assert.equal(linkedContent.body, 'e2ee multi-device round-trip');
        assert.equal(primaryContent.appMessageId, 'test-message-multi-device');
        assert.equal(linkedContent.appMessageId, 'test-message-multi-device');
    } finally {
        await alice.stop?.();
        await bobPrimary.stop?.();
        await bobLinked.stop?.();
    }
});
