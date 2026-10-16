const ALLOWED_PREFERENCE_KEYS = new Set([
    'notifications_enabled',
    'push_enabled',
    'sound_enabled',
    'preview_mode'
]);

const isAllowedPushEndpoint = value => {
    if (typeof value !== 'string' || value.length > 4096) return false;
    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' || (url.port && url.port !== '443') ||
        url.username || url.password) return false;

    const host = url.hostname.toLowerCase();
    // Push subscriptions are issued by browser push services. Restrict outbound
    // delivery to known providers to avoid turning this API into an SSRF proxy.
    return host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host === 'push.services.mozilla.com' ||
        host.endsWith('.push.services.mozilla.com') ||
        host.endsWith('.notify.windows.com') ||
        host === 'web.push.apple.com' ||
        host.endsWith('.push.apple.com');
};

const validateAccountPreferencePatch = preferences => {
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
        const error = new Error('Cài đặt thông báo không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    const entries = Object.entries(preferences);
    if (!entries.length || entries.some(([key, value]) =>
        !ALLOWED_PREFERENCE_KEYS.has(key) || (key === 'preview_mode' ? !['content', 'sender', 'hidden'].includes(value) : typeof value !== 'boolean')
    )) {
        const error = new Error('Cài đặt thông báo không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    return entries;
};

const validatePushSubscription = subscription => {
    if (!subscription ||
        !isAllowedPushEndpoint(subscription.endpoint) ||
        !subscription.keys ||
        typeof subscription.keys.p256dh !== 'string' ||
        subscription.keys.p256dh.length < 16 ||
        subscription.keys.p256dh.length > 512 ||
        typeof subscription.keys.auth !== 'string' ||
        subscription.keys.auth.length < 8 ||
        subscription.keys.auth.length > 256) {
        const error = new Error('Push subscription không hợp lệ');
        error.statusCode = 400;
        throw error;
    }
    return subscription;
};

module.exports = {
    isAllowedPushEndpoint,
    validateAccountPreferencePatch,
    validatePushSubscription
};
