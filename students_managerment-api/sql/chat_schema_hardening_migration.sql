-- Additive hardening for chat/group schema after one reviewed base migration
-- from each overlapping family has been selected and applied.
-- This migration never deletes or rewrites existing application rows.
BEGIN;

DO $migration$
DECLARE
    invalid_count bigint;
BEGIN
    IF to_regclass(format('%I.%I', current_schema(), 'conversations')) IS NULL
       OR to_regclass(format('%I.%I', current_schema(), 'conversation_members')) IS NULL
       OR to_regclass(format('%I.%I', current_schema(), 'conversation_reports')) IS NULL THEN
        RAISE EXCEPTION 'Chat schema prerequisites are missing: conversations, conversation_members and conversation_reports are required';
    END IF;

    SELECT COUNT(*) INTO invalid_count
    FROM conversations
    WHERE type IS NULL OR type NOT IN ('direct', 'group');
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Chat schema hardening stopped: % conversations have unsupported type values; review rows before retrying', invalid_count;
    END IF;

    SELECT COUNT(*) INTO invalid_count
    FROM conversation_members
    WHERE role IS NOT NULL AND role NOT IN ('owner', 'admin', 'member');
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Chat schema hardening stopped: % conversation_members rows have unsupported role values; review rows before retrying', invalid_count;
    END IF;

    SELECT COUNT(*) INTO invalid_count
    FROM conversation_reports
    WHERE reason IS NULL OR reason NOT IN ('spam', 'harassment', 'scam', 'inappropriate', 'other');
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Chat schema hardening stopped: % conversation_reports rows have unsupported reason values; review rows before retrying', invalid_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'conversations'::regclass
          AND conname = 'conversations_type_allowed_values_v2_check'
    ) THEN
        ALTER TABLE conversations
            ADD CONSTRAINT conversations_type_allowed_values_v2_check
            CHECK (type IN ('direct', 'group')) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'conversation_members'::regclass
          AND conname = 'conversation_members_role_allowed_values_v2_check'
    ) THEN
        ALTER TABLE conversation_members
            ADD CONSTRAINT conversation_members_role_allowed_values_v2_check
            CHECK (role IS NULL OR role IN ('owner', 'admin', 'member')) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'conversation_reports'::regclass
          AND conname = 'conversation_reports_reason_allowed_values_v2_check'
    ) THEN
        ALTER TABLE conversation_reports
            ADD CONSTRAINT conversation_reports_reason_allowed_values_v2_check
            CHECK (reason IN ('spam', 'harassment', 'scam', 'inappropriate', 'other')) NOT VALID;
    END IF;
END
$migration$;

ALTER TABLE conversations
    VALIDATE CONSTRAINT conversations_type_allowed_values_v2_check;
ALTER TABLE conversation_members
    VALIDATE CONSTRAINT conversation_members_role_allowed_values_v2_check;
ALTER TABLE conversation_reports
    VALIDATE CONSTRAINT conversation_reports_reason_allowed_values_v2_check;

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_active_v2
    ON conversation_members (user_id, conversation_id)
    WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_active_v2
    ON conversation_members (conversation_id, user_id)
    WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_reports_conversation_created_v2
    ON conversation_reports (conversation_id, created_at DESC);

COMMIT;
