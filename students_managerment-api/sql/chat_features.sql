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

-- Messenger/Zalo style: one reaction per user per message.
-- If the migration is re-run after the old schema, keep the newest reaction.
DELETE FROM message_reactions a
USING message_reactions b
WHERE a.message_id = b.message_id
  AND a.user_id = b.user_id
  AND a.id < b.id;

DROP INDEX IF EXISTS uq_message_reactions_user_emoji;

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_reactions_message_user
    ON message_reactions (message_id, user_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
    ON message_reactions (message_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user
    ON message_reactions (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_deletions_message_user
    ON message_deletions (message_id, user_id);
