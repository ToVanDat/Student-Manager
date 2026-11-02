import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidNegotiationId, isCurrentNegotiation, getPerfectNegotiationRole, shouldIgnoreOfferCollision, canRollbackLocalOffer } from '../src/utils/webrtcSignaling.js';

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


test('assigns stable complementary Perfect Negotiation roles to call peers', () => {
    assert.deepEqual(getPerfectNegotiationRole({ isCaller: true }), { polite: false });
    assert.deepEqual(getPerfectNegotiationRole({ isCaller: false }), { polite: true });
    assert.throws(() => getPerfectNegotiationRole({}), TypeError);
});

test('impolite peer ignores glare while polite peer yields its local offer', () => {
    assert.equal(shouldIgnoreOfferCollision({ polite: false, signalingState: 'have-local-offer' }), true);
    assert.equal(shouldIgnoreOfferCollision({ polite: true, signalingState: 'have-local-offer' }), false);
    assert.equal(shouldIgnoreOfferCollision({ polite: true, signalingState: 'stable' }), false);
    assert.equal(canRollbackLocalOffer('have-local-offer'), true);
    assert.equal(canRollbackLocalOffer('have-remote-offer'), false);
});
