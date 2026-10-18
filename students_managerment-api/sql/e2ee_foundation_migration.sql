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
    device_token_hash TEXT,
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

-- SDK relay mailbox, independent of the legacy messages table.
-- Each recipient device gets its own opaque envelope. A row is retained until
-- the recipient acknowledges it or the configured expiry policy removes it.
-- The legacy messages table is not used to persist E2EE plaintext or placeholders.
CREATE TABLE IF NOT EXISTS e2ee_relay_envelopes (
    id BIGSERIAL PRIMARY KEY,
    envelope_id TEXT NOT NULL,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_user_id BIGINT NOT NULL REFERENCES users(id),
    sender_device_pk BIGINT NOT NULL REFERENCES e2ee_devices(id) ON DELETE CASCADE,
    recipient_user_id BIGINT NOT NULL REFERENCES users(id),
    recipient_device_pk BIGINT NOT NULL REFERENCES e2ee_devices(id) ON DELETE CASCADE,
    client_message_id TEXT NOT NULL,
    protocol TEXT NOT NULL,
    message_type TEXT NOT NULL,
    content_kind TEXT NOT NULL DEFAULT 'message'
        CHECK (content_kind IN ('message', 'receipt')),
    ciphertext TEXT NOT NULL,
    client_timestamp_ms BIGINT,
    operation_epoch_ms BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    UNIQUE (recipient_device_pk, envelope_id)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_relay_mailbox_pending
    ON e2ee_relay_envelopes(recipient_device_pk, created_at, id)
    WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_e2ee_relay_conversation_timeline
    ON e2ee_relay_envelopes(conversation_id, client_timestamp_ms DESC);

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


-- SDK v11 numeric device slots and key inventory. Kept separate from the
-- earlier UUID device registry until an explicit compatibility migration is
-- reviewed; the SDK relay must never guess a numeric slot from a UUID.
CREATE TABLE IF NOT EXISTS e2ee_sdk_devices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id SMALLINT NOT NULL CHECK (device_id BETWEEN 1 AND 5),
    registration_id INTEGER NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'web'
        CHECK (device_type IN ('web', 'desktop', 'mobile', 'tablet')),
    encrypted_device_name TEXT,
    registered BOOLEAN NOT NULL DEFAULT TRUE,
    linked BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    identity_type TEXT NOT NULL DEFAULT 'aci' CHECK (identity_type IN ('aci', 'pni')),
    identity_public JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    UNIQUE (user_id, device_id),
    UNIQUE (user_id, device_id, identity_type)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_sdk_devices_active_user
    ON e2ee_sdk_devices(user_id, device_id)
    WHERE revoked_at IS NULL AND enabled = TRUE AND registered = TRUE;

CREATE TABLE IF NOT EXISTS e2ee_sdk_identities (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    identity_type TEXT NOT NULL DEFAULT 'aci' CHECK (identity_type IN ('aci', 'pni')),
    identity_public JSONB NOT NULL,
    identity_commitment TEXT,
    revision BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, identity_type)
);

ALTER TABLE e2ee_sdk_identities ADD COLUMN IF NOT EXISTS identity_commitment TEXT;

CREATE TABLE IF NOT EXISTS e2ee_sdk_prekeys (
    id BIGSERIAL PRIMARY KEY,
    device_pk BIGINT NOT NULL REFERENCES e2ee_sdk_devices(id) ON DELETE CASCADE,
    identity_type TEXT NOT NULL DEFAULT 'aci' CHECK (identity_type IN ('aci', 'pni')),
    key_type TEXT NOT NULL CHECK (key_type IN (
        'ecPreKey', 'ecSignedPreKey', 'kemOneTimePreKey', 'kemLastResortPreKey'
    )),
    key_id BIGINT NOT NULL,
    public_key TEXT NOT NULL,
    signature TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    UNIQUE (device_pk, identity_type, key_type, key_id)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_sdk_prekeys_available
    ON e2ee_sdk_prekeys(device_pk, identity_type, key_type, key_id)
    WHERE claimed_at IS NULL;

CREATE TABLE IF NOT EXISTS e2ee_sdk_envelopes (
    id UUID PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_device_pk BIGINT NOT NULL REFERENCES e2ee_sdk_devices(id) ON DELETE CASCADE,
    recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_device_pk BIGINT NOT NULL REFERENCES e2ee_sdk_devices(id) ON DELETE CASCADE,
    client_message_id UUID NOT NULL,
    ciphertext TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN (
        'ciphertext', 'prekey_bundle', 'sender_key', 'unidentified_sender', 'retry_request'
    )),
    delivery_class TEXT NOT NULL CHECK (delivery_class IN (
        'user-visible', 'background-sync', 'ephemeral'
    )),
    content_kind TEXT NOT NULL DEFAULT 'message' CHECK (content_kind IN ('message', 'receipt')),
    client_timestamp_ms BIGINT NOT NULL,
    operation_epoch_ms BIGINT,
    recipient_registration_id INTEGER,
    server_timestamp_ms BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT,
    delivered_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    UNIQUE (sender_user_id, client_message_id, recipient_device_pk)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_sdk_envelopes_mailbox
    ON e2ee_sdk_envelopes(recipient_device_pk, server_timestamp_ms, id)
    WHERE acknowledged_at IS NULL;


CREATE TABLE IF NOT EXISTS e2ee_sdk_provisioning_sessions (
    session_id UUID PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_ephemeral_public_key TEXT NOT NULL,
    new_device_ephemeral_public_key TEXT,
    new_device_metadata JSONB,
    encrypted_message TEXT,
    encrypted_device_name TEXT,
    assigned_device_id SMALLINT,
    status TEXT NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'connected', 'ready', 'linked_pending_ack', 'completed', 'rolled_back', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_e2ee_sdk_provisioning_owner
    ON e2ee_sdk_provisioning_sessions(owner_user_id, created_at DESC);

COMMIT;
