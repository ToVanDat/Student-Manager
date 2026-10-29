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
            avatar_url,
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
            avatar_url,
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
            avatar_url,
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
            avatar_url,
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

// Update the credential and revoke every existing session in one transaction.
// This prevents a password change from succeeding while old refresh credentials
// remain active because a later revocation query failed.
const updatePasswordAndRevokeSessions = async (userId, passwordHash) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const updatedUser = await client.query(
            `
            UPDATE users
            SET password_hash = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
              AND is_active = TRUE
            RETURNING id, username, email, role, is_active, updated_at
            `,
            [passwordHash, userId]
        );

        if (updatedUser.rowCount !== 1) {
            await client.query('ROLLBACK');
            return null;
        }

        const revokedSessions = await client.query(
            `
            UPDATE sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
              AND revoked_at IS NULL
            RETURNING id
            `,
            [userId]
        );

        await client.query(
            `
            UPDATE refresh_tokens
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
              AND revoked_at IS NULL
            `,
            [userId]
        );

        await client.query('COMMIT');

        return {
            user: updatedUser.rows[0],
            revokedSessionIds: revokedSessions.rows.map(row => row.id)
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


// Consume a verified password-reset token, update the password, and revoke all
// existing sessions/refresh tokens as one PostgreSQL transaction.
const completePasswordResetAndRevokeSessions = async (resetTokenId, userId, passwordHash) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const resetToken = await client.query(
            `
            SELECT id
            FROM password_reset_tokens
            WHERE id = $1
              AND user_id = $2
              AND used_at IS NULL
              AND verified_at IS NOT NULL
              AND expires_at > CURRENT_TIMESTAMP
            FOR UPDATE
            `,
            [resetTokenId, userId]
        );

        if (resetToken.rowCount !== 1) {
            await client.query('ROLLBACK');
            return null;
        }

        const consumed = await client.query(
            `
            UPDATE password_reset_tokens
            SET used_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND used_at IS NULL
              AND verified_at IS NOT NULL
              AND expires_at > CURRENT_TIMESTAMP
            RETURNING id
            `,
            [resetTokenId]
        );

        if (consumed.rowCount !== 1) {
            await client.query('ROLLBACK');
            return null;
        }

        const updatedUser = await client.query(
            `
            UPDATE users
            SET password_hash = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
              AND is_active = TRUE
            RETURNING id, username, email, role, is_active, updated_at
            `,
            [passwordHash, userId]
        );

        if (updatedUser.rowCount !== 1) {
            await client.query('ROLLBACK');
            return null;
        }

        const revokedSessions = await client.query(
            `
            UPDATE sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
              AND revoked_at IS NULL
            RETURNING id
            `,
            [userId]
        );

        await client.query(
            `
            UPDATE refresh_tokens
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
              AND revoked_at IS NULL
            `,
            [userId]
        );

        await client.query('COMMIT');

        return {
            user: updatedUser.rows[0],
            revokedSessionIds: revokedSessions.rows.map(row => row.id)
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
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

// Login-session creation must re-check account state in the same SQL statement
// that inserts the session. A stale user object from an earlier credential
// verification must not create a session after the account has been disabled.
const createSessionForActiveUser = async (
    userId,
    deviceName = null,
    userAgent = null,
    ipAddress = null
) => {
    const sessionId = crypto.randomUUID();
    const result = await pool.query(
        `
        WITH active_user AS (
            SELECT id
            FROM users
            WHERE id = $2
              AND is_active = TRUE
            FOR UPDATE
        )
        INSERT INTO sessions (
            id, user_id, device_name, user_agent, ip_address
        )
        SELECT $1, id, $3, $4, $5
        FROM active_user
        RETURNING *
        `,
        [sessionId, userId, deviceName, userAgent, ipAddress]
    );
    return result.rows[0] || null;
};

// Password login must re-check the exact password hash that was verified
// before issuing a session. If a password change wins the race, the stale
// password verification cannot create a fresh session afterward.
const createSessionForVerifiedPassword = async (
    userId,
    expectedPasswordHash,
    deviceName = null,
    userAgent = null,
    ipAddress = null
) => {
    if (typeof expectedPasswordHash !== 'string' || !expectedPasswordHash) {
        return null;
    }

    const sessionId = crypto.randomUUID();
    const result = await pool.query(
        `
        WITH active_user AS (
            SELECT id
            FROM users
            WHERE id = $2
              AND is_active = TRUE
              AND password_hash = $6
            FOR UPDATE
        )
        INSERT INTO sessions (
            id, user_id, device_name, user_agent, ip_address
        )
        SELECT $1, id, $3, $4, $5
        FROM active_user
        RETURNING *
        `,
        [sessionId, userId, deviceName, userAgent, ipAddress, expectedPasswordHash]
    );
    return result.rows[0] || null;
};

// Face Login session issuance additionally locks and re-checks the active face
// credential. Lock order is users -> user_face_credentials, matching enrollment
// and disable operations so concurrent changes serialize consistently.
const createSessionForActiveFaceUser = async (
    userId,
    deviceName = null,
    userAgent = null,
    ipAddress = null,
    expectedCredentialId = null
) => {
    if (typeof expectedCredentialId !== 'string' || !expectedCredentialId) return null;
    const sessionId = crypto.randomUUID();
    const result = await pool.query(
        `
        WITH active_user AS (
            SELECT id
            FROM users
            WHERE id = $2
              AND is_active = TRUE
            FOR UPDATE
        ),
        active_face_credential AS (
            SELECT credential.user_id
            FROM user_face_credentials AS credential
            INNER JOIN active_user AS account ON account.id = credential.user_id
            WHERE credential.id = $6
              AND credential.disabled_at IS NULL
            FOR UPDATE OF credential
        )
        INSERT INTO sessions (
            id, user_id, device_name, user_agent, ip_address
        )
        SELECT $1, account.id, $3, $4, $5
        FROM active_user AS account
        INNER JOIN active_face_credential AS face ON face.user_id = account.id
        RETURNING *
        `,
        [sessionId, userId, deviceName, userAgent, ipAddress, expectedCredentialId]
    );
    return result.rows[0] || null;
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


const revokeOtherSessionsAndRefreshTokens = async (userId, currentSessionId) => {
    const result = await pool.query(
        `WITH revoked_sessions AS (
             UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL
             RETURNING id
         ),
         revoked_tokens AS (
             UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP
             WHERE session_id IN (SELECT id FROM revoked_sessions)
               AND revoked_at IS NULL
             RETURNING session_id
         )
         SELECT id FROM revoked_sessions`,
        [userId, currentSessionId]
    );
    return result.rows;
};

const revokeSessionForUserAndRefreshTokens = async (sessionId, userId) => {
    const result = await pool.query(
        `WITH revoked_session AS (
             UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
             RETURNING id, user_id, revoked_at
         ),
         revoked_tokens AS (
             UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP
             WHERE session_id IN (SELECT id FROM revoked_session)
               AND revoked_at IS NULL
             RETURNING session_id
         )
         SELECT id, user_id, revoked_at FROM revoked_session`,
        [sessionId, userId]
    );
    return result.rows[0] || null;
};

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



// Find a historical refresh token by its hash. Used only to distinguish
// a replayed token from a completely unknown/expired token; never returns
// the raw token value.
const findRefreshTokenByHash = async (tokenHash) => {
    const result = await pool.query(
        `
        SELECT id, user_id, session_id, expires_at, revoked_at, created_at
        FROM refresh_tokens
        WHERE token_hash = $1
        LIMIT 1
        `,
        [tokenHash]
    );

    return result.rows[0] || null;
};

// Revoke the session (the refresh-token family) when a previously rotated,
// still-unexpired token is presented again. Lock order matches rotation and
// credential-change transactions: session first, refresh_tokens second.
const revokeSessionOnRefreshTokenReuse = async (tokenHash, userId, sessionId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const session = await client.query(
            `
            SELECT id
            FROM sessions
            WHERE id = $1
              AND user_id = $2
              AND revoked_at IS NULL
            FOR UPDATE
            `,
            [sessionId, userId]
        );

        if (session.rowCount !== 1) {
            await client.query('ROLLBACK');
            return null;
        }

        const replayedToken = await client.query(
            `
            SELECT id
            FROM refresh_tokens
            WHERE token_hash = $1
              AND user_id = $2
              AND session_id = $3
              AND revoked_at IS NOT NULL
              AND expires_at > CURRENT_TIMESTAMP
            FOR UPDATE
            `,
            [tokenHash, userId, sessionId]
        );

        if (replayedToken.rowCount !== 1) {
            await client.query('ROLLBACK');
            return null;
        }

        const revokedSession = await client.query(
            `
            UPDATE sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND user_id = $2
              AND revoked_at IS NULL
            RETURNING id
            `,
            [sessionId, userId]
        );

        await client.query(
            `
            UPDATE refresh_tokens
            SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
            WHERE session_id = $1
              AND user_id = $2
            `,
            [sessionId, userId]
        );

        await client.query('COMMIT');
        return revokedSession.rows[0] || null;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
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

        // Lock the session first. Password changes/resets revoke sessions
        // before refresh tokens, so using the same lock order avoids a
        // session<->refresh-token deadlock during concurrent refresh/revoke.
        const activeSession = await client.query(
            `
            SELECT id
            FROM sessions
            WHERE id = $1
              AND user_id = $2
              AND revoked_at IS NULL
            FOR UPDATE
            `,
            [sessionId, userId]
        );

        if (activeSession.rowCount !== 1) {
            await client.query('ROLLBACK');
            return null;
        }

        // Consume the presented token only after owning the session lock.
        // Concurrent refreshes still race on this conditional update and
        // exactly one request can rotate the same token.
        const consumed = await client.query(
            `
            UPDATE refresh_tokens
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND user_id = $2
              AND session_id = $3
              AND revoked_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
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

        await client.query(
            `
            UPDATE sessions
            SET last_used_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND user_id = $2
            `,
            [sessionId, userId]
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
// Atomically bind the one-time reset token and consume OTP verification.
// A concurrent correct-OTP request cannot overwrite the reset token after another request succeeds.
const saveVerifiedPasswordResetToken = async (
    id,
    resetTokenHash
) => {
    const result = await pool.query(
        `
        UPDATE password_reset_tokens
        SET
            reset_token_hash = $1,
            verified_at = CURRENT_TIMESTAMP
        WHERE id = $2
          AND used_at IS NULL
          AND verified_at IS NULL
          AND attempt_count < 5
          AND expires_at > CURRENT_TIMESTAMP
        RETURNING
            id,
            user_id,
            reset_token_hash,
            verified_at
        `,
        [resetTokenHash, id]
    );

    return result.rows[0] || null;
};

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
              AND attempt_count < 5
              AND used_at IS NULL
              AND verified_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
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
          AND verified_at IS NOT NULL
          AND expires_at > CURRENT_TIMESTAMP
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
          AND verified_at IS NULL
          AND attempt_count < 5
          AND expires_at > CURRENT_TIMESTAMP
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
    updatePasswordAndRevokeSessions,
    completePasswordResetAndRevokeSessions,
    


    // ==================================================
    // SESSION
    // ==================================================

    createSession,
    createSessionForActiveUser,
    createSessionForVerifiedPassword,
    createSessionForActiveFaceUser,

    findSessionsByUserId,

    findSessionByIdAndUserId,

    updateSessionLastUsed,

    revokeSession,
    revokeSessionForUserAndRefreshTokens,
    revokeOtherSessionsAndRefreshTokens,

    revokeRefreshTokensBySessionId,

    revokeAllSessions,


    // ==================================================
    // REFRESH TOKEN
    // ==================================================

    saveRefreshToken,

    rotateRefreshToken,

    findRefreshToken,
    findRefreshTokenByHash,
    revokeSessionOnRefreshTokenReuse,

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

    markPasswordResetVerified,

    saveVerifiedPasswordResetToken

};