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

    // Chỉnh sửa message
    editMessage: (messageId, content) =>
        client.patch(`/api/messages/${messageId}`, { content }),

    // Thu hồi message
    recallMessage: (messageId) =>
        client.post(`/api/messages/${messageId}/recall`),

    // Xoá message cho tôi
    deleteMessageForMe: (messageId) =>
        client.delete(`/api/messages/${messageId}/me`),

    // Xoá message cho tất cả
    deleteMessageForEveryone: (messageId) =>
        client.delete(`/api/messages/${messageId}/everyone`),

    // Upload file cho một message
    uploadFile: (messageId, file, onUploadProgress) => {
        const formData = new FormData();
        formData.append('file', file);

        return client.post(
            `/api/messages/${messageId}/files`,
            formData,
            {
                onUploadProgress,
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        );
    },

    // Tải file bằng access token hiện tại
    downloadFile: (fileId) =>
        client.get(`/api/message-files/${fileId}`, {
            responseType: 'blob'
        }),

    // Đánh dấu user đã đọc
    markAsRead: (conversationId) =>
        client.patch(
            `/api/conversations/${conversationId}/read`
        ),
};