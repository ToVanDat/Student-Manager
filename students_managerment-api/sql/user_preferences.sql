-- Account-level preferences are stored in PostgreSQL and synced across devices.
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'vi'
        CHECK (preferred_language IN ('vi', 'en')),
    theme VARCHAR(10) NOT NULL DEFAULT 'system'
        CHECK (theme IN ('light', 'dark', 'system')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_preferences IS 'Per-account UI preferences shared across devices';
