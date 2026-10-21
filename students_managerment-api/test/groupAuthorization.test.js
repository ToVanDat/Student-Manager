const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isGroupManager,
    canRemoveMember,
    canChangeMemberRole
} = require('../service/groupAuthorization');

test('only owner and admin are group managers', () => {
    assert.equal(isGroupManager('owner'), true);
    assert.equal(isGroupManager('admin'), true);
    assert.equal(isGroupManager('member'), false);
    assert.equal(isGroupManager(null), false);
});

test('member removal respects owner and admin boundaries', () => {
    assert.equal(canRemoveMember('owner', 'member'), true);
    assert.equal(canRemoveMember('owner', 'admin'), true);
    assert.equal(canRemoveMember('owner', 'owner'), false);
    assert.equal(canRemoveMember('admin', 'member'), true);
    assert.equal(canRemoveMember('admin', 'admin'), false);
    assert.equal(canRemoveMember('admin', 'owner'), false);
    assert.equal(canRemoveMember('member', 'member'), false);
    assert.equal(canRemoveMember('owner', null), false);
});

test('only owner can change roles and cannot demote self through role update', () => {
    assert.equal(canChangeMemberRole('owner', 'member', 1, 2, 'admin'), true);
    assert.equal(canChangeMemberRole('admin', 'member', 1, 2, 'admin'), false);
    assert.equal(canChangeMemberRole('member', 'member', 1, 2, 'admin'), false);
    assert.equal(canChangeMemberRole('owner', 'member', 1, 2, 'superadmin'), false);
    assert.equal(canChangeMemberRole('owner', 'owner', 1, 1, 'admin'), false);
    assert.equal(canChangeMemberRole('owner', 'owner', 1, 1, 'owner'), true);
    assert.equal(canChangeMemberRole('owner', null, 1, 2, 'admin'), false);
});
