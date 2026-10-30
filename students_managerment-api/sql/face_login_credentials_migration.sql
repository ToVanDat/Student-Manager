-- Face Login credential storage.
-- The encrypted template is an AES-256-GCM envelope; raw camera frames are never stored.
-- Apply manually after reviewing the migration against the target database.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_face_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ciphertext BYTEA NOT NULL,
    nonce BYTEA NOT NULL CHECK (octet_length(nonce) = 12),
    auth_tag BYTEA NOT NULL CHECK (octet_length(auth_tag) = 16),
    key_version SMALLINT NOT NULL CHECK (key_version > 0),
    model_id TEXT NOT NULL,
    model_version TEXT NOT NULL,
    template_format TEXT NOT NULL DEFAULT 'float32-128',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id),
    CHECK (octet_length(ciphertext) > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_face_credentials_active
    ON public.user_face_credentials(user_id)
    WHERE disabled_at IS NULL;

COMMIT;
