-- Additive E2EE ciphertext object metadata for the Cloudflare R2 broker.
-- Object bytes and filenames are never stored in PostgreSQL. Apply only after
-- validating this additive migration against a disposable copy of the target schema.
BEGIN;

CREATE TABLE IF NOT EXISTS e2ee_attachment_objects (
    id UUID PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    object_key UUID NOT NULL UNIQUE,
    ciphertext_size BIGINT NOT NULL CHECK (ciphertext_size > 0 AND ciphertext_size <= 524288000),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'uploaded', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    uploaded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_e2ee_attachment_objects_conversation
    ON e2ee_attachment_objects(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_e2ee_attachment_objects_pending_expiry
    ON e2ee_attachment_objects(expires_at)
    WHERE status = 'pending';

COMMIT;
