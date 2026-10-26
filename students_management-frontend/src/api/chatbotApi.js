import { apiClient, getAccessToken } from '@/api/client.js';

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

export const streamChatbotMessage = async (message, { signal, onToken, onDone, conversationId = 'default' } = {}) => {
    const response = await fetch(`${apiClient.defaults.baseURL}/api/assistant/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        signal,
        headers: {
            'Content-Type': 'application/json',
            ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {})
        },
        body: JSON.stringify({ message, conversationId })
    });
    if (!response.ok || !response.body) {
        let payload = {};
        try { payload = await response.json(); } catch { /* non-JSON error */ }
        throw new Error(payload.message || 'Không thể kết nối trợ lý lúc này.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split(String.fromCharCode(10, 10));
        buffer = events.pop() || '';
        for (const block of events) {
            const eventName = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
            const dataLine = block.split(String.fromCharCode(10)).find(line => line.startsWith('data:'));
            if (!dataLine) continue;
            let data;
            try { data = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
            if (eventName === 'token' && typeof data.token === 'string') onToken?.(data.token);
            if (eventName === 'done') onDone?.(data);
            if (eventName === 'error') throw new Error(data.message || 'Trợ lý AI gặp lỗi.');
        }
        if (done) break;
    }
};
