const test = require('node:test');
const assert = require('node:assert/strict');
const requireRole = require('../middleware/roleMiddleware.js');

function invoke(role, user) {
    const req = { user };
    const res = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
    let nextCalled = false;
    requireRole(role)(req, res, () => { nextCalled = true; });
    return { res, nextCalled };
}

test('role guard rejects requests without an authenticated user', () => {
    const result = invoke('admin', undefined);
    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 401);
});

test('role guard rejects a user whose current role does not match', () => {
    const result = invoke('admin', { id: 10, role: 'student' });
    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
});

test('role guard allows the requested exact role', () => {
    const result = invoke('admin', { id: 10, role: 'admin' });
    assert.equal(result.nextCalled, true);
    assert.equal(result.res.statusCode, null);
});

test('role guard does not accept role-name prefixes or case variants', () => {
    for (const role of ['administrator', 'Admin', 'ADMIN', 'admin ']) {
        const result = invoke('admin', { id: 10, role });
        assert.equal(result.nextCalled, false, role);
        assert.equal(result.res.statusCode, 403, role);
    }
});
