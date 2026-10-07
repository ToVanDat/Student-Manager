-- Chat feature migration: reply + reactions + message indexes
-- Run this once against the Student Management PostgreSQL database.

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS reply_to_message_id BIGINT
        REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages (conversation_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
    ON messages (reply_to_message_id);

CREATE TABLE IF NOT EXISTS message_reactions (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_reactions_user_emoji
    ON message_reactions (message_id, user_id, emoji);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
    ON message_reactions (message_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user
    ON message_reactions (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_deletions_message_user
    ON message_deletions (message_id, user_id);
