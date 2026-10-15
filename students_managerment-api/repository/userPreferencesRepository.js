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
    const current = await getByUserId(userId);
    const language = patch.preferredLanguage ?? current.preferred_language;
    const theme = patch.theme ?? current.theme;

    const result = await pool.query(
        `INSERT INTO user_preferences (user_id, preferred_language, theme)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET preferred_language = EXCLUDED.preferred_language,
             theme = EXCLUDED.theme,
             updated_at = CURRENT_TIMESTAMP
         RETURNING user_id, preferred_language, theme, created_at, updated_at`,
        [userId, language, theme]
    );
    return result.rows[0];
};

module.exports = { getByUserId, updateByUserId };
