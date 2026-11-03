const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_MS
} = require('../service/authTokenPolicy');

test('access tokens use the approved 15-minute lifetime', () => {
    assert.equal(ACCESS_TOKEN_EXPIRES_IN, '15m');
});

test('refresh tokens use a seven-day lifetime', () => {
    assert.equal(REFRESH_TOKEN_EXPIRES_MS, 7 * 24 * 60 * 60 * 1000);
});
