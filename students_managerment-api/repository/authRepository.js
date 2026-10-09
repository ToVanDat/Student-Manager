const crypto = require('crypto');
const pool = require('../src/config/database.js');


// ======================================================
// USER
// ======================================================

// ======================================================
// FIND USER BY ID WITH PASSWORD
// ======================================================

const findUserByIdWithPassword = async (userId) => {

    const result = await pool.query(
        `
        SELECT
            id,
            username,
            email,
            password_hash,
            role,
            is_active,
            created_at,
            updated_at
        FROM users
        WHERE id = $1
        `,
        [
            userId
        ]
    );

    return result.rows[0] || null;
};
// ======================================================
// FIND USER BY ID
// ======================================================

const findUserById = async (userId) => {

    const result = await pool.query(
        `
        SELECT
            id,
            username,
            email,
            role,
            is_active,
            created_at,
            updated_at
        FROM users
        WHERE id = $1
        `,
        [
            userId
        ]
    );

    return result.rows[0];
};


// ======================================================
// FIND USER BY USERNAME
// ======================================================

const findUserByUsername = async (username) => {

    const result = await pool.query(
        `
        SELECT
            id,
            username,
            email,
            password_hash,
            role,
            is_active
        FROM users
        WHERE username = $1
        `,
        [
            username
        ]
    );

    return result.rows[0];
};


// ======================================================
// FIND USER BY EMAIL
// ======================================================

const findUserByEmail = async (email) => {

    const result = await pool.query(
        `
        SELECT
            id,
            username,
            email,
            password_hash,
            role,
            is_active
        FROM users
        WHERE email = $1
        `,
        [
            email
        ]
    );

    return result.rows[0];
};


// ======================================================
// FIND USER BY USERNAME EXCEPT CURRENT USER
// ======================================================

const findUserByUsernameExceptId = async (
    username,
    userId
) => {

    const result = await pool.query(
        `
        SELECT
            id,
            username,
            email,
            role,
            is_active
        FROM users
        WHERE username = $1
          AND id <> $2
        `,
        [
            username,
            userId
        ]
    );

    return result.rows[0] || null;
};


// ======================================================
// FIND USER BY EMAIL EXCEPT CURRENT USER
// ======================================================

const findUserByEmailExceptId = async (
    email,
    userId
) => {

    const result = await pool.query(
        `
        SELECT
            id,
            username,
            email,
            role,
            is_active
        FROM users
        WHERE email = $1
          AND id <> $2
        `,
        [
            email,
            userId
        ]
    );

    return result.rows[0] || null;
};


// ======================================================
// CREATE USER
// ======================================================

const createUser = async (
    username,
    email,
    passwordHash,
    role = 'user'
) => {

    const result = await pool.query(
        `
        INSERT INTO users (
            username,
            email,
            password_hash,
            role
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            id,
            username,
            email,
            role,
            is_active,
            created_at
        `,
        [
            username,
            email,
            passwordHash,
            role
        ]
    );

    return result.rows[0];
};


// ======================================================
// UPDATE USER PROFILE
// username + email
// ======================================================

const updateUserProfile = async (
    userId,
    username,
    email
) => {

    const result = await pool.query(
        `
        UPDATE users
        SET
            username = $1,
            email = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING
            id,
            username,
            email,
            role,
            is_active,
            created_at,
            updated_at
        `,
        [
            username,
            email,
            userId
        ]
    );

    return result.rows[0] || null;
};


// ======================================================
// UPDATE USER PASSWORD
// ======================================================

const updateUserPassword = async (
    userId,
    passwordHash
) => {

    const result = await pool.query(
        `
        UPDATE users
        SET
            password_hash = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING
            id,
            username,
            email,
            role,
            is_active,
            updated_at
        `,
        [
            passwordHash,
            userId
        ]
    );

    return result.rows[0] || null;
};



// ======================================================
// SESSION
// ======================================================


// ======================================================
// CREATE SESSION
// ======================================================

const createSession = async (
    userId,
    deviceName = null,
    userAgent = null,
    ipAddress = null
) => {

    const sessionId = crypto.randomUUID();

    const result = await pool.query(
        `
        INSERT INTO sessions (
            id,
            user_id,
            device_name,
            user_agent,
            ip_address
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
            sessionId,
            userId,
            deviceName,
            userAgent,
            ipAddress
        ]
    );

    return result.rows[0];
};


// ======================================================
// FIND ALL SESSIONS BY USER ID
// ======================================================

const findSessionsByUserId = async (
    userId
) => {

    const result = await pool.query(
        `
        SELECT
            id,
            user_id,
            device_name,
            user_agent,
            ip_address,
            created_at,
            last_used_at,
            revoked_at
        FROM sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [
            userId
        ]
    );

    return result.rows;
};


