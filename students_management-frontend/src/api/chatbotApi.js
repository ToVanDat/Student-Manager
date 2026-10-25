import { apiClient } from '@/api/client.js';

export const sendChatbotMessage = async (message, history = []) => {
    const response = await apiClient.post('/api/assistant/chat', { message, history });
    return response.data;
};
