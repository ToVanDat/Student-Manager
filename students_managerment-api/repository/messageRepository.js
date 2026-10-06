const pool = require('../src/config/database');

/**
 * Tạo message mới và tự động cập nhật updated_at cho conversation
 */
const createMessage = async (conversationId, senderId, content) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const insertMessageQuery = `
            INSERT INTO messages (
                conversation_id,
                sender_id,
                content
            )
            VALUES ($1, $2, $3)
            RETURNING
                id,
                conversation_id,
                sender_id,
                content,
                is_read,
                read_at,
                is_recalled,
                recalled_at,
                deleted_at,
                edited_at,
                created_at,
                updated_at;
        `;

        const { rows } = await client.query(insertMessageQuery, [
            conversationId,
            senderId,
            content
        ]);

        const savedMessage = rows[0];

        const updateConversationQuery = `
            UPDATE conversations
            SET updated_at = NOW()
            WHERE id = $1;
        `;

        await client.query(updateConversationQuery, [conversationId]);

        await client.query('COMMIT');
        return savedMessage;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Lỗi khi tạo tin nhắn trong Transaction:', error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Lấy danh sách message của conversation
 */
const getMessagesByConversation = async (conversationId) => {
    const query = `
        SELECT
            id,
            conversation_id,
            sender_id,
            content,
            is_read,
            read_at,
            is_recalled,
            recalled_at,
            deleted_at,
            edited_at,
            created_at,
            updated_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC;
    `;

    const { rows } = await pool.query(query, [conversationId]);
    return rows;
};

/**
 * Lấy một message theo ID
 */
const getMessageById = async (messageId) => {
    const query = `
        SELECT
            id,
            conversation_id,
            sender_id,
            content,
            is_read,
            read_at,
            is_recalled,
            recalled_at,
            deleted_at,
            edited_at,
            created_at,
            updated_at
        FROM messages
        WHERE id = $1
        LIMIT 1;
    `;

    const { rows } = await pool.query(query, [messageId]);
    return rows[0] || null;
};

/**
 * Chỉnh sửa message.
 * Quyền và trạng thái message được kiểm tra ở service.
 */
const updateMessageContent = async (messageId, content) => {
    const query = `
        UPDATE messages
        SET
            content = $2,
            edited_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            conversation_id,
            sender_id,
            content,
            is_read,
            read_at,
            is_recalled,
            recalled_at,
            deleted_at,
            edited_at,
            created_at,
            updated_at;
    `;

    const { rows } = await pool.query(query, [
        messageId,
        content
    ]);

    return rows[0] || null;
};

/**
 * Thu hồi message
 */
const recallMessage = async (messageId) => {
    const query = `
        UPDATE messages
        SET
            is_recalled = TRUE,
            recalled_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            conversation_id,
            sender_id,
            content,
            is_read,
            read_at,
            is_recalled,
            recalled_at,
            deleted_at,
            edited_at,
            created_at,
            updated_at;
    `;

    const { rows } = await pool.query(query, [messageId]);
    return rows[0] || null;
};

/**
 * Xoá message cho riêng một user.
 */
const deleteMessageForMe = async (messageId, userId) => {
    const existingQuery = `
        SELECT id, message_id, user_id, deleted_at
        FROM message_deletions
        WHERE message_id = $1
          AND user_id = $2
        LIMIT 1;
    `;

    const existing = await pool.query(existingQuery, [messageId, userId]);

    if (existing.rows[0]) {
        return existing.rows[0];
    }

    const query = `
        INSERT INTO message_deletions (
            message_id,
            user_id,
            deleted_at
        )
        VALUES ($1, $2, NOW())
        RETURNING id, message_id, user_id, deleted_at;
    `;

    const { rows } = await pool.query(query, [messageId, userId]);
    return rows[0];
};

/**
 * Đánh dấu tất cả tin nhắn chưa đọc trong conversation do người khác gửi là đã đọc
 */
const markMessagesAsRead = async (conversationId, userId) => {
    const query = `
        UPDATE messages
        SET is_read = TRUE,
            read_at = NOW(),
            updated_at = NOW()
        WHERE conversation_id = $1
          AND sender_id != $2
          AND is_read = FALSE;
    `;

    const result = await pool.query(query, [conversationId, userId]);
    return result.rowCount;
};

module.exports = {
    createMessage,
    getMessagesByConversation,
    getMessageById,
    updateMessageContent,
    recallMessage,
    deleteMessageForMe,
    markMessagesAsRead
};
