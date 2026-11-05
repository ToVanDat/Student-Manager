-- Face MFA policy and authenticated-session assurance.
-- This migration is intentionally manual; review the target schema before applying.
-- Existing accounts remain opted out. Existing sessions are not upgraded to MFA.

BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS require_face_mfa BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS face_mfa_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.require_face_mfa IS
    'When true, every non-face primary sign-in must complete application Face MFA before a session is issued.';

COMMENT ON COLUMN public.sessions.face_mfa_verified_at IS
    'Server timestamp proving the application Face MFA step was completed for this session. NULL means no Face MFA assurance.';

COMMIT;
