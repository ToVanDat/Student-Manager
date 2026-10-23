import client from './client';

export const notificationApi = {
    getPreferences: () => client.get('/api/notifications/preferences'),
    getHistory: (limit = 30, offset = 0) => client.get('/api/notifications/history', { params: { limit, offset } }),
    markRead: notificationId => client.patch(`/api/notifications/history/${notificationId}/read`),
    markAllRead: () => client.patch('/api/notifications/history/read-all'),
    deleteNotification: notificationId => client.delete(`/api/notifications/history/${notificationId}`),
    updatePreferences: preferences => client.patch('/api/notifications/preferences', preferences),
    getConversationPreference: conversationId =>
        client.get(`/api/notifications/conversations/${conversationId}`),
    updateConversationPreference: (conversationId, notificationsEnabled) =>
        client.put(`/api/notifications/conversations/${conversationId}`, {
            notifications_enabled: notificationsEnabled
        }),
    getVapidPublicKey: () => client.get('/api/notifications/vapid-public-key'),
    subscribe: subscription => client.post('/api/notifications/subscriptions', { subscription }),
    unsubscribe: endpoint => client.delete('/api/notifications/subscriptions', { data: { endpoint } })
};

const decodeBase64Url = value => {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from(raw, char => char.charCodeAt(0));
};

const sameBytes = (left, right) => {
    if (!left || !right || left.byteLength !== right.byteLength) return false;
    const a = new Uint8Array(left);
    const b = right instanceof Uint8Array ? right : new Uint8Array(right);
    return a.every((value, index) => value === b[index]);
};

export async function enableWebPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Trình duyệt này chưa hỗ trợ Web Push');
    }
    if (Notification.permission === 'denied') {
        throw new Error('Bạn đã chặn thông báo trong cài đặt trình duyệt');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Bạn chưa cấp quyền thông báo');

    const registration = await navigator.serviceWorker.register('/service-worker.js');
    const readyRegistration = await navigator.serviceWorker.ready;
    const activeRegistration = readyRegistration || registration;
    const { data } = await notificationApi.getVapidPublicKey();
    if (!data?.publicKey) throw new Error('Máy chủ chưa cấu hình VAPID');

    const expectedApplicationServerKey = decodeBase64Url(data.publicKey);
    let subscription = await activeRegistration.pushManager.getSubscription();

    // Existing subscriptions can survive a server-side VAPID key rotation. Reusing
    // one created with a different public key can cause provider-side 403 responses.
    const existingApplicationServerKey = subscription?.options?.applicationServerKey;
    if (
        subscription &&
        existingApplicationServerKey &&
        !sameBytes(existingApplicationServerKey, expectedApplicationServerKey)
    ) {
        // Remove the server record first. If that request fails, preserve the browser
        // subscription rather than creating an untracked replacement.
        await notificationApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
        subscription = null;
    }

    if (!subscription) {
        subscription = await activeRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: expectedApplicationServerKey
        });
    }

    await notificationApi.subscribe(subscription.toJSON());
    return subscription;
}

export async function disableWebPush() {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration('/service-worker.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await notificationApi.unsubscribe(subscription.endpoint);
    await subscription.unsubscribe();
}
