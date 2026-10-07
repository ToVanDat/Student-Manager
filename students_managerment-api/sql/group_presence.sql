-- Advanced presence + group chat migration
-- Run once against the Student Management PostgreSQL database.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NULL;

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS name VARCHAR(120) NULL;

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'direct';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'conversations_type_check'
    ) THEN
        ALTER TABLE conversations
            ADD CONSTRAINT conversations_type_check
            CHECK (type IN ('direct', 'group'));
    END IF;
END $$;

ALTER TABLE conversation_members
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NULL;

ALTER TABLE conversation_members
    ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'conversation_members_role_check'
    ) THEN
        ALTER TABLE conversation_members
            ADD CONSTRAINT conversation_members_role_check
            CHECK (role IS NULL OR role IN ('owner', 'admin', 'member'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_members_conversation_user
    ON conversation_members (conversation_id, user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
    ON conversation_members (user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
    ON conversation_members (conversation_id);

CREATE INDEX IF NOT EXISTS idx_users_last_seen_at
    ON users (last_seen_at);
