# Face Login foundation — audit and implementation plan

## Scope and status

This branch is a reviewable foundation, not a production-ready biometric login. The migration is intentionally not executed. Face Login must remain unavailable until model selection, server-side verification, key management, and integration tests are complete.

## Repository audit (feature/chat-1to1-complete)

- API mounts `authRouter` at `/api/auth`.
- Existing authentication routes include password login/refresh/logout, Google login/linking, Passkeys/WebAuthn, and QR login. Reuse the existing auth/session issuance flow rather than implementing a second session system.
- `users` already identifies accounts; `sessions` tracks sessions and revocation metadata.
- The submitted public-schema inventory did not show an explicitly named face/biometric table or matching columns.
- Frontend dependencies include `@simplewebauthn/browser`; no MediaPipe or TensorFlow.js dependencies were found in the inspected package manifest.
- The application has a camera Permissions-Policy allowance, but that alone does not implement camera capture or biometric authentication.

## Data handling

The accompanying SQL migration creates `user_face_credentials` with encrypted template bytes, a key version, model/version metadata, status and lifecycle timestamps. It does not store images. The encryption key must be held outside PostgreSQL (e.g. a managed secret/KMS), and encryption/decryption must be implemented and reviewed before this migration is run. The partial unique index allows at most one active credential per user while retaining revoked records for audit. Verify PostgreSQL version/extensions and compare against the live schema before applying.

## Required architecture before enabling login

1. Select a browser-compatible face embedding model and verify its license for the intended use. MediaPipe Face Landmarker provides landmarks/blendshapes, not identity embeddings by itself.
2. Implement explicit enrollment only after the user has authenticated using an existing method and confirmed intent.
3. Use a fresh, short-lived, server-issued challenge; bind the challenge to the account/session and consume it once. Add rate limiting and replay protection.
4. Treat browser-side match/liveness booleans as untrusted. A browser-only matcher can be bypassed by a modified client. Define an independently verifiable server-side decision/proof before issuing a session.
5. Implement liveness with documented threat assumptions; movement/blink checks alone are not robust anti-spoofing.
6. On success, issue sessions through the existing authentication service. Do not create a parallel JWT/cookie format.
7. Provide credential revoke/delete, audit events without biometric values, fallback login, and a retention/consent policy.
8. Never log, return, or include face images/templates in analytics/errors.

## Proposed API shape (not implemented in this foundation)

- `POST /api/auth/face/enrollment/challenge` — authenticated user only.
- `POST /api/auth/face/enrollment/complete` — authenticated user only, explicit confirmation, challenge consumed once.
- `POST /api/auth/face/login/challenge` — rate-limited, short-lived challenge.
- `POST /api/auth/face/login/verify` — server validates challenge/proof and only then reuses existing session issuance.
- `GET /api/auth/face/credential` and `DELETE /api/auth/face/credential` — authenticated management/revocation.

Do not add these routes until the verification trust model is settled; a route accepting `faceMatched: true` would be insecure.

## Verification checklist

- Existing password, Google, Passkey and QR login remain unchanged.
- Enrollment requires an authenticated account and fresh challenge.
- Wrong account, expired/reused challenge, malformed template and revoked credential fail closed.
- Printed photo/video replay and camera denial do not silently fall back to success.
- Rate limits, session revocation, account-disabled state and cookie settings are enforced.
- Build/lint/API tests and two-account browser tests pass before merge.
- Migration is first tested on a disposable database backup and schema diff; it is not auto-run by this PR.
