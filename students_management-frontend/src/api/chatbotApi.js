import { apiClient } from '@/api/client.js';

export const sendChatbotMessage = async message => {
    const response = await apiClient.post('/api/assistant/chat', { message });
    return response.data;
};
