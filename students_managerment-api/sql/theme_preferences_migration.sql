-- Idempotent migration for account-level User Theme and per-user Chat Theme.
-- The application tables already exist; this file only adds/repairs theme columns and checks.
-- Run against the application's PostgreSQL database.

BEGIN;

-- 1. User Theme: light, dark, or follow the operating system.
ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS theme VARCHAR(10) NOT NULL DEFAULT 'system';

ALTER TABLE public.user_preferences
    DROP CONSTRAINT IF EXISTS user_preferences_theme_check;

UPDATE public.user_preferences
SET theme = 'system'
WHERE theme IS NULL
   OR theme NOT IN ('light', 'dark', 'system');

ALTER TABLE public.user_preferences
    ALTER COLUMN theme SET DEFAULT 'system';

ALTER TABLE public.user_preferences
    ALTER COLUMN theme SET NOT NULL;

ALTER TABLE public.user_preferences
    ADD CONSTRAINT user_preferences_theme_check
    CHECK (theme IN ('light', 'dark', 'system'));

-- 2. Chat Theme: personal appearance per conversation and user.
ALTER TABLE public.conversation_user_settings
    ADD COLUMN IF NOT EXISTS chat_theme VARCHAR(24) NOT NULL DEFAULT 'default';

ALTER TABLE public.conversation_user_settings
    DROP CONSTRAINT IF EXISTS conversation_user_settings_chat_theme_check;

UPDATE public.conversation_user_settings
SET chat_theme = 'default'
WHERE chat_theme IS NULL
   OR chat_theme NOT IN ('default', 'ocean', 'lavender', 'mint', 'rose', 'amber');

ALTER TABLE public.conversation_user_settings
    ALTER COLUMN chat_theme SET DEFAULT 'default';

ALTER TABLE public.conversation_user_settings
    ALTER COLUMN chat_theme SET NOT NULL;

ALTER TABLE public.conversation_user_settings
    ADD CONSTRAINT conversation_user_settings_chat_theme_check
    CHECK (chat_theme IN ('default', 'ocean', 'lavender', 'mint', 'rose', 'amber'));

COMMIT;

-- Verification: both columns should appear in the result.
SELECT
    table_name,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
      (table_name = 'user_preferences' AND column_name = 'theme')
      OR
      (table_name = 'conversation_user_settings' AND column_name = 'chat_theme')
  )
ORDER BY table_name, column_name;

-- Verification: both named CHECK constraints should appear in the result.
SELECT
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname IN (
    'user_preferences_theme_check',
    'conversation_user_settings_chat_theme_check'
)
ORDER BY conrelid::regclass::text;
