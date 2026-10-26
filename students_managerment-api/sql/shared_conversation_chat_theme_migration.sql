-- Shared Chat Theme: one theme per conversation, visible to every active member.
-- Safe to run once after reviewing the backfill preview below.
-- Existing per-user themes may differ. The most recently updated preference wins;
-- ties are resolved by the lowest user_id. Original per-user rows are retained.

BEGIN;

ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS chat_theme VARCHAR(24) NOT NULL DEFAULT 'default';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'conversations_chat_theme_check'
          AND conrelid = 'public.conversations'::regclass
    ) THEN
        ALTER TABLE public.conversations
            ADD CONSTRAINT conversations_chat_theme_check
            CHECK (chat_theme IN ('default', 'ocean', 'lavender', 'mint', 'rose', 'amber'));
    END IF;
END $$;

WITH ranked_preferences AS (
    SELECT
        cus.conversation_id,
        cus.chat_theme,
        ROW_NUMBER() OVER (
            PARTITION BY cus.conversation_id
            ORDER BY cus.updated_at DESC NULLS LAST, cus.user_id ASC
        ) AS preference_rank
    FROM public.conversation_user_settings cus
    JOIN public.conversations c ON c.id = cus.conversation_id
    WHERE cus.chat_theme IN ('default', 'ocean', 'lavender', 'mint', 'rose', 'amber')
)
UPDATE public.conversations c
SET chat_theme = rp.chat_theme
FROM ranked_preferences rp
WHERE rp.conversation_id = c.id
  AND rp.preference_rank = 1;

COMMIT;

-- Verify shared theme column and valid values.
SELECT id AS conversation_id, chat_theme, updated_at
FROM public.conversations
ORDER BY id;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.conversations'::regclass
  AND conname = 'conversations_chat_theme_check';
