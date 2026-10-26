-- Additive retry identity for SDK-compatible E2EE media upload reservations.
-- Existing metadata rows remain readable; do not apply to production without backup/review.
-- Keep all DDL atomic so a failure cannot leave only part of the retry contract installed.
BEGIN;

DO $
BEGIN
    IF to_regclass('e2ee_attachment_objects') IS NULL THEN
        RAISE EXCEPTION 'Required table e2ee_attachment_objects is missing in the current search_path';
    END IF;
END $;

ALTER TABLE e2ee_attachment_objects
    ADD COLUMN IF NOT EXISTS request_id TEXT,
    ADD COLUMN IF NOT EXISTS prepared_at BIGINT,
    ADD COLUMN IF NOT EXISTS ciphertext_sha256 BYTEA;

ALTER TABLE e2ee_attachment_objects
    ALTER COLUMN request_id TYPE TEXT USING request_id::text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_e2ee_attachment_upload_request
    ON e2ee_attachment_objects (uploaded_by, conversation_id, request_id, prepared_at)
    WHERE request_id IS NOT NULL AND prepared_at IS NOT NULL;

-- SDK request IDs are scoped to the authenticated account, not to a conversation.
-- This prevents the same immutable preparation from reserving objects in two chats.
CREATE UNIQUE INDEX IF NOT EXISTS uq_e2ee_attachment_upload_request_global
    ON e2ee_attachment_objects (uploaded_by, request_id, prepared_at)
    WHERE request_id IS NOT NULL AND prepared_at IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'e2ee_attachment_sha256_length_check'
          AND conrelid = 'e2ee_attachment_objects'::regclass
    ) THEN
        ALTER TABLE e2ee_attachment_objects
            ADD CONSTRAINT e2ee_attachment_sha256_length_check
            CHECK (ciphertext_sha256 IS NULL OR octet_length(ciphertext_sha256) = 32);
    END IF;
END $$;

ALTER TABLE e2ee_attachment_objects
    ADD COLUMN IF NOT EXISTS read_capability_digest BYTEA;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'e2ee_attachment_read_capability_digest_length_check'
          AND conrelid = 'e2ee_attachment_objects'::regclass
    ) THEN
        ALTER TABLE e2ee_attachment_objects
            ADD CONSTRAINT e2ee_attachment_read_capability_digest_length_check
            CHECK (read_capability_digest IS NULL OR octet_length(read_capability_digest) = 32);
    END IF;
END $$;

COMMIT;

-- Read-only verification of the additive retry identity contract.
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'e2ee_attachment_objects'
  AND column_name IN (
      'request_id', 'prepared_at', 'ciphertext_sha256',
      'read_capability_digest'
  )
ORDER BY column_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'e2ee_attachment_objects'
  AND indexname IN (
      'uq_e2ee_attachment_upload_request',
      'uq_e2ee_attachment_upload_request_global'
  )
ORDER BY indexname;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = to_regclass('e2ee_attachment_objects')
  AND conname IN (
      'e2ee_attachment_sha256_length_check',
      'e2ee_attachment_read_capability_digest_length_check'
  )
ORDER BY conname;
