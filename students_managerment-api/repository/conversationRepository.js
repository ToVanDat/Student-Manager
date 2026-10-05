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

            m.content AS "lastMessage",
            m.created_at AS "lastMessageAt",

            COUNT(
                CASE
                    WHEN m2.is_read = FALSE
                     AND m2.sender_id != $1
                    THEN 1
                END
            ) AS "unreadCount"

        FROM conversations c

        INNER JOIN conversation_members cm
            ON cm.conversation_id = c.id

        INNER JOIN conversation_members other_cm
            ON other_cm.conversation_id = c.id
            AND other_cm.user_id != $1

        INNER JOIN users u
            ON u.id = other_cm.user_id

        LEFT JOIN LATERAL (
            SELECT
                content,
                created_at
            FROM messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC
            LIMIT 1
        ) m ON TRUE

        LEFT JOIN messages m2
            ON m2.conversation_id = c.id

        WHERE cm.user_id = $1

        GROUP BY
            c.id,
            c.type,
            u.id,
            u.username,
            u.avatar_url,
            m.content,
            m.created_at

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
    getConversationMemberIds
};