// One in-process gate shared by chat generation and RAG embeddings.
// This protects a low-memory local Ollama instance from simultaneous model loads.
const MAX_OLLAMA_CONCURRENT_REQUESTS = 1;
const MAX_CHATBOT_CONCURRENT_REQUESTS = 1;
let activeOllamaRequests = 0;
let activeChatbotRequests = 0;

function createRelease(decrement) {
    let released = false;
    return () => {
        if (released) return;
        released = true;
        decrement();
    };
}

function acquireOllamaSlot() {
    if (activeOllamaRequests >= MAX_OLLAMA_CONCURRENT_REQUESTS) return null;
    activeOllamaRequests += 1;
    return createRelease(() => {
        activeOllamaRequests = Math.max(0, activeOllamaRequests - 1);
    });
}

function acquireChatbotRequestSlot() {
    if (activeChatbotRequests >= MAX_CHATBOT_CONCURRENT_REQUESTS) return null;
    activeChatbotRequests += 1;
    return createRelease(() => {
        activeChatbotRequests = Math.max(0, activeChatbotRequests - 1);
    });
}

module.exports = { acquireOllamaSlot, acquireChatbotRequestSlot };
