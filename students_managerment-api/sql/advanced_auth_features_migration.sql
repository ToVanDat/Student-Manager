-- Advanced authentication features: passkeys, linked Google identities, and one-time QR login.
-- Apply only to a disposable/test database first. This migration does not alter existing tables.
BEGIN;

CREATE TABLE IF NOT EXISTS user_webauthn_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0 CHECK (counter >= 0),
    transports TEXT[] NOT NULL DEFAULT '{}',
    device_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user
    ON user_webauthn_credentials(user_id);

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google')),
    provider_subject TEXT NOT NULL,
    provider_email TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_subject),
    UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user
    ON user_oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS qr_login_requests (
    id UUID PRIMARY KEY,
    request_secret_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'consumed', 'expired')),
    approved_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    approved_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_qr_login_pending_expiry
    ON qr_login_requests(expires_at) WHERE status = 'pending';

COMMIT;
