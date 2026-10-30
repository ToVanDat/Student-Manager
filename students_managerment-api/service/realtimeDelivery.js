'use strict';

function publishRealtimeBestEffort(publish, context = {}) {
    try {
        publish();
        return true;
    } catch (error) {
        console.warn('[REALTIME][best-effort delivery failed]', {
            ...context,
            code: error?.code || 'REALTIME_DELIVERY_FAILED'
        });
        return false;
    }
}

module.exports = { publishRealtimeBestEffort };
