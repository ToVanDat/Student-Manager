const webpush = require('web-push');
const pool = require('../src/config/database');
const { validateAccountPreferencePatch, validatePushSubscription } = require('./notificationPolicy');

const configured = Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
);

if (configured) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

const getAccountPreferences = async (userId) => {
    const { rows } = await pool.query(
        `INSERT INTO user_notification_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING user_id, notifications_enabled, push_enabled, sound_enabled, updated_at`,
        [userId]
    );
    return rows[0];
};

const updateAccountPreferences = async (userId, preferences) => {
    const entries = validateAccountPreferencePatch(preferences);

    await getAccountPreferences(userId);
    const sets = [];
    const values = [userId];
    for (const [key, value] of entries) {
        values.push(value);
        sets.push(`${key} = $${values.length}`);
    }

    const { rows } = await pool.query(
        `UPDATE user_notification_preferences
         SET ${sets.join(', ')}, updated_at = NOW()
         WHERE user_id = $1
         RETURNING user_id, notifications_enabled, push_enabled, sound_enabled, updated_at`,
        values
    );
    return rows[0];
};

const assertConversationMember = async (conversationId, userId) => {
    const { rowCount } = await pool.query(
        `SELECT 1 FROM conversation_members
         WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL LIMIT 1`,
        [conversationId, userId]
    );
    if (!rowCount) {
        const error = new Error('Bạn không thuộc cuộc trò chuyện này');
        error.statusCode = 403;
        throw error;
    }
};

const getConversationPreference = async (conversationId, userId) => {
    await assertConversationMember(conversationId, userId);
    const { rows } = await pool.query(
        `INSERT INTO conversation_notification_preferences (conversation_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conversationId, userId]
    );
    const result = await pool.query(
        `SELECT conversation_id, user_id, enabled, updated_at
         FROM conversation_notification_preferences
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
    );
    return result.rows[0];
};

const updateConversationPreference = async (conversationId, userId, enabled) => {
    if (typeof enabled !== 'boolean') {
        const error = new Error('Trạng thái thông báo phải là boolean');
        error.statusCode = 400;
        throw error;
    }
    await assertConversationMember(conversationId, userId);
    const { rows } = await pool.query(
        `INSERT INTO conversation_notification_preferences
             (conversation_id, user_id, enabled, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (conversation_id, user_id)
         DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
         RETURNING conversation_id, user_id, enabled, updated_at`,
        [conversationId, userId, enabled]
    );
    return rows[0];
};

const saveSubscription = async (userId, subscription, userAgent) => {
    validatePushSubscription(subscription);

    const { rows } = await pool.query(
        `INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             user_agent = EXCLUDED.user_agent,
             updated_at = NOW()
         RETURNING id, user_id, endpoint, created_at`,
        [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, userAgent || null]
    );
    return rows[0];
};

const removeSubscription = async (userId, endpoint) => {
    const { rowCount } = await pool.query(
        'DELETE FROM web_push_subscriptions WHERE user_id = $1 AND endpoint = $2',
        [userId, endpoint]
    );
    return rowCount > 0;
};

const sendPushToUser = async (userId, payload, conversationId = null) => {
    if (!configured) return { sent: 0, skipped: 'vapid_not_configured' };

    const account = await getAccountPreferences(userId);
    if (!account.push_enabled) return { sent: 0, skipped: 'push_disabled' };

    if (conversationId !== null) {
        const { rows } = await pool.query(
            `SELECT enabled FROM conversation_notification_preferences
             WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, userId]
        );
        if (rows[0]?.enabled === false) return { sent: 0, skipped: 'conversation_muted' };
    }

    const { rows } = await pool.query(
        'SELECT id, endpoint, p256dh, auth FROM web_push_subscriptions WHERE user_id = $1',
        [userId]
    );
    let sent = 0;
    for (const row of rows) {
        try {
            await webpush.sendNotification({
                endpoint: row.endpoint,
                keys: { p256dh: row.p256dh, auth: row.auth }
            }, JSON.stringify(payload), { TTL: 60, urgency: 'normal' });
            sent += 1;
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) {
                await pool.query('DELETE FROM web_push_subscriptions WHERE id = $1', [row.id]);
            } else {
                console.error('[WEB PUSH] delivery failed', {
                    statusCode: error.statusCode,
                    message: error.message
                });
            }
        }
    }
    return { sent };
};

module.exports = {
    configured,
    getAccountPreferences,
    updateAccountPreferences,
    getConversationPreference,
    updateConversationPreference,
    saveSubscription,
    removeSubscription,
    sendPushToUser
};
