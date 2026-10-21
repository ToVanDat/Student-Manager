const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../service/permissionService');
const repository = require('../repository/permissionRepository');

test('permission service rejects unsupported roles and malformed payloads', async () => {
    assert.deepEqual(await service.listForRole('owner'), { kind: 'invalid_role' });
    assert.deepEqual(await service.updateForRole('owner', { permissions: [] }, 1), { kind: 'invalid_role' });
    for (const payload of [null, [], 'admin']) {
        assert.deepEqual(await service.updateForRole('user', payload, 1), { kind: 'invalid_body' });
    }
    for (const payload of [{}, { permissions: 'all' }, { permissions: [{ permission_key: 'classes.view', allowed: 1 }] }, { permissions: [{ permission_key: 'classes.view', allowed: true, extra: true }] }, { permissions: [{ permission_key: 'classes.view', allowed: true }, { permission_key: 'classes.view', allowed: false }] }]) {
        assert.deepEqual(await service.updateForRole('user', payload, 1), { kind: 'invalid_fields' });
    }
});

test('permission service forwards a validated role grant set to repository', async () => {
    const original = repository.replaceRolePermissions;
    const calls = [];
    repository.replaceRolePermissions = async (...args) => {
        calls.push(args);
        return { kind: 'ok', permissions: [{ permission_key: 'classes.view', allowed: true }] };
    };
    try {
        const permissions = [{ permission_key: 'classes.view', allowed: true }];
        const result = await service.updateForRole('user', { permissions }, 7);
        assert.deepEqual(result, { kind: 'ok', permissions: [{ permission_key: 'classes.view', allowed: true }] });
        assert.deepEqual(calls, [['user', permissions, 7]]);
    } finally {
        repository.replaceRolePermissions = original;
    }
});
