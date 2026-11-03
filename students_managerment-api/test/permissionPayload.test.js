const test = require('node:test');
const assert = require('node:assert/strict');
const { findIncompletePermissionKeys } = require('../service/permissionPayload');

test('complete permission payload has no missing keys', () => {
    const catalog = [{ permission_key: 'students.view' }, { permission_key: 'grades.view' }];
    const submitted = [
        { permission_key: 'students.view', allowed: true },
        { permission_key: 'grades.view', allowed: false }
    ];
    assert.deepEqual(findIncompletePermissionKeys(catalog, submitted), []);
});

test('permission replacement identifies every omitted catalog key', () => {
    const catalog = [
        { permission_key: 'students.view' },
        { permission_key: 'grades.view' },
        { permission_key: 'permissions.manage' }
    ];
    const submitted = [{ permission_key: 'students.view', allowed: true }];
    assert.deepEqual(
        findIncompletePermissionKeys(catalog, submitted),
        ['grades.view', 'permissions.manage']
    );
});

test('empty replacement cannot accidentally mean keep all old grants', () => {
    const catalog = [{ permission_key: 'students.view' }, { permission_key: 'grades.view' }];
    assert.deepEqual(
        findIncompletePermissionKeys(catalog, []),
        ['students.view', 'grades.view']
    );
});
