import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidNegotiationId, isCurrentNegotiation } from '../src/utils/webrtcSignaling.js';

test('accepts canonical UUID negotiation identifiers only', () => {
    assert.equal(isValidNegotiationId('9f1c2b30-7a41-4d92-8b36-8e0a2a1b9c44'), true);
    assert.equal(isValidNegotiationId('not-a-uuid'), false);
    assert.equal(isValidNegotiationId('9f1c2b30-7a41-4d92-8b36-8e0a2a1b9c4'), false);
    assert.equal(isValidNegotiationId(null), false);
});

test('rejects answers and ICE messages from an earlier negotiation', () => {
    const active = '9f1c2b30-7a41-4d92-8b36-8e0a2a1b9c44';
    const stale = '0a1b2c3d-4e5f-4678-9abc-def012345678';
    assert.equal(isCurrentNegotiation(active, active), true);
    assert.equal(isCurrentNegotiation(stale, active), false);
    assert.equal(isCurrentNegotiation('invalid', active), false);
});
