import { apiClient, getAccessToken, refreshAccessToken, setAccessToken } from '@/api/client.js';

export const sendChatbotMessage = async message => {
    const response = await apiClient.post('/api/assistant/chat', { message });
    return response.data;
};

export const listChatbotConversations = async () => (await apiClient.get('/api/assistant/conversations')).data;
export const createChatbotConversation = async title => (await apiClient.post('/api/assistant/conversations', { title })).data;
export const renameChatbotConversation = async (id, title) => (await apiClient.patch('/api/assistant/conversations/' + encodeURIComponent(id), { title })).data;
export const deleteChatbotConversation = async id => (await apiClient.delete('/api/assistant/conversations/' + encodeURIComponent(id))).data;

export const getChatbotHistory = async conversationId => {
    const response = await apiClient.get('/api/assistant/history', { params: { conversationId } });
    return response.data;
};

export const clearChatbotHistory = async conversationId => {
    const response = await apiClient.delete('/api/assistant/history', { params: { conversationId } });
    return response.data;
};

async function requestChatStream(message, conversationId, signal, replaceLastTurn = false) {
    const token = getAccessToken();
    return fetch(`${apiClient.defaults.baseURL || ''}/api/assistant/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        signal,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message, conversationId, replaceLastTurn })
    });
}

function createStreamError(message, status = null, code = null) {
    const error = new Error(message || 'Không thể kết nối trợ lý lúc này.');
    if (Number.isInteger(status)) error.status = status;
    if (code) error.code = code;
    return error;
}

export const streamChatbotMessage = async (message, { signal, onToken, onDone, conversationId = 'default', replaceLastTurn = false } = {}) => {
    let response = await requestChatStream(message, conversationId, signal, replaceLastTurn);

    // fetch() does not pass through Axios' 401 response interceptor. Refresh once
    // using the same shared refresh promise, then retry the exact stream request.
    if (response.status === 401 && !signal?.aborted) {
        try {
            await refreshAccessToken();
        } catch (refreshError) {
            if (refreshError?.response?.status === 401) {
                setAccessToken(null);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:session-invalid'));
                    window.location.href = '/login';
                }
            }
            throw createStreamError(
                refreshError?.response?.data?.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
                refreshError?.response?.status || 503
            );
        }
        if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
        response = await requestChatStream(message, conversationId, signal, replaceLastTurn);
        if (response.status === 401) {
            setAccessToken(null);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:session-invalid'));
                window.location.href = '/login';
            }
        }
    }

    if (!response.ok || !response.body?.getReader) {
        let payload = {};
        try { payload = await response.json(); } catch { /* non-JSON error response */ }
        throw createStreamError(payload.message || 'Không thể kết nối trợ lý lúc này.', response.status, payload.code);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const consumeEvent = block => {
        const eventName = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const dataLines = block.split('\n').filter(line => line.startsWith('data:'));
        if (!dataLines.length) return;
        let data;
        try { data = JSON.parse(dataLines.map(line => line.slice(5).trimStart()).join('\n')); }
        catch { return; }
        if (eventName === 'token' && typeof data.token === 'string') onToken?.(data.token);
        if (eventName === 'done') onDone?.(data);
        if (eventName === 'error') throw createStreamError(data.message || 'Trợ lý AI gặp lỗi.', data.status, data.code);
    };

    while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const block of events) consumeEvent(block);
        if (done) break;
    }
    if (buffer.trim()) consumeEvent(buffer);
};

export const listAssistantDocuments = async () => (await apiClient.get('/api/assistant/documents')).data;
export const uploadAssistantDocument = async ({ file, title, visibility = 'all' }) => {
    const form = new FormData();
    form.append('document', file);
    form.append('title', title);
    form.append('visibility', visibility);
    return (await apiClient.post('/api/assistant/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};

export const rateChatbotAnswer = async ({ conversationId = 'default', content, rating }) => {
    if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
        throw new Error('Trình duyệt không hỗ trợ mã hóa an toàn để gửi đánh giá.');
    }
    const bytes = new TextEncoder().encode(content);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const answerHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return (await apiClient.post('/api/assistant/feedback', { conversationId, answerHash, rating })).data;
};

export const archiveAssistantDocument = async id => (await apiClient.patch('/api/assistant/documents/' + encodeURIComponent(id) + '/archive')).data;
export const restoreAssistantDocument = async id => (await apiClient.patch('/api/assistant/documents/' + encodeURIComponent(id) + '/restore')).data;
