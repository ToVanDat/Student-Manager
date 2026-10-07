-- Advanced presence + group chat migration
-- Run once against the Student Management PostgreSQL database.

-- =========================================================
-- 1. PRESENCE
-- =========================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NULL;

-- =========================================================
-- 2. CONVERSATION TYPE / GROUP METADATA
-- Existing projects already have conversations.type, so this
-- migration only adds the constraint when possible.
-- =========================================================

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'direct';

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS name VARCHAR(120) NULL;

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'conversations_type_check'
          AND conrelid = 'conversations'::regclass
    ) THEN
        ALTER TABLE conversations
            ADD CONSTRAINT conversations_type_check
            CHECK (type IN ('direct', 'group'));
    END IF;
END $$;

-- =========================================================
-- 3. GROUP MEMBER ROLE / LEAVE STATE
-- For direct conversations role remains NULL.
-- Group roles: owner / admin / member.
-- =========================================================

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
          AND conrelid = 'conversation_members'::regclass
    ) THEN
        ALTER TABLE conversation_members
            ADD CONSTRAINT conversation_members_role_check
            CHECK (role IS NULL OR role IN ('owner', 'admin', 'member'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_members_conversation_user
    ON conversation_members (conversation_id, user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_active
    ON conversation_members (user_id, conversation_id)
    WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_active
    ON conversation_members (conversation_id, user_id)
    WHERE left_at IS NULL;

-- Existing direct members have no group role.
UPDATE conversation_members cm
SET role = NULL
WHERE role IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM conversations c
      WHERE c.id = cm.conversation_id
        AND c.type = 'direct'
  );

-- Ensure direct conversations cannot accidentally become group-like
-- because of stale member role data.
UPDATE conversation_members cm
SET role = NULL
WHERE EXISTS (
    SELECT 1
    FROM conversations c
    WHERE c.id = cm.conversation_id
      AND c.type = 'direct'
);

-- =========================================================
-- 4. GROUP MESSAGE / CONVERSATION LOOKUP INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_conversations_type_updated
    ON conversations (type, updated_at DESC);