// ======================================================
// FIND SESSION BY ID + USER ID
// ======================================================

const findSessionByIdAndUserId = async (
    sessionId,
    userId
) => {

    const result = await pool.query(
        `
        SELECT
            id,
            user_id,
            device_name,
            user_agent,
            ip_address,
            created_at,
            last_used_at,
            revoked_at
        FROM sessions
        WHERE id = $1
          AND user_id = $2
        `,
        [
            sessionId,
            userId
        ]
    );

    return result.rows[0] || null;
};


// ======================================================
// UPDATE SESSION LAST USED
// ======================================================

const updateSessionLastUsed = async (
    sessionId
) => {

    const result = await pool.query(
        `
        UPDATE sessions
        SET
            last_used_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
        `,
        [
            sessionId
        ]
    );

    return result.rows[0] || null;
};


// ======================================================
// REVOKE ONE SESSION
// ======================================================

const revokeSession = async (
    sessionId
) => {

    const result = await pool.query(
        `
        UPDATE sessions
        SET
            revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND revoked_at IS NULL
        RETURNING *
        `,
        [
            sessionId
        ]
    );

    return result.rows[0] || null;
};


const revokeAllSessions = async (userId) => {
    const query = `
        UPDATE sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND revoked_at IS NULL
        RETURNING id;
    `;

    const result = await pool.query(query, [userId]);

    return result.rows;
};
// ======================================================
// REVOKE ALL REFRESH TOKENS OF SESSION
// ======================================================

const revokeRefreshTokensBySessionId = async (
    sessionId
) => {

    const result = await pool.query(
        `
        UPDATE refresh_tokens
        SET
            revoked_at = CURRENT_TIMESTAMP
        WHERE session_id = $1
          AND revoked_at IS NULL
        RETURNING
            id,
            user_id,
            session_id,
            revoked_at
        `,
        [
            sessionId
        ]
    );

    return result.rows;
};



// ======================================================
// REFRESH TOKEN
// ======================================================


// ======================================================
// SAVE REFRESH TOKEN
// ======================================================

