const pool = require('../src/config/database');

/**
 * Tìm conversation direct giữa 2 user: kiểm tra xem cuộc trò chuyện giữa A và B đã tồn tại chưa
 */
const findDirectConversation = async (userId1, userId2) => {
    const query = `
        SELECT c.id,
               c.type,
               c.created_at,
               c.updated_at
        FROM conversations c
        JOIN conversation_members cm
            ON cm.conversation_id = c.id
        WHERE c.type = 'direct'
          AND cm.user_id IN ($1, $2)
        GROUP BY c.id
        HAVING COUNT(DISTINCT cm.user_id) = 2
        ORDER BY c.id
        LIMIT 1;
    `;

    const { rows } = await pool.query(query, [userId1, userId2]);
    return rows[0] || null;
};

/**
 * Tạo conversation mới
 */
const createConversation = async (type = 'direct') => {
    const query = `
        INSERT INTO conversations (type)
        VALUES ($1)
        RETURNING id, type, created_at, updated_at;
    `;

    const { rows } = await pool.query(query, [type]);
    return rows[0];
};

/**
 * Thêm user vào conversation
 */
const addMember = async (conversationId, userId) => {
    const query = `
        INSERT INTO conversation_members (
            conversation_id,
            user_id
        )
        VALUES ($1, $2)
        RETURNING conversation_id, user_id, joined_at;
    `;

    const { rows } = await pool.query(query, [conversationId, userId]);
    return rows[0];
};

/**
 * Lấy tất cả danh sách conversation của user
 */
const getUserConversations = async (userId) => {
    const query = `
        SELECT
            c.id,
            c.type,
            u.id AS "userId",
            u.username AS "name",
            u.avatar_url AS "avatar",

            COALESCE(latest_message.content, '') AS "lastMessage",
            latest_message.created_at AS "lastMessageAt",

            (
                SELECT COUNT(*)
                FROM messages m2
                WHERE m2.conversation_id = c.id
                  AND m2.is_read = FALSE
                  AND m2.sender_id != $1
                  AND NOT EXISTS (
                      SELECT 1
                      FROM message_deletions md2
                      WHERE md2.message_id = m2.id
                        AND md2.user_id = $1
                  )
            ) AS "unreadCount"

        FROM conversations c

        INNER JOIN conversation_members cm
            ON cm.conversation_id = c.id
           AND cm.user_id = $1

        INNER JOIN conversation_members other_cm
            ON other_cm.conversation_id = c.id
           AND other_cm.user_id != $1

        INNER JOIN users u
            ON u.id = other_cm.user_id

        LEFT JOIN LATERAL (
            SELECT
                CASE
                    WHEN m.is_recalled THEN 'Tin nhắn đã được thu hồi'
                    WHEN m.deleted_at IS NOT NULL THEN 'Tin nhắn đã bị xoá'
                    ELSE m.content
                END AS content,
                m.created_at
            FROM messages m
            WHERE m.conversation_id = c.id
              AND NOT EXISTS (
                  SELECT 1
                  FROM message_deletions md
                  WHERE md.message_id = m.id
                    AND md.user_id = $1
              )
            ORDER BY m.created_at DESC
            LIMIT 1
        ) latest_message ON TRUE

        WHERE (
            SELECT COUNT(*)
            FROM conversation_members cm_all
            WHERE cm_all.conversation_id = c.id
        ) = 2

        ORDER BY c.updated_at DESC;
    `;

    const { rows } = await pool.query(query, [userId]);

    return rows.map(row => ({
        id: row.id,
        type: row.type,
        userId: row.userId,
        name: row.name,
        avatar: row.avatar,
        lastMessage: row.lastMessage || '',
        lastMessageAt: row.lastMessageAt,
        unreadCount: Number(row.unreadCount || 0),
        isOnline: false
    }));
};

/**
 * Lấy thành viên (user) của conversation
 */
const getConversationMembers = async (conversationId) => {
    const query = `
        SELECT
            cm.conversation_id,
            cm.user_id,
            cm.joined_at
        FROM conversation_members cm
        WHERE cm.conversation_id = $1
        ORDER BY cm.joined_at ASC;
    `;

    const { rows } = await pool.query(query, [conversationId]);
    return rows;
};

/**
 * Kiểm tra user có thuộc conversation không
 */
const isConversationMember = async (conversationId, userId) => {
    const query = `
        SELECT 1
        FROM conversation_members
        WHERE conversation_id = $1
          AND user_id = $2
        LIMIT 1;
    `;

    const { rows } = await pool.query(query, [conversationId, userId]);
    return rows.length > 0;
};

// /**
//  * Lấy danh sách ID của tất cả thành viên trong một conversation
//  * @param {number} conversationId
//  * @returns {Promise<number[]>}
//  */
/**
 * Lấy danh sách user khác mà user hiện tại đang có conversation cùng.
 * Dùng cho realtime presence: chỉ broadcast online/offline tới người có liên quan.
 */
const getConversationContactIds = async (userId) => {
    const query = `
        SELECT DISTINCT cm_other.user_id
        FROM conversation_members cm_self
        INNER JOIN conversation_members cm_other
            ON cm_other.conversation_id = cm_self.conversation_id
           AND cm_other.user_id != $1
        WHERE cm_self.user_id = $1;
    `;

    const { rows } = await pool.query(query, [userId]);
    return rows.map(row => Number(row.user_id));
};

const getConversationMemberIds = async (conversationId) => {
    try {
        const query = `
            SELECT user_id 
            FROM conversation_members 
            WHERE conversation_id = $1;
        `;

        // Đã sửa 'db' thành 'pool'
        const { rows } = await pool.query(query, [conversationId]);
        return rows.map(row => Number(row.user_id));
    } catch (error) {
        console.error('Error in getConversationMemberIds:', error);
        throw error;
    }
};

module.exports = {
    findDirectConversation,
    createConversation,
    addMember,
    getUserConversations,
    getConversationMembers,
    isConversationMember,
    getConversationMemberIds,
    getConversationContactIds
};