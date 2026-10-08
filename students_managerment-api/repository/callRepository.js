const pool = require('../src/config/database');

const createCall = async ({
    callId,
    callerId,
    receiverId,
    conversationId = null,
    callType
}) => {
    const { rows } = await pool.query(
        `
        INSERT INTO call_history
            (call_id, caller_id, receiver_id, conversation_id, call_type, status)
        VALUES ($1, $2, $3, $4, $5, 'ringing')
        ON CONFLICT (call_id) DO NOTHING
        RETURNING *;
        `,
        [callId, callerId, receiverId, conversationId, callType]
    );
    return rows[0] || null;
};

const getCallByIdForParticipant = async (callId, userId, targetUserId = null) => {
    const params = [callId, userId];
    let targetClause = '';
    if (targetUserId !== null) {
        params.push(targetUserId);
        targetClause = ' AND ((caller_id = $2 AND receiver_id = $3) OR (caller_id = $3 AND receiver_id = $2))';
    } else {
        targetClause = ' AND (caller_id = $2 OR receiver_id = $2)';
    }

    const { rows } = await pool.query(
        `
        SELECT *
        FROM call_history
        WHERE call_id = $1
          ${targetClause}
        LIMIT 1;
        `,
        params
    );

    return rows[0] || null;
};


const updateCallStatusIfCurrent = async (
    callId,
    status,
    expectedStatus,
    reason = null,
    answered = false
) => {
    const { rows } = await pool.query(
        `
        UPDATE call_history
        SET status = $2::text,
            end_reason = COALESCE($4::text, end_reason),
            answered_at = CASE
                WHEN $5 = TRUE AND answered_at IS NULL THEN NOW()
                ELSE answered_at
            END,
            ended_at = CASE
                WHEN $2::text IN ('rejected','missed','cancelled','failed','timeout','completed')
                    THEN COALESCE(ended_at, NOW())
                ELSE ended_at
            END,
            duration_seconds = CASE
                WHEN $2::text = 'completed' AND answered_at IS NOT NULL
                    THEN GREATEST(
                        0,
                        FLOOR(EXTRACT(EPOCH FROM (
                            COALESCE(ended_at, NOW()) - answered_at
                        )))::INT
                    )
                ELSE duration_seconds
            END,
            updated_at = NOW()
        WHERE call_id = $1
          AND status = $3::text
        RETURNING *;
        `,
        [callId, status, expectedStatus, reason, Boolean(answered)]
    );
    return rows[0] || null;
};

const updateCallStatus = async (callId, status, reason = null, answered = false) => {
    const { rows } = await pool.query(
        `
        UPDATE call_history
        SET status = $2::text,
            end_reason = COALESCE($3::text, end_reason),
            answered_at = CASE
                WHEN $4 = TRUE AND answered_at IS NULL THEN NOW()
                ELSE answered_at
            END,
            ended_at = CASE
                WHEN $2::text IN ('rejected','missed','cancelled','failed','timeout')
                    THEN COALESCE(ended_at, NOW())
                WHEN $2::text = 'completed'
                    THEN COALESCE(ended_at, NOW())
                ELSE ended_at
            END,
            duration_seconds = CASE
                WHEN $2::text = 'completed' AND answered_at IS NOT NULL
                    THEN GREATEST(
                        0,
                        FLOOR(EXTRACT(EPOCH FROM (
                            COALESCE(ended_at, NOW()) - answered_at
                        )))::INT
                    )
                ELSE duration_seconds
            END,
            updated_at = NOW()
        WHERE call_id = $1
        RETURNING *;
        `,
        [callId, status, reason, Boolean(answered)]
    );
    return rows[0] || null;
};

const getActiveCallsForParticipant = async (userId) => {
    const { rows } = await pool.query(
        `
        SELECT *
        FROM call_history
        WHERE (caller_id = $1 OR receiver_id = $1)
          AND status IN ('ringing', 'connecting', 'connected')
          AND ended_at IS NULL
        ORDER BY started_at DESC;
        `,
        [userId]
    );
    return rows;
};

const getCallHistory = async (userId, limit = 50, offset = 0, conversationId = null) => {
    const { rows } = await pool.query(
        `
        SELECT
            ch.*,
            caller.username AS caller_username,
            receiver.username AS receiver_username
        FROM call_history ch
        JOIN users caller ON caller.id = ch.caller_id
        JOIN users receiver ON receiver.id = ch.receiver_id
        WHERE (ch.caller_id = $1 OR ch.receiver_id = $1)
          AND ($4::BIGINT IS NULL OR ch.conversation_id = $4)
        ORDER BY ch.started_at DESC
        LIMIT $2 OFFSET $3;
        `,
        [userId, limit, offset, conversationId]
    );
    return rows;
};

const createCallNotification = async (userId, callHistoryId, type, title, body = null) => {
    const { rows } = await pool.query(
        `
        INSERT INTO call_notifications
            (user_id, call_history_id, type, title, body)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
        `,
        [userId, callHistoryId, type, title, body]
    );
    return rows[0];
};

const getUnreadCallNotifications = async (userId, limit = 50) => {
    const { rows } = await pool.query(
        `
        SELECT *
        FROM call_notifications
        WHERE user_id = $1 AND is_read = FALSE
        ORDER BY created_at DESC
        LIMIT $2;
        `,
        [userId, limit]
    );
    return rows;
};

const markCallNotificationRead = async (notificationId, userId) => {
    const { rows } = await pool.query(
        `
        UPDATE call_notifications
        SET is_read = TRUE
        WHERE id = $1 AND user_id = $2
        RETURNING *;
        `,
        [notificationId, userId]
    );
    return rows[0] || null;
};

module.exports = {
    createCall,
    updateCallStatus,
    getCallHistory,
    createCallNotification,
    getUnreadCallNotifications,
    markCallNotificationRead,
    getCallByIdForParticipant,
    updateCallStatusIfCurrent,
    getActiveCallsForParticipant
};
