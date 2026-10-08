import client from './client';

export const callApi = {
    getHistory: (limit = 50, offset = 0) =>
        client.get(`/api/calls/history?limit=${limit}&offset=${offset}`),

    getNotifications: () =>
        client.get('/api/calls/notifications'),

    markNotificationRead: (notificationId) =>
        client.patch(`/api/calls/notifications/${notificationId}/read`)
};
