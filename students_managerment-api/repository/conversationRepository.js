const pool = require('../src/config/database');

const findDirectConversation = async (userId1, userId2) => {
    const query = `
        SELECT c.id, c.type, c.created_at, c.updated_at
        FROM conversations c
        JOIN conversation_members cm ON cm.conversation_id = c.id
        WHERE c.type = 'direct'
          AND cm.user_id IN ($1, $2)
          AND cm.left_at IS NULL
        GROUP BY c.id
        HAVING COUNT(DISTINCT cm.user_id) = 2
        ORDER BY c.id
        LIMIT 1;
    `;
    const { rows } = await pool.query(query, [userId1, userId2]);
    return rows[0] || null;
};

const createConversation = async (type = 'direct', name = null, avatarUrl = null) => {
    const { rows } = await pool.query(
        `
            INSERT INTO conversations (type, name, avatar_url)
            VALUES ($1, $2, $3)
            RETURNING id, type, name, avatar_url, created_at, updated_at;
        `,
        [type, name, avatarUrl]
    );
    return rows[0];
};

const addMember = async (conversationId, userId, role = null) => {
    const { rows } = await pool.query(
        `
            INSERT INTO conversation_members (conversation_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (conversation_id, user_id)
            DO UPDATE SET left_at = NULL, role = EXCLUDED.role
            RETURNING conversation_id, user_id, role, joined_at, left_at;
        `,
        [conversationId, userId, role]
    );
    return rows[0];
};

const getUserConversations = async (userId) => {
    const query = `
        SELECT
            c.id,
            c.type,
            c.name AS "conversationName",
            c.avatar_url AS "conversationAvatar",
            CASE WHEN c.type = 'direct' THEN other_user.id END AS "userId",
            CASE
                WHEN c.type = 'direct' THEN other_user.username
                ELSE COALESCE(
                    c.name,
                    NULLIF(string_agg(DISTINCT member_user.username, ', ' ORDER BY member_user.username), '')
                )
            END AS "name",
            CASE WHEN c.type = 'direct' THEN other_user.avatar_url END AS "avatar",
            CASE WHEN c.type = 'direct' THEN other_user.last_seen_at END AS "lastSeenAt",
            COUNT(DISTINCT cm_all.user_id)::int AS "memberCount",
            COALESCE(latest_message.content, '') AS "lastMessage",
            latest_message.created_at AS "lastMessageAt",
            (
                SELECT COUNT(*)
                FROM messages m2
                WHERE m2.conversation_id = c.id
                  AND m2.is_read = FALSE
                  AND m2.sender_id != $1
                  AND NOT EXISTS (
                      SELECT 1 FROM message_deletions md2
                      WHERE md2.message_id = m2.id AND md2.user_id = $1
                  )
            ) AS "unreadCount"
        FROM conversations c
        INNER JOIN conversation_members cm_self
            ON cm_self.conversation_id = c.id
           AND cm_self.user_id = $1
           AND cm_self.left_at IS NULL
        INNER JOIN conversation_members cm_all
            ON cm_all.conversation_id = c.id
           AND cm_all.left_at IS NULL
        INNER JOIN users member_user
            ON member_user.id = cm_all.user_id
        LEFT JOIN LATERAL (
            SELECT u.id, u.username, u.avatar_url, u.last_seen_at
            FROM conversation_members cm_other
            JOIN users u ON u.id = cm_other.user_id
            WHERE cm_other.conversation_id = c.id
              AND cm_other.user_id != $1
              AND cm_other.left_at IS NULL
            ORDER BY cm_other.joined_at ASC
            LIMIT 1
        ) other_user ON TRUE
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
                  SELECT 1 FROM message_deletions md
                  WHERE md.message_id = m.id AND md.user_id = $1
              )
            ORDER BY m.created_at DESC
            LIMIT 1
        ) latest_message ON TRUE
        GROUP BY
            c.id, c.type, c.name, c.avatar_url,
            other_user.id, other_user.username, other_user.avatar_url, other_user.last_seen_at,
            latest_message.content, latest_message.created_at
        ORDER BY COALESCE(latest_message.created_at, c.updated_at) DESC;
    `;

    const { rows } = await pool.query(query, [userId]);

    return rows.map(row => ({
        id: row.id,
        type: row.type,
        userId: row.userId,
        name: row.name || (row.type === 'group' ? 'Nhóm chat' : 'Người dùng'),
        avatar: row.avatar || null,
        lastSeenAt: row.lastSeenAt || null,
        conversationName: row.conversationName,
        conversationAvatar: row.conversationAvatar,
        memberCount: Number(row.memberCount || 0),
        lastMessage: row.lastMessage || '',
        lastMessageAt: row.lastMessageAt,
        unreadCount: Number(row.unreadCount || 0),
        isOnline: false
    }));
};

