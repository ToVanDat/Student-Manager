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
    getMessages: (conversationId, page = 1, limit = 50) =>
        client.get(`/api/messages/conversation/${conversationId}?page=${page}&limit=${limit}`),

    // Gửi message đến user
    sendMessage: (conversationId, content, replyToMessageId = null) =>
        client.post('/api/messages', {
            conversationId,
            content,
            replyToMessageId
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

    addReaction: (messageId, emoji) =>
        client.post(`/api/messages/${messageId}/reactions`, { emoji }),

    removeReaction: (messageId, emoji) =>
        client.delete(`/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),

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

    deleteFile: (fileId) =>
        client.delete(`/api/message-files/${fileId}`),

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