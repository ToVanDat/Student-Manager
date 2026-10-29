const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MAX_SESSION_DESCRIPTION_BYTES,
    MAX_ICE_CANDIDATE_BYTES,
    isValidSessionDescription,
    isValidIceCandidate
} = require('../service/socketPayloadValidation');

test('accepts bounded WebRTC offer and answer descriptions', () => {
    assert.equal(isValidSessionDescription({ type: 'offer', sdp: 'v=0\\r\\n' }, 'offer'), true);
    assert.equal(isValidSessionDescription({ type: 'answer', sdp: 'v=0\\r\\n' }, 'answer'), true);
});

test('rejects malformed, mismatched and oversized session descriptions', () => {
    assert.equal(isValidSessionDescription(null, 'offer'), false);
    assert.equal(isValidSessionDescription([], 'offer'), false);
    assert.equal(isValidSessionDescription({ type: 'answer', sdp: 'v=0' }, 'offer'), false);
    assert.equal(isValidSessionDescription({ type: 'offer', sdp: '' }, 'offer'), false);
    assert.equal(isValidSessionDescription({
        type: 'offer',
        sdp: 'a'.repeat(MAX_SESSION_DESCRIPTION_BYTES + 1)
    }, 'offer'), false);
});

test('accepts standard ICE candidate JSON including end-of-candidates', () => {
    assert.equal(isValidIceCandidate({
        candidate: 'candidate:1 1 UDP 123 192.0.2.1 5000 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
        usernameFragment: 'abc'
    }), true);
    assert.equal(isValidIceCandidate({ candidate: '' }), true);
});

test('rejects malformed and oversized ICE candidate fields', () => {
    assert.equal(isValidIceCandidate(null), false);
    assert.equal(isValidIceCandidate({ candidate: 123 }), false);
    assert.equal(isValidIceCandidate({
        candidate: 'a'.repeat(MAX_ICE_CANDIDATE_BYTES + 1)
    }), false);
    assert.equal(isValidIceCandidate({ candidate: 'x', sdpMid: 'm'.repeat(257) }), false);
    assert.equal(isValidIceCandidate({ candidate: 'x', sdpMLineIndex: -1 }), false);
    assert.equal(isValidIceCandidate({ candidate: 'x', sdpMLineIndex: 1.5 }), false);
    assert.equal(isValidIceCandidate({ candidate: 'x', usernameFragment: 42 }), false);
});

test('normalizes malformed Socket.IO event payloads to an empty object', () => {
    const { normalizeSocketPayload } = require('../service/socketPayloadValidation');
    assert.deepEqual(normalizeSocketPayload(null), {});
    assert.deepEqual(normalizeSocketPayload(undefined), {});
    assert.deepEqual(normalizeSocketPayload('unexpected'), {});
    assert.deepEqual(normalizeSocketPayload(42), {});
    assert.deepEqual(normalizeSocketPayload([]), {});
    const payload = { conversationId: 12 };
    assert.equal(normalizeSocketPayload(payload), payload);
});

test('preserves Socket.IO acknowledgements when a client omits its payload', () => {
    const { normalizeSocketEventArgs } = require('../service/socketPayloadValidation');
    const acknowledge = () => {};
    assert.deepEqual(normalizeSocketEventArgs(acknowledge), [{}, acknowledge]);
    const payload = { messageId: 9 };
    assert.deepEqual(normalizeSocketEventArgs(payload, acknowledge), [payload, acknowledge]);
    assert.deepEqual(normalizeSocketEventArgs(null, acknowledge), [{}, acknowledge]);
});


test('wrapped Socket.IO listeners preserve their receiver and acknowledgement arguments', () => {
    const { wrapSocketEventListener } = require('../service/socketPayloadValidation');
    const receiver = { marker: 'socket' };
    let received;
    const listener = function (payload, acknowledge) {
        received = { receiver: this, payload, acknowledge };
    };
    const acknowledge = () => {};
    wrapSocketEventListener(listener).call(receiver, null, acknowledge);
    assert.equal(received.receiver, receiver);
    assert.deepEqual(received.payload, {});
    assert.equal(received.acknowledge, acknowledge);
});


test('wrapped async Socket.IO listener failures are reported without unhandled rejections', async () => {
    const { wrapSocketEventListener } = require('../service/socketPayloadValidation');
    const receiver = { marker: 'socket' };
    const reported = [];
    const listener = async function (payload, acknowledge) {
        assert.equal(this, receiver);
        assert.deepEqual(payload, {});
        assert.equal(typeof acknowledge, 'function');
        throw Object.assign(new Error('private database detail'), { code: 'DB_UNAVAILABLE' });
    };
    const wrapped = wrapSocketEventListener(listener, (error, socket) => {
        reported.push({ code: error.code, socket });
    });

    await assert.doesNotReject(wrapped.call(receiver, null, () => {}));
    assert.deepEqual(reported, [{ code: 'DB_UNAVAILABLE', socket: receiver }]);
});

test('wrapped synchronous Socket.IO listener failures use the same error callback', () => {
    const { wrapSocketEventListener } = require('../service/socketPayloadValidation');
    const receiver = { marker: 'socket' };
    let reported;
    const wrapped = wrapSocketEventListener(() => {
        throw new Error('internal detail');
    }, (error, socket) => {
        reported = { message: error.message, socket };
    });

    assert.doesNotThrow(() => wrapped.call(receiver, {}));
    assert.deepEqual(reported, { message: 'internal detail', socket: receiver });
});

test('wrapped Socket.IO listeners preserve normal return values without an error callback', () => {
    const { wrapSocketEventListener } = require('../service/socketPayloadValidation');
    const wrapped = wrapSocketEventListener(payload => payload.value);
    assert.equal(wrapped({ value: 42 }), 42);
});
