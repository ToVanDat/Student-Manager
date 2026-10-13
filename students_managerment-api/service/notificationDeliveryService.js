const pool = require('../src/config/database');
const notificationCenterService = require('./notificationCenterService');
const webPushService = require('./webPushService');

const makePreview = (mode, senderName, messageContent) => {
    if (mode === 'hidden') return { title: 'Student Management', body: 'Bạn có tin nhắn mới.' };
    if (mode === 'sender') return { title: 'Tin nhắn mới', body: `${senderName} đã gửi cho bạn một tin nhắn.` };
    const text = typeof messageContent === 'string' ? messageContent.trim() : '';
    return { title: senderName || 'Tin nhắn mới', body: text ? (text.length > 140 ? `${text.slice(0, 137)}...` : text) : 'Bạn có tin nhắn mới.' };
};

const notifyMessageRecipients = async ({ io, conversationId, senderId, senderName, message }) => {
    const { rows: members } = await pool.query(
        `SELECT cm.user_id FROM conversation_members cm
         WHERE cm.conversation_id = $1 AND cm.left_at IS NULL AND cm.user_id <> $2`,
        [conversationId, senderId]
    );
    await Promise.allSettled(members.map(async ({ user_id: recipientId }) => {
        const { rows: prefsRows } = await pool.query(
            `SELECT notifications_enabled, push_enabled, sound_enabled, preview_mode
             FROM user_notification_preferences WHERE user_id = $1`, [recipientId]
        );
        const prefs = prefsRows[0] || { notifications_enabled: true, push_enabled: false, sound_enabled: true, preview_mode: 'content' };
        if (!prefs.notifications_enabled) return;
        const { rows: conversationPrefs } = await pool.query(
            `SELECT notifications_enabled, is_muted FROM conversation_notification_preferences
             WHERE conversation_id = $1 AND user_id = $2`, [conversationId, recipientId]
        );
        const cp = conversationPrefs[0];
        if (cp?.notifications_enabled === false || cp?.is_muted === true) return;
        const preview = makePreview(prefs.preview_mode, senderName, message.content);
        const notification = await notificationCenterService.createForUser({
            userId: Number(recipientId), type: 'message', title: preview.title, body: preview.body,
            conversationId: Number(conversationId), messageId: message.id
        });
        io.to(`user:${recipientId}`).emit('notification:new', { ...notification, soundEnabled: prefs.sound_enabled !== false });
        if (prefs.push_enabled) {
            await webPushService.sendPushToUser(Number(recipientId), {
                ...preview, tag: `conversation-${conversationId}`, url: `/chat?conversationId=${conversationId}`
            }, Number(conversationId));
        }
    }));
};

module.exports = { makePreview, notifyMessageRecipients };
