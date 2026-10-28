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
