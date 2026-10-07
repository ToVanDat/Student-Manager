const pool = require('../src/config/database');

/**
 * Tạo message mới và tự động cập nhật updated_at cho conversation
 */
const createMessage = async (conversationId, senderId, content, replyToMessageId = null) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const insertMessageQuery = `
            INSERT INTO messages (
                conversation_id,
                sender_id,
                content,
                reply_to_message_id
            )
            VALUES ($1, $2, $3, $4)
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
                reply_to_message_id,
                created_at,
                updated_at;
        `;

        const { rows } = await client.query(insertMessageQuery, [
            conversationId,
            senderId,
            content,
            replyToMessageId
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
const getMessagesByConversation = async (conversationId, userId, page = 1, limit = 50) => {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const offset = (safePage - 1) * safeLimit;

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
            updated_at,
            reply_to_message_id,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', mf.id,
                            'message_id', mf.message_id,
                            'file_name', mf.file_name,
                            'mime_type', mf.mime_type,
                            'file_size', mf.file_size,
                            'created_at', mf.created_at
                        )
                        ORDER BY mf.created_at ASC, mf.id ASC
                    )
                    FROM message_files mf
                    WHERE mf.message_id = m.id
                ),
                '[]'::json
            ) AS files,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', mr.id,
                            'user_id', mr.user_id,
                            'emoji', mr.emoji,
                            'created_at', mr.created_at
                        ) ORDER BY mr.created_at ASC, mr.id ASC
                    )
                    FROM message_reactions mr
                    WHERE mr.message_id = m.id
                ),
                '[]'::json
            ) AS reactions,
            CASE WHEN m.reply_to_message_id IS NULL THEN NULL ELSE (
                SELECT json_build_object(
                    'id', rm.id,
                    'sender_id', rm.sender_id,
                    'content', rm.content,
                    'is_recalled', rm.is_recalled,
                    'deleted_at', rm.deleted_at
                ) FROM messages rm WHERE rm.id = m.reply_to_message_id
            ) END AS reply_to
        FROM messages m
        WHERE m.conversation_id = $1
          AND NOT EXISTS (
              SELECT 1
              FROM message_deletions md
              WHERE md.message_id = m.id
                AND md.user_id = $2
          )
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $3 OFFSET $4;
    `;

    const { rows } = await pool.query(query, [conversationId, userId, safeLimit, offset]);
    return rows.reverse();
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
            updated_at,
            reply_to_message_id
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
const updateMessageContent = async (messageId, userId, content) => {
    const query = `
        UPDATE messages
        SET
            content = $3,
            edited_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND sender_id = $2
          AND is_recalled = FALSE
          AND deleted_at IS NULL
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
        userId,
        content
    ]);

    return rows[0] || null;
};

/**
 * Thu hồi message
 */
const recallMessage = async (messageId, userId) => {
    const query = `
        UPDATE messages
        SET
            is_recalled = TRUE,
            recalled_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND sender_id = $2
          AND is_recalled = FALSE
          AND deleted_at IS NULL
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

    const { rows } = await pool.query(query, [messageId, userId]);
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
        RETURNING
            id,
            message_id,
            user_id,
            deleted_at,
            (
                SELECT conversation_id
                FROM messages
                WHERE id = message_deletions.message_id
            ) AS conversation_id;
    `;

    const { rows } = await pool.query(query, [messageId, userId]);
    return rows[0];
};

/**
 * Đánh dấu tất cả tin nhắn chưa đọc trong conversation do người khác gửi là đã đọc
 */
const deleteMessageForEveryone = async (messageId, userId) => {
    const query = `
        UPDATE messages
        SET content = '', deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1
          AND sender_id = $2
          AND deleted_at IS NULL
          AND is_recalled = FALSE
        RETURNING id, conversation_id, sender_id, content, is_read, read_at,
                  is_recalled, recalled_at, deleted_at, edited_at, created_at, updated_at;
    `;
    const { rows } = await pool.query(query, [messageId, userId]);
    return rows[0] || null;
};

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


const addReaction = async (messageId, userId, emoji) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // One reaction per user/message, same behaviour as Messenger/Zalo.
        await client.query(
            `DELETE FROM message_reactions
             WHERE message_id = $1 AND user_id = $2`,
            [messageId, userId]
        );

        const { rows } = await client.query(
            `INSERT INTO message_reactions (message_id, user_id, emoji)
             VALUES ($1, $2, $3)
             RETURNING id, message_id, user_id, emoji, created_at`,
            [messageId, userId, emoji]
        );

        await client.query('COMMIT');
        return rows[0] || null;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const removeReaction = async (messageId, userId, emoji) => {
    const query = `
        DELETE FROM message_reactions
        WHERE message_id = $1 AND user_id = $2 AND emoji = $3
        RETURNING id, message_id, user_id, emoji, created_at;
    `;
    const { rows } = await pool.query(query, [messageId, userId, emoji]);
    return rows[0] || null;
};

module.exports = {
    createMessage,
    getMessagesByConversation,
    getMessageById,
    updateMessageContent,
    recallMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    markMessagesAsRead,
    addReaction,
    removeReaction
};
