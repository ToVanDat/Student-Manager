const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getCooldownMs,
    normalizeAccountIdentifier
} = require('../service/passwordLoginProtection');

test('progressive cooldown follows the configured starting tiers', () => {
    assert.equal(getCooldownMs(1), 0);
    assert.equal(getCooldownMs(3), 0);
    assert.equal(getCooldownMs(4), 30_000);
    assert.equal(getCooldownMs(5), 30_000);
    assert.equal(getCooldownMs(6), 60_000);
    assert.equal(getCooldownMs(7), 60_000);
    assert.equal(getCooldownMs(8), 300_000);
    assert.equal(getCooldownMs(9), 300_000);
    assert.equal(getCooldownMs(10), 900_000);
    assert.equal(getCooldownMs(11), 900_000);
    assert.equal(getCooldownMs(12), 1_800_000);
    assert.equal(getCooldownMs(100), 1_800_000);
});

test('invalid attempt counts never produce a cooldown', () => {
    assert.equal(getCooldownMs(0), 0);
    assert.equal(getCooldownMs(-1), 0);
    assert.equal(getCooldownMs(Number.NaN), 0);
    assert.equal(getCooldownMs('not-a-number'), 0);
});

test('account identifiers are normalized consistently before hashing', () => {
    assert.equal(
        normalizeAccountIdentifier('  STUDENT.User  '),
        normalizeAccountIdentifier('student.user')
    );
    assert.equal(normalizeAccountIdentifier('  '), '');
});
