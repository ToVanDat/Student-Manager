import client from './client';

export const chatApi = {
    // Lấy danh sách conversation
    getConversations: () =>
        client.get('/api/conversations'),

    // Tạo hoặc lấy conversation 1-1
    createDirectConversation: (targetUserId) =>
        client.post('/api/conversations/direct', {
            userId: targetUserId
        }),

    // Lấy lịch sử message toàn bộ 
    getMessages: (conversationId) =>
        client.get(
            `/api/messages/conversation/${conversationId}`
        ),

    // Gửi message đến user
    sendMessage: (conversationId, content) =>
        client.post('/api/messages', {
            conversationId,
            content
        }),

    // Đánh dấu user đã đọc
    markAsRead: (conversationId) =>
        client.patch(
            `/api/conversations/${conversationId}/read`
        ),
};