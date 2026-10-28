const test = require('node:test');
const assert = require('node:assert/strict');

const e2eeRepository = require('../repository/e2eeRepository');
const e2eeService = require('../service/e2eeService');

test('device revocation rejects malformed UUIDs before reaching the repository', async () => {
    const original = e2eeRepository.revokeDevice;
    let repositoryCalls = 0;
    e2eeRepository.revokeDevice = async () => {
        repositoryCalls += 1;
        return { id: 'device-1' };
    };

    try {
        await assert.rejects(
            e2eeService.revokeDevice(7, 'aaaaaaaa-aaaaaaaa-aaaa-aaaa-aaaaaaaaaaaa'),
            error => error.statusCode === 400
        );
        assert.equal(repositoryCalls, 0);
    } finally {
        e2eeRepository.revokeDevice = original;
    }
});

test('device revocation accepts UUID-shaped identifiers and scopes repository lookup to the owner', async () => {
    const original = e2eeRepository.revokeDevice;
    let received;
    const device = { id: 'device-1', device_id: '550e8400-e29b-41d4-a716-446655440000' };
    e2eeRepository.revokeDevice = async (userId, deviceId) => {
        received = { userId, deviceId };
        return device;
    };

    try {
        const result = await e2eeService.revokeDevice(7, device.device_id);
        assert.deepEqual(received, { userId: 7, deviceId: device.device_id });
        assert.equal(result, device);
    } finally {
        e2eeRepository.revokeDevice = original;
    }
});

test('device revocation returns not-found when the device is not active or not owned by the user', async () => {
    const original = e2eeRepository.revokeDevice;
    e2eeRepository.revokeDevice = async () => null;

    try {
        await assert.rejects(
            e2eeService.revokeDevice(7, '550e8400-e29b-41d4-a716-446655440000'),
            error => error.statusCode === 404
        );
    } finally {
        e2eeRepository.revokeDevice = original;
    }
});


test('conversation device bundles reject non-members before querying device bundles', async () => {
    const originalMembership = require('../repository/conversationRepository').isConversationMember;
    const originalBundles = e2eeRepository.getConversationDeviceBundles;
    let bundleCalls = 0;
    require('../repository/conversationRepository').isConversationMember = async () => false;
    e2eeRepository.getConversationDeviceBundles = async () => {
        bundleCalls += 1;
        return [];
    };

    try {
        await assert.rejects(
            e2eeService.getConversationDeviceBundles(7, 12),
            error => error.statusCode === 403
        );
        assert.equal(bundleCalls, 0);
    } finally {
        require('../repository/conversationRepository').isConversationMember = originalMembership;
        e2eeRepository.getConversationDeviceBundles = originalBundles;
    }
});

test('one-time prekey claims validate identifiers before repository access', async () => {
    const originalMembership = require('../repository/conversationRepository').isConversationMember;
    const originalClaim = e2eeRepository.claimConversationDevicePrekey;
    let claimCalls = 0;
    e2eeRepository.claimConversationDevicePrekey = async () => {
        claimCalls += 1;
        return null;
    };

    try {
        await assert.rejects(
            e2eeService.claimConversationDevicePrekey(7, 0, 8, '550e8400-e29b-41d4-a716-446655440000'),
            error => error.statusCode === 400
        );
        await assert.rejects(
            e2eeService.claimConversationDevicePrekey(7, 12, 0, '550e8400-e29b-41d4-a716-446655440000'),
            error => error.statusCode === 400
        );
        await assert.rejects(
            e2eeService.claimConversationDevicePrekey(7, 12, 8, 'not-a-uuid'),
            error => error.statusCode === 400
        );
        assert.equal(claimCalls, 0);
    } finally {
        require('../repository/conversationRepository').isConversationMember = originalMembership;
        e2eeRepository.claimConversationDevicePrekey = originalClaim;
    }
});

test('one-time prekey claim checks requester membership before consuming a prekey', async () => {
    const conversationRepository = require('../repository/conversationRepository');
    const originalMembership = conversationRepository.isConversationMember;
    const originalClaim = e2eeRepository.claimConversationDevicePrekey;
    let claimCalls = 0;
    conversationRepository.isConversationMember = async (conversationId, userId) => {
        assert.equal(conversationId, 12);
        assert.equal(userId, 7);
        return false;
    };
    e2eeRepository.claimConversationDevicePrekey = async () => {
        claimCalls += 1;
        return { id: 1, publicKey: 'key' };
    };

    try {
        await assert.rejects(
            e2eeService.claimConversationDevicePrekey(7, 12, 8, '550e8400-e29b-41d4-a716-446655440000'),
            error => error.statusCode === 403
        );
        assert.equal(claimCalls, 0);
    } finally {
        conversationRepository.isConversationMember = originalMembership;
        e2eeRepository.claimConversationDevicePrekey = originalClaim;
    }
});

test('one-time prekey claim forwards the exact conversation and target device after membership check', async () => {
    const conversationRepository = require('../repository/conversationRepository');
    const originalMembership = conversationRepository.isConversationMember;
    const originalClaim = e2eeRepository.claimConversationDevicePrekey;
    const expected = { id: 3, publicKey: 'public-prekey' };
    let received;
    conversationRepository.isConversationMember = async () => true;
    e2eeRepository.claimConversationDevicePrekey = async (...args) => {
        received = args;
        return expected;
    };

    try {
        const result = await e2eeService.claimConversationDevicePrekey(
            7, 12, 8, '550e8400-e29b-41d4-a716-446655440000'
        );
        assert.deepEqual(received, [12, 7, 8, '550e8400-e29b-41d4-a716-446655440000']);
        assert.equal(result, expected);
    } finally {
        conversationRepository.isConversationMember = originalMembership;
        e2eeRepository.claimConversationDevicePrekey = originalClaim;
    }
});
