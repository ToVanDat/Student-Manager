const test = require('node:test');
const assert = require('node:assert/strict');

const conversationRepository = require('../repository/conversationRepository');
const userRepository = require('../repository/userRepository');
const conversationService = require('../service/conversationService');

const withMocks = async (overrides, callback) => {
    const originals = [];
    for (const [target, key, value] of overrides) {
        originals.push([target, key, target[key]]);
        target[key] = value;
    }
    try {
        await callback();
    } finally {
        for (const [target, key, original] of originals) target[key] = original;
    }
};

test('group management distinguishes missing conversation from forbidden actor', async () => {
    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => null]
    ], async () => {
        await assert.rejects(
            conversationService.updateGroupConversation(5, 9, 'Group'),
            error => error.statusCode === 404
        );
    });

    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => ({ id: 5, type: 'group' })],
        [conversationRepository, 'getMemberRole', async () => 'member']
    ], async () => {
        await assert.rejects(
            conversationService.updateGroupConversation(5, 9, 'Group'),
            error => error.statusCode === 403
        );
    });
});

test('group member addition reports forbidden, missing user and duplicate member distinctly', async () => {
    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => ({ id: 5, type: 'group' })],
        [conversationRepository, 'getMemberRole', async () => 'member']
    ], async () => {
        await assert.rejects(
            conversationService.addGroupMember(5, 9, 11),
            error => error.statusCode === 403
        );
    });

    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => ({ id: 5, type: 'group' })],
        [conversationRepository, 'getMemberRole', async () => 'owner'],
        [userRepository, 'findActiveUserById', async () => null]
    ], async () => {
        await assert.rejects(
            conversationService.addGroupMember(5, 9, 11),
            error => error.statusCode === 404
        );
    });

    let roleCalls = 0;
    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => ({ id: 5, type: 'group' })],
        [conversationRepository, 'getMemberRole', async () => (++roleCalls === 1 ? 'owner' : 'member')],
        [userRepository, 'findActiveUserById', async () => ({ id: 11 })]
    ], async () => {
        await assert.rejects(
            conversationService.addGroupMember(5, 9, 11),
            error => error.statusCode === 409
        );
    });
});

test('group member removal rejects owner removal as a conflict and unauthorized removal as forbidden', async () => {
    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => ({ id: 5, type: 'group' })],
        [conversationRepository, 'getMemberRole', async (_conversationId, userId) => userId === 9 ? 'owner' : 'owner']
    ], async () => {
        await assert.rejects(
            conversationService.removeGroupMember(5, 9, 11),
            error => error.statusCode === 409
        );
    });

    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => ({ id: 5, type: 'group' })],
        [conversationRepository, 'getMemberRole', async (_conversationId, userId) => userId === 9 ? 'member' : 'member']
    ], async () => {
        await assert.rejects(
            conversationService.removeGroupMember(5, 9, 11),
            error => error.statusCode === 403
        );
    });
});

test('group role changes validate role and distinguish missing target from forbidden actor', async () => {
    await assert.rejects(
        conversationService.updateGroupMemberRole(5, 9, 11, 'superadmin'),
        error => error.statusCode === 400
    );

    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => ({ id: 5, type: 'group' })],
        [conversationRepository, 'getMemberRole', async (_conversationId, userId) => userId === 9 ? 'owner' : null]
    ], async () => {
        await assert.rejects(
            conversationService.updateGroupMemberRole(5, 9, 11, 'admin'),
            error => error.statusCode === 404
        );
    });

    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => ({ id: 5, type: 'group' })],
        [conversationRepository, 'getMemberRole', async () => 'member']
    ], async () => {
        await assert.rejects(
            conversationService.updateGroupMemberRole(5, 9, 11, 'admin'),
            error => error.statusCode === 403
        );
    });
});


test('concurrent duplicate group member insert is translated to HTTP 409 conflict', async () => {
    await withMocks([
        [conversationRepository, 'getConversationInfo', async () => ({ id: 5, type: 'group' })],
        [conversationRepository, 'getMemberRole', async (_conversationId, userId) => userId === 9 ? 'owner' : null],
        [userRepository, 'findActiveUserById', async () => ({ id: 11 })],
        [conversationRepository, 'addMember', async () => {
            const error = new Error('duplicate key value violates unique constraint');
            error.code = '23505';
            throw error;
        }]
    ], async () => {
        await assert.rejects(
            conversationService.addGroupMember(5, 9, 11),
            error => error.statusCode === 409
        );
    });
});
