const test = require('node:test');
const assert = require('node:assert/strict');
const userService = require('../service/userService');

test('account access validation rejects invalid IDs before database access', async () => {
    for (const id of ['0', '-1', '1.5', 'not-an-id', '9007199254740992']) {
        const result = await userService.updateUserAccess(id, { role: 'user', is_active: true }, 1);
        assert.deepEqual(result, { kind: 'invalid_id' }, String(id));
    }
});

test('account access validation rejects missing, array, and non-object payloads', async () => {
    for (const payload of [null, undefined, [], 'admin']) {
        const result = await userService.updateUserAccess(2, payload, 1);
        assert.deepEqual(result, { kind: 'invalid_body' });
    }
});

test('account access validation requires a supported role and boolean active status', async () => {
    const invalidPayloads = [
        { role: 'owner', is_active: true },
        { role: 'admin', is_active: 'false' },
        { role: 'user' },
        { is_active: false },
        { role: 'user', is_active: false, is_superuser: true },
    ];

    for (const payload of invalidPayloads) {
        const result = await userService.updateUserAccess(2, payload, 1);
        assert.deepEqual(result, { kind: 'invalid_fields' });
    }
});

test('account access validation accepts only the two supported roles with boolean status', async () => {
    // Validation of the complete shape is exercised before repository access.
    // This test uses invalid IDs intentionally to stop before touching PostgreSQL.
    for (const role of ['admin', 'user']) {
        const result = await userService.updateUserAccess(0, { role, is_active: false }, 1);
        assert.deepEqual(result, { kind: 'invalid_id' });
    }
});
