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

const listUsersForAdmin = async (search = '') => {
    const term = String(search || '').trim();
    const { rows } = await pool.query(
        `SELECT id, username, email, role, is_active, created_at, updated_at
         FROM users
         WHERE ($1 = '' OR username ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
         ORDER BY created_at DESC, id DESC
         LIMIT 200`,
        [term]
    );
    return rows;
};

const updateUserAccess = async (userId, role, isActive, actorId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Serialize role/status changes so two concurrent requests cannot both demote the last admins.
        await client.query('SELECT pg_advisory_xact_lock($1)', [784221]);
        const target = await client.query(
            'SELECT id, role, is_active FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        if (!target.rowCount) {
            await client.query('ROLLBACK');
            return { kind: 'not_found' };
        }
        const current = target.rows[0];
        if (Number(userId) === Number(actorId) && (role !== current.role || isActive !== current.is_active)) {
            await client.query('ROLLBACK');
            return { kind: 'self_change' };
        }
        if (current.role === 'admin' && (role !== 'admin' || isActive === false) && current.is_active) {
            const admins = await client.query(
                "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = TRUE"
            );
            if (admins.rows[0].count <= 1) {
                await client.query('ROLLBACK');
                return { kind: 'last_admin' };
            }
        }
        const updated = await client.query(
            `UPDATE users
             SET role = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id, username, email, role, is_active, created_at, updated_at`,
            [role, isActive, userId]
        );

        // Any role or account-status change invalidates every existing login.
        // Revoke DB sessions and refresh tokens in the same transaction as the
        // permission update, so a later Redis/Socket.IO outage cannot preserve
        // an authorization path.
        const accessChanged = role !== current.role || isActive !== current.is_active;
        let revokedSessionIds = [];
        if (accessChanged) {
            const revokedSessions = await client.query(
                `UPDATE sessions
                 SET revoked_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1
                   AND revoked_at IS NULL
                 RETURNING id`,
                [userId]
            );
            await client.query(
                `UPDATE refresh_tokens
                 SET revoked_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1
                   AND revoked_at IS NULL`,
                [userId]
            );
            revokedSessionIds = revokedSessions.rows.map((row) => row.id);
        }

        await client.query('COMMIT');
        return { kind: 'ok', user: updated.rows[0], revokedSessionIds };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    searchUsersForChat,
    listUsersForAdmin,
    updateUserAccess,
    findActiveUserById,
    updateLastSeenAt
};