const saveRefreshToken = async (
    userId,
    sessionId,
    tokenHash,
    expiresAt
) => {

    const result = await pool.query(
        `
        INSERT INTO refresh_tokens (
            user_id,
            session_id,
            token_hash,
            expires_at
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
            userId,
            sessionId,
            tokenHash,
            expiresAt
        ]
    );

    return result.rows[0];
};


// ======================================================
// FIND REFRESH TOKEN
// ======================================================

const findRefreshToken = async (
    tokenHash
) => {

    const result = await pool.query(
        `
        SELECT
            id,
            user_id,
            session_id,
            token_hash,
            expires_at,
            revoked_at,
            created_at
        FROM refresh_tokens
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        `,
        [
            tokenHash
        ]
    );

    return result.rows[0];
};



// Atomically consume one refresh token and issue its replacement.
// A concurrent refresh using the same token can win only once.
const rotateRefreshToken = async (
    oldTokenId,
    userId,
    sessionId,
    newTokenHash,
    expiresAt
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const consumed = await client.query(
            `
            UPDATE refresh_tokens
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND user_id = $2
              AND session_id = $3
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
              AND EXISTS (
                  SELECT 1
                  FROM sessions
                  WHERE id = $3
                    AND user_id = $2
                    AND revoked_at IS NULL
              )
            RETURNING id
            `,
            [oldTokenId, userId, sessionId]
        );

        if (consumed.rowCount !== 1) {
            await client.query('ROLLBACK');
            return null;
        }

        const inserted = await client.query(
            `
            INSERT INTO refresh_tokens (
                user_id,
                session_id,
                token_hash,
                expires_at
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, session_id, expires_at
            `,
            [userId, sessionId, newTokenHash, expiresAt]
        );

        await client.query('COMMIT');
        return inserted.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


// ======================================================
// REVOKE REFRESH TOKEN BY ID
// ======================================================

const revokeRefreshToken = async (
    tokenId
) => {

    const result = await pool.query(
        `
        UPDATE refresh_tokens
        SET
            revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND revoked_at IS NULL
        RETURNING
            id,
            user_id,
            session_id,
            revoked_at
        `,
        [
            tokenId
        ]
    );

    return result.rows[0];
};


// ======================================================
// REVOKE REFRESH TOKEN BY HASH
// ======================================================

const revokeRefreshTokenByHash = async (
    tokenHash
) => {

    const result = await pool.query(
        `
        UPDATE refresh_tokens
        SET
            revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = $1
          AND revoked_at IS NULL
        RETURNING
            id,
            user_id,
            session_id,
            revoked_at
        `,
        [
            tokenHash
        ]
    );

    return result.rows[0];
};
// vo hieu hoa otp cu 
const invalidatePasswordResetTokens = async (userId) => {
    await pool.query(
        `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        `,
        [userId]
    );
};

// tao password reset token
const createPasswordResetToken = async (
    userId,
    tokenHash,
    expiresAt
) => {
    const result = await pool.query(
        `
        INSERT INTO password_reset_tokens
        (
            user_id,
            token_hash,
            expires_at
        )
        VALUES ($1, $2, $3)
        RETURNING
            id,
            user_id,
            expires_at,
            created_at
        `,
        [
            userId,
            tokenHash,
            expiresAt
        ]
    );

    return result.rows[0];
};

const saveResetTokenHash = async (
    id,
    resetTokenHash
) => {

    const result = await pool.query(
        `
        UPDATE password_reset_tokens
        SET reset_token_hash = $1
        WHERE id = $2
        RETURNING
            id,
            user_id,
            reset_token_hash,
            verified_at
        `,
        [
            resetTokenHash,
            id
        ]
    );

    return result.rows[0] || null;
};


// tim password reset token
const findActivePasswordResetToken = async (
    userId
) => {

    const result =
        await pool.query(
            `
            SELECT
                id,
                user_id,
                token_hash,
                expires_at,
                used_at,
                attempt_count,
                created_at
            FROM password_reset_tokens
            WHERE user_id = $1
              AND used_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [userId]
        );

    return result.rows[0];
};
// tang so lan reset mat khau
const incrementPasswordResetAttempt = async (
    tokenId
) => {

    const result =
        await pool.query(
            `
            UPDATE password_reset_tokens
            SET attempt_count = attempt_count + 1
            WHERE id = $1
            RETURNING
                id,
                attempt_count
            `,
            [tokenId]
        );

    return result.rows[0];
};

const findPasswordResetByHash = async (
    resetTokenHash
) => {

    const result = await pool.query(
        `
        SELECT
            id,
            user_id,
            reset_token_hash,
            expires_at,
            verified_at,
            used_at
        FROM password_reset_tokens
        WHERE reset_token_hash = $1
        LIMIT 1
        `,
        [resetTokenHash]
    );

    return result.rows[0] || null;
};

const markPasswordResetUsed = async (
    id
) => {

    const result = await pool.query(
        `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND used_at IS NULL
        RETURNING id, used_at
        `,
        [id]
    );

    return result.rows[0] || null;
};

// mark password reset verified
const markPasswordResetVerified = async (
    id
) => {

    const result = await pool.query(
        `
        UPDATE password_reset_tokens
        SET verified_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND used_at IS NULL
        RETURNING
            id,
            user_id,
            verified_at
        `,
        [id]
    );

    return result.rows[0] || null;
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {

    // ==================================================
    // USER
    // ==================================================

    findUserById,

    findUserByUsername,

    findUserByEmail,

    findUserByUsernameExceptId,

    findUserByEmailExceptId,

    createUser,

    updateUserProfile,

    updateUserPassword,
    


    // ==================================================
    // SESSION
    // ==================================================

    createSession,

    findSessionsByUserId,

    findSessionByIdAndUserId,

    updateSessionLastUsed,

    revokeSession,

    revokeRefreshTokensBySessionId,

    revokeAllSessions,


    // ==================================================
    // REFRESH TOKEN
    // ==================================================

    saveRefreshToken,

    rotateRefreshToken,

    findRefreshToken,

    revokeRefreshToken,

    revokeRefreshTokenByHash,
    
    findUserByIdWithPassword,

    //  otp

    invalidatePasswordResetTokens,

    createPasswordResetToken,

    findActivePasswordResetToken,
    
    incrementPasswordResetAttempt,

    findPasswordResetByHash,

    markPasswordResetUsed,

    saveResetTokenHash,

    markPasswordResetVerified

};