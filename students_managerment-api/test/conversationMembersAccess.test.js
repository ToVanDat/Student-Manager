const test = require('node:test');
const assert = require('node:assert/strict');

const conversationRepository = require('../repository/conversationRepository');
const conversationService = require('../service/conversationService');

test('conversation member list denies non-members with an explicit 403 status', async () => {
    const original = conversationRepository.isConversationMember;
    conversationRepository.isConversationMember = async () => false;
    try {
        await assert.rejects(
            conversationService.getConversationMembers(10, 22),
            error => error.statusCode === 403 && error.message === 'Bạn không thuộc conversation này'
        );
    } finally {
        conversationRepository.isConversationMember = original;
    }
});

test('conversation member list queries member rows only after membership is confirmed', async () => {
    const originalMembership = conversationRepository.isConversationMember;
    const originalMembers = conversationRepository.getConversationMembers;
    let memberQueryCalls = 0;
    conversationRepository.isConversationMember = async (conversationId, userId) => {
        assert.equal(conversationId, 10);
        assert.equal(userId, 22);
        return true;
    };
    conversationRepository.getConversationMembers = async conversationId => {
        memberQueryCalls += 1;
        assert.equal(conversationId, 10);
        return [{ user_id: 22 }];
    };
    try {
        const result = await conversationService.getConversationMembers(10, 22);
        assert.deepEqual(result, [{ user_id: 22 }]);
        assert.equal(memberQueryCalls, 1);
    } finally {
        conversationRepository.isConversationMember = originalMembership;
        conversationRepository.getConversationMembers = originalMembers;
    }
});
