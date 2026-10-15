-- User theme and personal per-conversation theme preferences.
-- Safe to run on databases where user_preferences and conversation_user_settings already exist.
ALTER TABLE user_preferences
    ALTER COLUMN theme SET DEFAULT 'system';

ALTER TABLE user_preferences
    DROP CONSTRAINT IF EXISTS user_preferences_theme_check;

ALTER TABLE user_preferences
    ADD CONSTRAINT user_preferences_theme_check
    CHECK (theme IN ('light', 'dark', 'system'));

ALTER TABLE conversation_user_settings
    ADD COLUMN IF NOT EXISTS chat_theme VARCHAR(24) NOT NULL DEFAULT 'default';

ALTER TABLE conversation_user_settings
    DROP CONSTRAINT IF EXISTS conversation_user_settings_chat_theme_check;

ALTER TABLE conversation_user_settings
    ADD CONSTRAINT conversation_user_settings_chat_theme_check
    CHECK (chat_theme IN ('default', 'ocean', 'lavender', 'mint', 'rose', 'amber'));
