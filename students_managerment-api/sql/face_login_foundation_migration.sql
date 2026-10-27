-- Face Login foundation for Student Manager.
-- REVIEW ONLY: do not execute until the application encryption/key-management design is approved.
-- Store encrypted templates only; never store raw face images or plaintext embeddings here.
BEGIN;

CREATE TABLE IF NOT EXISTS user_face_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_ciphertext BYTEA NOT NULL,
    encryption_key_version VARCHAR(64) NOT NULL,
    embedding_model VARCHAR(128) NOT NULL,
    embedding_model_version VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
    enrolled_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITHOUT TIME ZONE,
    revoked_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT user_face_credentials_revocation_consistency
        CHECK (
            (status = 'active' AND revoked_at IS NULL)
            OR (status = 'revoked' AND revoked_at IS NOT NULL)
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_face_credentials_one_active
    ON user_face_credentials(user_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_face_credentials_user_status
    ON user_face_credentials(user_id, status);

COMMIT;
