const test = require('node:test');
const assert = require('node:assert/strict');
const requireRole = require('../middleware/roleMiddleware');

const runRoleCheck = (user, requiredRole = 'admin') => {
    let statusCode = 200;
    let responseBody = null;
    let passed = false;
    const req = { user };
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            responseBody = payload;
            return this;
        }
    };

    requireRole(requiredRole)(req, res, () => { passed = true; });
    return { statusCode, responseBody, passed };
};

test('rejects requests without an authenticated user', () => {
    const result = runRoleCheck(undefined);
    assert.equal(result.statusCode, 401);
    assert.equal(result.passed, false);
});

test('rejects authenticated users without the required role', () => {
    const result = runRoleCheck({ id: 7, role: 'user' });
    assert.equal(result.statusCode, 403);
    assert.equal(result.passed, false);
});

test('allows users with the required role', () => {
    const result = runRoleCheck({ id: 1, role: 'admin' });
    assert.equal(result.statusCode, 200);
    assert.equal(result.passed, true);
});
