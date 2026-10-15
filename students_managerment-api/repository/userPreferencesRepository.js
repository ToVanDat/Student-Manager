const pool = require('../src/config/database.js');

const getByUserId = async (userId) => {
    const result = await pool.query(
        `INSERT INTO user_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
    );

    const preferences = await pool.query(
        `SELECT user_id, preferred_language, theme, created_at, updated_at
         FROM user_preferences
         WHERE user_id = $1`,
        [userId]
    );
    return preferences.rows[0];
};

const updateByUserId = async (userId, patch) => {
    // Apply only fields supplied by the client in one atomic statement.
    // This prevents concurrent language/theme updates from overwriting each other.
    const language = patch.preferredLanguage ?? null;
    const theme = patch.theme ?? null;

    const result = await pool.query(
        `INSERT INTO user_preferences (user_id, preferred_language, theme)
         VALUES ($1, COALESCE($2::VARCHAR(5), 'vi'), COALESCE($3::VARCHAR(10), 'system'))
         ON CONFLICT (user_id) DO UPDATE
         SET preferred_language = COALESCE($2::VARCHAR(5), user_preferences.preferred_language),
             theme = COALESCE($3::VARCHAR(10), user_preferences.theme),
             updated_at = CURRENT_TIMESTAMP
         RETURNING user_id, preferred_language, theme, created_at, updated_at`,
        [userId, language, theme]
    );
    return result.rows[0];
};

module.exports = { getByUserId, updateByUserId };
