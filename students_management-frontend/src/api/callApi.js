import client from './client';

export const callApi = {
    hideHistory: (callId) =>
        client.delete(`/api/calls/history/${encodeURIComponent(callId)}`),

    getHistory: (limit = 50, offset = 0, conversationId = null) => {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        if (conversationId) params.set('conversationId', String(conversationId));
        return client.get(`/api/calls/history?${params.toString()}`);
    },

    getNotifications: () =>
        client.get('/api/calls/notifications'),

    markNotificationRead: (notificationId) =>
        client.patch(`/api/calls/notifications/${notificationId}/read`)
};
