const pool = require('../src/config/database');

const listForUser = async (userId, limit = 30, offset = 0) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const { rows } = await pool.query(
        `SELECT id, type, title, body, conversation_id, message_id,
                is_read, read_at, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2 OFFSET $3`,
        [userId, safeLimit, safeOffset]
    );
    return rows;
};

const getUnreadCount = async userId => {
    const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
        [userId]
    );
    return rows[0]?.count || 0;
};

const createForUser = async ({ userId, type = 'message', title, body, conversationId = null, messageId = null }) => {
    const { rows } = await pool.query(
        `INSERT INTO notifications
            (user_id, type, title, body, conversation_id, message_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, type, title, body, conversation_id, message_id,
                   is_read, read_at, created_at`,
        [userId, type, String(title).slice(0, 180), String(body), conversationId, messageId]
    );
    return rows[0];
};

const markRead = async (userId, notificationId) => {
    const { rows } = await pool.query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
         WHERE id = $1 AND user_id = $2
         RETURNING id, is_read, read_at`,
        [notificationId, userId]
    );
    return rows[0] || null;
};

const deleteForUser = async (userId, notificationId) => {
    const { rows } = await pool.query(
        `DELETE FROM notifications
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [notificationId, userId]
    );
    return rows[0] || null;
};

const markAllRead = async userId => {
    const { rowCount } = await pool.query(
        `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
         WHERE user_id = $1 AND is_read = FALSE`,
        [userId]
    );
    return rowCount;
};

module.exports = { listForUser, getUnreadCount, createForUser, markRead, markAllRead, deleteForUser };
