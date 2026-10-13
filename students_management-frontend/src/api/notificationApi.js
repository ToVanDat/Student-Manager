import client from './client';

export const notificationApi = {
    getPreferences: () => client.get('/api/notifications/preferences'),
    updatePreferences: preferences => client.patch('/api/notifications/preferences', preferences),
    getConversationPreference: conversationId =>
        client.get(`/api/notifications/conversations/${conversationId}`),
    updateConversationPreference: (conversationId, enabled) =>
        client.put(`/api/notifications/conversations/${conversationId}`, { enabled }),
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
    await navigator.serviceWorker.ready;
    const { data } = await notificationApi.getVapidPublicKey();
    if (!data?.publicKey) throw new Error('Máy chủ chưa cấu hình VAPID');

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeBase64Url(data.publicKey)
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
