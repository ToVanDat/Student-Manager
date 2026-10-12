const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidCallId, isValidCallType } = require('../service/callValidation');

test('callId accepts bounded non-empty strings', () => {
    assert.equal(isValidCallId('call-123'), true);
    assert.equal(isValidCallId('x'.repeat(128)), true);
    assert.equal(isValidCallId(''), false);
    assert.equal(isValidCallId('   '), false);
    assert.equal(isValidCallId('x'.repeat(129)), false);
    assert.equal(isValidCallId(123), false);
    assert.equal(isValidCallId(null), false);
    assert.equal(isValidCallId({}), false);
});

test('callType only accepts voice and video', () => {
    assert.equal(isValidCallType('voice'), true);
    assert.equal(isValidCallType('video'), true);
    for (const value of ['', 'audio', 'screen', 'VOICE', null, 1, {}]) {
        assert.equal(isValidCallType(value), false);
    }
});
