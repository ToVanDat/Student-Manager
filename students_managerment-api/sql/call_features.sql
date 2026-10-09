-- Production call features: timeout, call history, missed calls, and recovery metadata.

CREATE TABLE IF NOT EXISTS call_history (
    id BIGSERIAL PRIMARY KEY,
    call_id VARCHAR(128) NOT NULL UNIQUE,
    caller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL,
    call_type VARCHAR(16) NOT NULL CHECK (call_type IN ('voice', 'video')),
    status VARCHAR(24) NOT NULL CHECK (
        status IN (
            'ringing',
            'connecting',
            'connected',
            'completed',
            'rejected',
            'missed',
            'cancelled',
            'failed',
            'timeout'
        )
    ),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    end_reason VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_history_caller_started
    ON call_history (caller_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_history_receiver_started
    ON call_history (receiver_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_history_conversation_started
    ON call_history (conversation_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_history_status
    ON call_history (status);

-- Persisted deadline used for reconnect recovery and race-safe acceptance.
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_call_history_ringing_expiry
    ON call_history (status, expires_at) WHERE status = 'ringing';

CREATE TABLE IF NOT EXISTS call_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    call_history_id BIGINT REFERENCES call_history(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_notifications_user_created
    ON call_notifications (user_id, created_at DESC);

-- Per-user call history hiding. A user can hide a call only from their own history.
CREATE TABLE IF NOT EXISTS call_history_hidden (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    call_history_id BIGINT NOT NULL REFERENCES call_history(id) ON DELETE CASCADE,
    hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, call_history_id)
);

CREATE INDEX IF NOT EXISTS idx_call_history_hidden_call
    ON call_history_hidden (call_history_id);
