-- Additive, backwards-compatible state for temporarily pausing new E2EE messages.
-- Existing E2EE settings remain in place; key/device/envelope/history data is untouched.
ALTER TABLE conversation_e2ee_settings
    ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paused_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'conversation_e2ee_settings_mode_check'
          AND conrelid = 'public.conversation_e2ee_settings'::regclass
    ) THEN
        ALTER TABLE conversation_e2ee_settings
            ADD CONSTRAINT conversation_e2ee_settings_mode_check
            CHECK (mode IN ('active', 'paused'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversation_e2ee_settings_mode
    ON conversation_e2ee_settings (mode);
