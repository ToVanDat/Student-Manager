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


test('call failure reasons are restricted to known server values', () => {
    const { normalizeCallFailureReason } = require('../service/callValidation');
    for (const value of ['connection-timeout', 'ice-failed', 'peer-connection-failed', 'media-error', 'network-error']) {
        assert.equal(normalizeCallFailureReason(value), value);
    }
    for (const value of ['DROP TABLE calls', '<script>', 'x'.repeat(10000), null, {}, 123]) {
        assert.equal(normalizeCallFailureReason(value), 'connection-failed');
    }
});
