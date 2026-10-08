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
