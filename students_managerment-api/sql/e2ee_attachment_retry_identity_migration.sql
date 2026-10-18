-- Additive retry identity for SDK-compatible E2EE media upload reservations.
-- Existing metadata rows remain readable; do not apply to production without backup/review.
ALTER TABLE e2ee_attachment_objects
    ADD COLUMN IF NOT EXISTS request_id TEXT,
    ADD COLUMN IF NOT EXISTS prepared_at BIGINT,
    ADD COLUMN IF NOT EXISTS ciphertext_sha256 BYTEA;

ALTER TABLE e2ee_attachment_objects
    ALTER COLUMN request_id TYPE TEXT USING request_id::text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_e2ee_attachment_upload_request
    ON e2ee_attachment_objects (uploaded_by, conversation_id, request_id, prepared_at)
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
