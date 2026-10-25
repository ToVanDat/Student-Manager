const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHistory, clearHistory } = require('../service/chatbotService.js');
const { redisClient } = require('../src/config/redis.js');

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
    assert.equal(result[0].role, 'assistant');
    assert.equal(result[0].content.length, 4000);
    assert.equal(result[1].role, 'user');
    assert.equal(result[1].content, 'hello');
});

test('clearHistory deletes only the authenticated user and session history key', async () => {
    const originalReady = redisClient.isReady;
    const originalDel = redisClient.del;
    const deletedKeys = [];
    Object.defineProperty(redisClient, 'isReady', { configurable: true, value: true });
    redisClient.del = async key => { deletedKeys.push(key); return 1; };

    try {
        await clearHistory({ userId: '42', sessionId: 'session-abc' });
        assert.deepEqual(deletedKeys, ['assistant:history:42:session-abc']);
    } finally {
        Object.defineProperty(redisClient, 'isReady', { configurable: true, value: originalReady });
        redisClient.del = originalDel;
    }
});

test('clearHistory fails closed when Redis is unavailable', async () => {
    const originalReady = redisClient.isReady;
    Object.defineProperty(redisClient, 'isReady', { configurable: true, value: false });
    try {
        await assert.rejects(
            clearHistory({ userId: '42', sessionId: 'session-abc' }),
            error => error.status === 503
        );
    } finally {
        Object.defineProperty(redisClient, 'isReady', { configurable: true, value: originalReady });
    }
});
