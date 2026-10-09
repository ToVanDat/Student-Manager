const pool = require('../src/config/database');

const searchUsersForChat = async (currentUserId, search = '') => {
    const normalizedSearch = String(search || '').trim();

    const query = `
        SELECT
            id,
            username,
            avatar_url AS avatar
        FROM users
        WHERE id <> $1
          AND is_active = TRUE
          AND (
              $2 = ''
              OR username ILIKE '%' || $2 || '%'
              OR email ILIKE '%' || $2 || '%'
          )
        ORDER BY username ASC
        LIMIT 20;
    `;

    const { rows } = await pool.query(query, [
        currentUserId,
        normalizedSearch
    ]);

    return rows;
};

const findActiveUserById = async (userId) => {
    const { rows } = await pool.query(
        `
            SELECT id, username, avatar_url AS avatar
            FROM users
            WHERE id = $1
              AND is_active = TRUE
            LIMIT 1;
        `,
        [userId]
    );

    return rows[0] || null;
};


const updateLastSeenAt = async (userId) => {
    const { rows } = await pool.query(
        `
            UPDATE users
            SET last_seen_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id, last_seen_at;
        `,
        [userId]
    );

    return rows[0] || null;
};

module.exports = {
    searchUsersForChat,
    findActiveUserById,
    updateLastSeenAt
};
