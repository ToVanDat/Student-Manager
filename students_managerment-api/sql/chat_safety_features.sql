-- Chat safety tables required by conversationRepository.js
-- Run once in PostgreSQL / DBeaver.

CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id
    ON blocked_users(blocked_id);

CREATE TABLE IF NOT EXISTS conversation_reports (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(32) NOT NULL
        CHECK (reason IN ('spam', 'harassment', 'scam', 'inappropriate', 'other')),
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_reports_conversation_id
    ON conversation_reports(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_reports_reporter_id
    ON conversation_reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_conversation_reports_target_user_id
    ON conversation_reports(target_user_id);
