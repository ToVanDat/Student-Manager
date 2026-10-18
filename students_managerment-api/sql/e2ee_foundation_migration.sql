-- Additive E2EE foundation for Student-Manager.
-- Apply only after reviewing this migration against the deployed PostgreSQL schema.
-- This migration intentionally preserves existing messages and conversations.
BEGIN;

CREATE TABLE IF NOT EXISTS e2ee_devices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL,
    device_name TEXT NOT NULL DEFAULT 'Browser device',
    identity_key_public TEXT NOT NULL,
    signed_prekey_public TEXT NOT NULL,
    signed_prekey_signature TEXT NOT NULL,
    signed_prekey_id BIGINT NOT NULL,
    registration_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    UNIQUE (user_id, device_id),
    UNIQUE (user_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_devices_active_user
    ON e2ee_devices(user_id, last_seen_at DESC)
    WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS e2ee_one_time_prekeys (
    id BIGSERIAL PRIMARY KEY,
    device_pk BIGINT NOT NULL REFERENCES e2ee_devices(id) ON DELETE CASCADE,
    prekey_id BIGINT NOT NULL,
    public_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMPTZ,
    UNIQUE (device_pk, prekey_id)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_prekeys_available
    ON e2ee_one_time_prekeys(device_pk, prekey_id)
    WHERE claimed_at IS NULL;

-- Store a separate ciphertext envelope for every recipient device.
-- Never store private/identity/session keys in PostgreSQL.
CREATE TABLE IF NOT EXISTS message_e2ee_envelopes (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_device_pk BIGINT NOT NULL REFERENCES e2ee_devices(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL,
    envelope_version SMALLINT NOT NULL DEFAULT 1,
    ciphertext TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (message_id, recipient_device_pk)
);

CREATE INDEX IF NOT EXISTS idx_message_e2ee_envelopes_message
    ON message_e2ee_envelopes(message_id);

-- Keep E2EE activation separate from conversations to avoid altering the
-- existing conversation schema and to preserve legacy plaintext history.
CREATE TABLE IF NOT EXISTS conversation_e2ee_settings (
    conversation_id BIGINT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL,
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enabled_by BIGINT NOT NULL REFERENCES users(id),
    mode TEXT NOT NULL DEFAULT 'direct' CHECK (mode IN ('direct', 'group')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
