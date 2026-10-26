const test = require('node:test');
const assert = require('node:assert/strict');
const { acquireOllamaSlot, acquireChatbotRequestSlot } = require('../service/ollamaRequestGate.js');

test('Ollama gate permits one model request and releases idempotently', () => {
    const release = acquireOllamaSlot();
    assert.equal(typeof release, 'function');
    assert.equal(acquireOllamaSlot(), null);
    release();
    release();
    assert.equal(typeof acquireOllamaSlot(), 'function');
});

test('chatbot request gate bounds concurrent full assistant requests', () => {
    const release = acquireChatbotRequestSlot();
    assert.equal(typeof release, 'function');
    assert.equal(acquireChatbotRequestSlot(), null);
    release();
    assert.equal(typeof acquireChatbotRequestSlot(), 'function');
});