const getConversationMembers = async (conversationId) => {
    const { rows } = await pool.query(
        `
            SELECT
                cm.conversation_id,
                cm.user_id,
                cm.role,
                cm.joined_at,
                cm.left_at,
                u.username,
                u.avatar_url AS avatar,
                u.last_seen_at
            FROM conversation_members cm
            JOIN users u ON u.id = cm.user_id
            WHERE cm.conversation_id = $1
              AND cm.left_at IS NULL
            ORDER BY
                CASE cm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
                cm.joined_at ASC;
        `,
        [conversationId]
    );
    return rows;
};

const getConversationInfo = async (conversationId) => {
    const { rows } = await pool.query(
        `
            SELECT id, type, name, avatar_url, created_at, updated_at
            FROM conversations
            WHERE id = $1
            LIMIT 1;
        `,
        [conversationId]
    );
    return rows[0] || null;
};

const updateGroupConversation = async (conversationId, name, avatarUrl = null) => {
    const { rows } = await pool.query(
        `
            UPDATE conversations
            SET name = $2,
                avatar_url = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND type = 'group'
            RETURNING id, type, name, avatar_url, created_at, updated_at;
        `,
        [conversationId, name, avatarUrl]
    );
    return rows[0] || null;
};

const getConversationMemberIds = async (conversationId) => {
    const { rows } = await pool.query(
        `
            SELECT user_id
            FROM conversation_members
            WHERE conversation_id = $1
              AND left_at IS NULL;
        `,
        [conversationId]
    );
    return rows.map(row => Number(row.user_id));
};

const getConversationContactIds = async (userId) => {
    const { rows } = await pool.query(
        `
            SELECT DISTINCT cm_other.user_id
            FROM conversation_members cm_self
            JOIN conversation_members cm_other
              ON cm_other.conversation_id = cm_self.conversation_id
             AND cm_other.user_id != $1
             AND cm_other.left_at IS NULL
            WHERE cm_self.user_id = $1
              AND cm_self.left_at IS NULL;
        `,
        [userId]
    );
    return rows.map(row => Number(row.user_id));
};

const isConversationMember = async (conversationId, userId) => {
    const { rows } = await pool.query(
        `
            SELECT 1
            FROM conversation_members
            WHERE conversation_id = $1
              AND user_id = $2
              AND left_at IS NULL
            LIMIT 1;
        `,
        [conversationId, userId]
    );
    return rows.length > 0;
};

const getMemberRole = async (conversationId, userId) => {
    const { rows } = await pool.query(
        `
            SELECT role
            FROM conversation_members
            WHERE conversation_id = $1
              AND user_id = $2
              AND left_at IS NULL
            LIMIT 1;
        `,
        [conversationId, userId]
    );
    return rows[0]?.role ?? null;
};

const updateMemberRole = async (conversationId, userId, role) => {
    const { rows } = await pool.query(
        `
            UPDATE conversation_members
            SET role = $3
            WHERE conversation_id = $1
              AND user_id = $2
              AND left_at IS NULL
            RETURNING conversation_id, user_id, role, joined_at, left_at;
        `,
        [conversationId, userId, role]
    );
    return rows[0] || null;
};

const removeMember = async (conversationId, userId) => {
    const { rows } = await pool.query(
        `
            UPDATE conversation_members
            SET left_at = CURRENT_TIMESTAMP
            WHERE conversation_id = $1
              AND user_id = $2
              AND left_at IS NULL
            RETURNING conversation_id, user_id, role, left_at;
        `,
        [conversationId, userId]
    );
    return rows[0] || null;
};

const createGroupConversation = async (ownerId, memberIds, name, avatarUrl = null) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const conversationResult = await client.query(
            `
                INSERT INTO conversations (type, name, avatar_url)
                VALUES ('group', $1, $2)
                RETURNING id, type, name, avatar_url, created_at, updated_at;
            `,
            [name, avatarUrl]
        );

        const conversation = conversationResult.rows[0];
        const uniqueMemberIds = [...new Set([Number(ownerId), ...memberIds.map(Number)])];

        for (const memberId of uniqueMemberIds) {
            await client.query(
                `
                    INSERT INTO conversation_members (conversation_id, user_id, role)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (conversation_id, user_id)
                    DO UPDATE SET left_at = NULL, role = EXCLUDED.role;
                `,
                [conversation.id, memberId, memberId === Number(ownerId) ? 'owner' : 'member']
            );
        }

        await client.query('COMMIT');
        return conversation;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    findDirectConversation,
    createConversation,
    addMember,
    getUserConversations,
    getConversationMembers,
    getConversationInfo,
    isConversationMember,
    getMemberRole,
    updateMemberRole,
    removeMember,
    getConversationMemberIds,
    getConversationContactIds,
    updateGroupConversation,
    createGroupConversation
};
