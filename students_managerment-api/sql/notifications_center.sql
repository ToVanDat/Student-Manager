-- Persistent in-app notification history. Run after profile_notifications_push.sql.
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL DEFAULT 'message',
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
    message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_notification_preferences
    ADD COLUMN IF NOT EXISTS preview_mode VARCHAR(20) NOT NULL DEFAULT 'content';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_notification_preferences_preview_mode_check'
    ) THEN
        ALTER TABLE user_notification_preferences
            ADD CONSTRAINT user_notification_preferences_preview_mode_check
            CHECK (preview_mode IN ('content', 'sender', 'hidden'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, created_at DESC)
    WHERE is_read = FALSE;
