const test = require('node:test');
const assert = require('node:assert/strict');
const { acquireOllamaSlot, acquireChatbotRequestSlot } = require('../service/ollamaRequestGate.js');

test('Ollama gate permits one model request and releases idempotently', () => {
    const release = acquireOllamaSlot();
    assert.equal(typeof release, 'function');
    assert.equal(acquireOllamaSlot(), null);
    release();
    release();
    const nextRelease = acquireOllamaSlot();
    assert.equal(typeof nextRelease, 'function');
    nextRelease();
});

test('chatbot request gate bounds concurrent full assistant requests', () => {
    const release = acquireChatbotRequestSlot();
    assert.equal(typeof release, 'function');
    assert.equal(acquireChatbotRequestSlot(), null);
    release();
    const nextRelease = acquireChatbotRequestSlot();
    assert.equal(typeof nextRelease, 'function');
    nextRelease();
});
