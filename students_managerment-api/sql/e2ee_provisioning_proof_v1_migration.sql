-- Additive, opt-in E2EE provisioning proof v1 fields.
-- Legacy v11 sessions remain NULL/legacy until the patched SDK explicitly requests v1.
-- Do not apply to production until schema drift, backup, deployment order and rollback are reviewed.
BEGIN;

DO $$
BEGIN
    IF to_regclass('public.e2ee_sdk_provisioning_sessions') IS NULL THEN
        RAISE EXCEPTION 'Required table public.e2ee_sdk_provisioning_sessions is missing';
    END IF;
END $$;

ALTER TABLE e2ee_sdk_provisioning_sessions
    ADD COLUMN IF NOT EXISTS proof_protocol_version SMALLINT,
    ADD COLUMN IF NOT EXISTS proof_challenge BYTEA,
    ADD COLUMN IF NOT EXISTS proof_commitment BYTEA,
    ADD COLUMN IF NOT EXISTS proof_ciphertext_digest BYTEA,
    ADD COLUMN IF NOT EXISTS proof_consumed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS proof_ack_digest BYTEA;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'e2ee_provisioning_proof_protocol_version_check'
          AND conrelid = 'public.e2ee_sdk_provisioning_sessions'::regclass
    ) THEN
        ALTER TABLE e2ee_sdk_provisioning_sessions
            ADD CONSTRAINT e2ee_provisioning_proof_protocol_version_check
            CHECK (proof_protocol_version IS NULL OR proof_protocol_version = 1);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'e2ee_provisioning_proof_challenge_length_check'
          AND conrelid = 'public.e2ee_sdk_provisioning_sessions'::regclass
    ) THEN
        ALTER TABLE e2ee_sdk_provisioning_sessions
            ADD CONSTRAINT e2ee_provisioning_proof_challenge_length_check
            CHECK (proof_challenge IS NULL OR octet_length(proof_challenge) = 32);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'e2ee_provisioning_proof_commitment_length_check'
          AND conrelid = 'public.e2ee_sdk_provisioning_sessions'::regclass
    ) THEN
        ALTER TABLE e2ee_sdk_provisioning_sessions
            ADD CONSTRAINT e2ee_provisioning_proof_commitment_length_check
            CHECK (proof_commitment IS NULL OR octet_length(proof_commitment) = 32);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'e2ee_provisioning_proof_ciphertext_digest_length_check'
          AND conrelid = 'public.e2ee_sdk_provisioning_sessions'::regclass
    ) THEN
        ALTER TABLE e2ee_sdk_provisioning_sessions
            ADD CONSTRAINT e2ee_provisioning_proof_ciphertext_digest_length_check
            CHECK (proof_ciphertext_digest IS NULL OR octet_length(proof_ciphertext_digest) = 32);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'e2ee_provisioning_proof_ack_digest_length_check'
          AND conrelid = 'public.e2ee_sdk_provisioning_sessions'::regclass
    ) THEN
        ALTER TABLE e2ee_sdk_provisioning_sessions
            ADD CONSTRAINT e2ee_provisioning_proof_ack_digest_length_check
            CHECK (proof_ack_digest IS NULL OR octet_length(proof_ack_digest) = 32);
    END IF;
END $$;

-- A proof-enabled session is either fully initialized for ACK or still waiting
-- for its challenge/commitment; partially populated records cannot be activated.
CREATE INDEX IF NOT EXISTS idx_e2ee_provisioning_proof_pending
    ON e2ee_sdk_provisioning_sessions(owner_user_id, expires_at)
    WHERE proof_protocol_version = 1 AND status IN ('connected', 'ready', 'linked_pending_ack');

COMMIT;

-- Read-only verification. No data rows are selected.
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'e2ee_sdk_provisioning_sessions'
  AND column_name IN (
      'proof_protocol_version', 'proof_challenge', 'proof_commitment',
      'proof_ciphertext_digest', 'proof_consumed_at', 'proof_ack_digest'
  )
ORDER BY column_name;
