const test = require('node:test');
const assert = require('node:assert/strict');
const { publishRealtimeBestEffort } = require('../service/realtimeDelivery');

test('publishes realtime event and reports success', () => {
    let published = false;
    assert.equal(publishRealtimeBestEffort(() => { published = true; }), true);
    assert.equal(published, true);
});

test('contains synchronous delivery errors and reports failure', () => {
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
        const result = publishRealtimeBestEffort(() => {
            throw Object.assign(new Error('private transport detail'), { code: 'TRANSPORT_DOWN' });
        }, { event: 'message:new', conversationId: 42 });
        assert.equal(result, false);
        assert.equal(warnings.length, 1);
        assert.deepEqual(warnings[0][1], {
            event: 'message:new',
            conversationId: 42,
            code: 'TRANSPORT_DOWN'
        });
        assert.equal(JSON.stringify(warnings).includes('private transport detail'), false);
    } finally {
        console.warn = originalWarn;
    }
});
