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

const addMember = async (conversationId, userId, role = 'member') => {
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
            COALESCE(cus.pinned, FALSE) AS "isPinned",
            cus.muted_until AS "mutedUntil",
            COALESCE(cus.marked_unread, FALSE) AS "markedUnread",
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
        LEFT JOIN conversation_user_settings cus
            ON cus.conversation_id = c.id
           AND cus.user_id = $1
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
        WHERE cus.hidden_at IS NULL
        GROUP BY
            c.id, c.type, c.name, c.avatar_url,
            other_user.id, other_user.username, other_user.avatar_url, other_user.last_seen_at,
            latest_message.content, latest_message.created_at,
            cus.pinned, cus.muted_until, cus.marked_unread
        ORDER BY COALESCE(cus.pinned, FALSE) DESC,
                 COALESCE(latest_message.created_at, c.updated_at) DESC;
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
        isPinned: Boolean(row.isPinned),
        mutedUntil: row.mutedUntil || null,
        markedUnread: Boolean(row.markedUnread),
        isOnline: false
    }));
};

const getConversationSettings = async (conversationId, userId) => {
    const { rows } = await pool.query(
        `
            SELECT conversation_id, user_id, pinned, muted_until, marked_unread, hidden_at
            FROM conversation_user_settings
            WHERE conversation_id = $1 AND user_id = $2
            LIMIT 1;
        `,
        [conversationId, userId]
    );
    return rows[0] || {
        conversation_id: conversationId,
        user_id: userId,
        pinned: false,
        muted_until: null,
        marked_unread: false,
        hidden_at: null
    };
};

const updateConversationSettings = async (
    conversationId,
    userId,
    { pinned = false, mutedUntil = null, markedUnread = false, hidden = false } = {}
) => {
    const { rows } = await pool.query(
        `
            INSERT INTO conversation_user_settings
                (conversation_id, user_id, pinned, muted_until, marked_unread, hidden_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (conversation_id, user_id)
            DO UPDATE SET
                pinned = EXCLUDED.pinned,
                muted_until = EXCLUDED.muted_until,
                marked_unread = EXCLUDED.marked_unread,
                hidden_at = EXCLUDED.hidden_at,
                updated_at = NOW()
            RETURNING conversation_id, user_id, pinned, muted_until, marked_unread, hidden_at;
        `,
        [conversationId, userId, Boolean(pinned), mutedUntil, Boolean(markedUnread), hidden ? new Date() : null]
    );
    return rows[0];
};

const unhideConversationForUser = async (conversationId, userId) => {
    await pool.query(
        `
            UPDATE conversation_user_settings
            SET hidden_at = NULL, updated_at = NOW()
            WHERE conversation_id = $1
              AND user_id = $2
        `,
        [conversationId, userId]
    );
};

const unhideConversationForMembers = async (conversationId, senderId) => {
    await pool.query(
        `
            UPDATE conversation_user_settings
            SET hidden_at = NULL, updated_at = NOW()
            WHERE conversation_id = $1
              AND user_id <> $2
        `,
        [conversationId, senderId]
    );
};

const clearMarkedUnread = async (conversationId, userId) => {
    await pool.query(
        `
            UPDATE conversation_user_settings
            SET marked_unread = FALSE, updated_at = NOW()
            WHERE conversation_id = $1 AND user_id = $2
        `,
        [conversationId, userId]
    );
};

const isUserBlocked = async (userId1, userId2) => {
    const { rows } = await pool.query(
        `
            SELECT 1
            FROM blocked_users
            WHERE (blocker_id = $1 AND blocked_id = $2)
               OR (blocker_id = $2 AND blocked_id = $1)
            LIMIT 1;
        `,
        [userId1, userId2]
    );
    return rows.length > 0;
};

const setUserBlocked = async (blockerId, blockedId) => {
    const { rows } = await pool.query(
        `
            INSERT INTO blocked_users (blocker_id, blocked_id)
            VALUES ($1, $2)
            ON CONFLICT (blocker_id, blocked_id) DO NOTHING
            RETURNING blocker_id, blocked_id, created_at;
        `,
        [blockerId, blockedId]
    );
    return rows[0] || null;
};

const removeUserBlocked = async (blockerId, blockedId) => {
    const { rows } = await pool.query(
        `
            DELETE FROM blocked_users
            WHERE blocker_id = $1 AND blocked_id = $2
            RETURNING blocker_id, blocked_id;
        `,
        [blockerId, blockedId]
    );
    return rows[0] || null;
};

const createConversationReport = async (
    conversationId,
    reporterId,
    targetUserId,
    reason,
    details = null
) => {
    const { rows } = await pool.query(
        `
            INSERT INTO conversation_reports
                (conversation_id, reporter_id, target_user_id, reason, details)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, conversation_id, reporter_id, target_user_id, reason, details, created_at;
        `,
        [conversationId, reporterId, targetUserId, reason, details]
    );
    return rows[0];
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
                u.email,
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

const transferGroupOwnership = async (conversationId, currentOwnerId, targetUserId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const ownerResult = await client.query(
            `
                SELECT conversation_id, user_id, role, joined_at, left_at
                FROM conversation_members
                WHERE conversation_id = $1
                  AND user_id = $2
                  AND role = 'owner'
                  AND left_at IS NULL
                FOR UPDATE;
            `,
            [conversationId, currentOwnerId]
        );

        if (ownerResult.rowCount === 0) {
            throw new Error('Bạn không phải trưởng nhóm');
        }

        if (Number(currentOwnerId) === Number(targetUserId)) {
            throw new Error('Trưởng nhóm mới phải là thành viên khác');
        }

        const targetResult = await client.query(
            `
                SELECT conversation_id, user_id, role, joined_at, left_at
                FROM conversation_members
                WHERE conversation_id = $1
                  AND user_id = $2
                  AND left_at IS NULL
                FOR UPDATE;
            `,
            [conversationId, targetUserId]
        );

        if (targetResult.rowCount === 0) {
            throw new Error('Thành viên không tồn tại');
        }

        await client.query(
            `
                UPDATE conversation_members
                SET role = 'admin'
                WHERE conversation_id = $1
                  AND user_id = $2
                  AND role = 'owner'
                  AND left_at IS NULL;
            `,
            [conversationId, currentOwnerId]
        );

        const newOwnerResult = await client.query(
            `
                UPDATE conversation_members
                SET role = 'owner'
                WHERE conversation_id = $1
                  AND user_id = $2
                  AND left_at IS NULL
                RETURNING conversation_id, user_id, role, joined_at, left_at;
            `,
            [conversationId, targetUserId]
        );

        if (newOwnerResult.rowCount === 0) {
            throw new Error('Không thể chuyển quyền trưởng nhóm');
        }

        await client.query('COMMIT');

        return {
            previousOwner: {
                ...ownerResult.rows[0],
                role: 'admin'
            },
            newOwner: newOwnerResult.rows[0]
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
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
    transferGroupOwnership,
    removeMember,
    getConversationMemberIds,
    getConversationContactIds,
    updateGroupConversation,
    createGroupConversation,
    getConversationSettings,
    updateConversationSettings,
    clearMarkedUnread,
    unhideConversationForMembers,
    unhideConversationForUser,
    isUserBlocked,
    setUserBlocked,
    removeUserBlocked,
    createConversationReport
};
