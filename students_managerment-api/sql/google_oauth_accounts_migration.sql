-- Google account linking only.
-- Additive migration: does not alter users, passwords, roles, or existing records.
-- Apply to the intended database only after a backup and schema check.
BEGIN;

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google')),
    provider_subject TEXT NOT NULL,
    provider_email TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_oauth_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uq_user_oauth_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user
    ON user_oauth_accounts(user_id);

COMMIT;
