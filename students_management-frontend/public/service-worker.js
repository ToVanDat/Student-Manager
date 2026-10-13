self.addEventListener('push', event => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = {};
    }

    const title = typeof payload.title === 'string' ? payload.title : 'Student Management';
    const options = {
        body: typeof payload.body === 'string' ? payload.body : 'Bạn có thông báo mới.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: typeof payload.tag === 'string' ? payload.tag : 'student-management-notification',
        data: {
            url: typeof payload.url === 'string' && payload.url.startsWith('/') && !payload.url.startsWith('//') && !payload.url.includes('\\') ? payload.url : '/chat'
        },
        renotify: false
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || '/chat', self.location.origin).href;
    event.waitUntil((async () => {
        const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientsList) {
            if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                await client.navigate(targetUrl);
                return client.focus();
            }
        }
        return self.clients.openWindow(targetUrl);
    })());
});
