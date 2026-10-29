'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ipKeyGenerator } = require('express-rate-limit');
const { qrPollIpRateLimiter, qrPollChallengeRateLimiter } = require('../middleware/qrPollRateLimiter');

test('QR polling has independent IP and per-challenge limiter middleware', () => {
    assert.equal(typeof ipKeyGenerator, 'function');
    assert.equal(typeof qrPollIpRateLimiter, 'function');
    assert.equal(typeof qrPollChallengeRateLimiter, 'function');
});

test('IPv6 client addresses are normalized to their configured subnet for limiter keys', () => {
    assert.equal(ipKeyGenerator('2001:db8:abcd:1200::1'), ipKeyGenerator('2001:db8:abcd:12ff::1'));
});
