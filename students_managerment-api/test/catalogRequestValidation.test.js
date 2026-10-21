const test = require('node:test');
const assert = require('node:assert/strict');
const { validateResourceId, validateObjectBody } = require('../middleware/catalogRequestValidation.js');

function runMiddleware(middleware, req) {
    let nextCalled = false;
    let statusCode = 200;
    let responseBody;
    const res = {
        status(code) { statusCode = code; return this; },
        json(body) { responseBody = body; return this; }
    };
    middleware(req, res, () => { nextCalled = true; });
    return { nextCalled, statusCode, responseBody };
}

test('resource ID validation accepts positive safe integer IDs', () => {
    assert.equal(runMiddleware(validateResourceId, { params: { id: '12' } }).nextCalled, true);
});

test('resource ID validation rejects zero, negative, decimal, text and unsafe IDs', () => {
    for (const id of ['0', '-1', '1.2', 'abc', '9007199254740992']) {
        const result = runMiddleware(validateResourceId, { params: { id } });
        assert.equal(result.nextCalled, false, String(id));
        assert.equal(result.statusCode, 400, String(id));
    }
});

test('create body must be a JSON object', () => {
    assert.equal(runMiddleware(validateObjectBody(), { body: { name: 'A' } }).nextCalled, true);
    for (const body of [null, [], 'invalid']) {
        assert.equal(runMiddleware(validateObjectBody(), { body }).statusCode, 400);
    }
});

test('partial update rejects an empty body but accepts provided fields', () => {
    const validatePatch = validateObjectBody({ partial: true });
    assert.equal(runMiddleware(validatePatch, { body: {} }).statusCode, 400);
    assert.equal(runMiddleware(validatePatch, { body: { name: 'Updated' } }).nextCalled, true);
});
