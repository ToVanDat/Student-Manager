const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHistory } = require('../service/chatbotService.js');

test('normalizeHistory keeps only the latest eight valid messages', () => {
    const history = Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 ? 'assistant' : 'user',
        content: `message-${index}`
    }));
    const result = normalizeHistory(history);
    assert.equal(result.length, 8);
    assert.equal(result[0].content, 'message-2');
    assert.equal(result[7].content, 'message-9');
});

test('normalizeHistory strips unsupported roles and bounds message content', () => {
    const result = normalizeHistory([
        { role: 'system', content: 'must not inject system role' },
        { role: 'assistant', content: 'a'.repeat(5000) },
        { role: 'user', content: '  hello  ' },
        null
    ]);
    assert.equal(result.length, 2);
    assert.equal(result[0].role, 'user');
    assert.equal(result[0].content.length, 4000);
    assert.equal(result[1].content, 'hello');
});
