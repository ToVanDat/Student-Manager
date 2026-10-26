import { apiClient } from '@/api/client.js';

export const sendChatbotMessage = async message => {
    const response = await apiClient.post('/api/assistant/chat', { message });
    return response.data;
};

export const clearChatbotHistory = async () => {
    const response = await apiClient.delete('/api/assistant/history');
    return response.data;
};
