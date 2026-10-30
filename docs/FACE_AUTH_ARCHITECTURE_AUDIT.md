# Face Authentication Architecture Audit

Date: 2026-10-27
Branch: `feature/chat-1to1-complete`
Scope: repository inspection only; no database was queried or changed.

## Executive decision

The existing feature is **WebAuthn Passkey / device verification**, not application-owned face recognition. Keep it as the preferred device-authentication mechanism and fallback. Do not label it "Face Login".

A separate camera-based face recognition feature is not implemented. Do not create its API or database migration until a licensed recognition model, PAD approach, data lifecycle, and threat model have been approved.

## Repository evidence

Inspected:

- `students_management-frontend/src/components/settings/AdvancedSecurityMethods.jsx`
- `students_management-frontend/src/api/authApi.js`
- `students_managerment-api/router/authRouter.js`
- `students_managerment-api/controller/advancedAuthController.js`
- `students_managerment-api/service/advancedAuthService.js`
- `students_managerment-api/middleware/biometricAuthRateLimiter.js`
- `students_managerment-api/sql/advanced_auth_features_migration.sql`
- `students_managerment-api/service/accessTokenStore.js`

Verified current behavior:

1. The browser calls `navigator.credentials.create()` / `navigator.credentials.get()`; no camera capture or face image upload is part of this flow.
2. Backend registration and assertion verification use `@simplewebauthn/server`.
3. Registration requires authenticated account context and `userVerification: required`.
4. Challenges are stored in Redis for 300 seconds. `consumeChallenge()` uses a Redis Lua GET+DEL operation, making consumption atomic and one-time.
5. WebAuthn credential records store credential ID, public key, counter, transports and device metadata in `user_webauthn_credentials`.
6. Credential deletion is scoped by both credential row ID and authenticated user ID.
7. Successful passkey verification calls the shared `issueSession()` path and issues the existing access-token / refresh-cookie session.
8. The public key is not a face template and is not a secret. Application-level AES-256-GCM encryption of this public key is not required for confidentiality.

## Corrections applied

- Settings UI now names this feature **Passkey (WebAuthn)** and explains that Face ID / Windows Hello / fingerprint / PIN prompts are controlled by the operating system or authenticator. Student Manager does not receive biometric samples in this flow.
- Status metadata now reports `passkey-webauthn`, not a claim that the device selected a biometric modality.
- The legacy biometric-login rate-limit message now says Passkey.
- `issueSession()` now uses the shared `accessTokenStore` helper. Previously this advanced-auth path wrote only `access_token:{hash}` and did not add the token to `session_access_tokens:{sessionId}`; it now follows the session-indexed cleanup convention used by the normal auth flow.
- No route was removed and no database migration was applied.

## Face Recognition design decision

### Recognition pipeline

Recommended browser-first prototype pipeline:

1. Camera capture in React, with explicit consent and camera permission handling.
2. MediaPipe Tasks Vision Face Landmarker for face presence, landmarks, alignment signals and UI guidance. It is not a face identity recognition model.
3. ONNX Runtime Web to run a separately licensed face embedding model. Prefer WebAssembly CPU fallback and optional WebGPU acceleration.
4. Generate a normalized embedding from a quality-checked, aligned face crop.
5. Compare enrollment and login embeddings using cosine similarity with a threshold selected from measured false-match / false-non-match testing. Do not copy a threshold from a paper or demo.
6. Send a short-lived, one-time server challenge and verification evidence to the backend. Do not accept a client-supplied boolean such as `liveness: true` as proof.

MediaPipe landmarks/blendshapes are useful for geometry and interaction, but do not by themselves prove liveness or identity.

### Model licensing gate

Do not automatically adopt InsightFace `buffalo_*` / `antelopev2` pretrained packs for a deployable project: InsightFace states that its code is MIT but its distributed pretrained models are for non-commercial research unless separately licensed.

MobileFaceNet is a plausible lightweight architecture for browser inference, but the architecture name alone does not grant rights to any checkpoint. A Qualcomm AI Hub MobileFaceNet model page identifies an Apache-2.0 model license and describes a 112x112 input / 128-dimensional embedding; the exact downloadable artifact, training-data rights, redistribution terms and model card still need to be pinned and reviewed before committing weights to the repository. Treat it as a candidate, not an approved final model.

### PAD / liveness gate

A production-capable design needs a dedicated PAD model and documented attack evaluation. Face landmarks, blink detection, smile detection or a fixed "turn left/right" sequence alone are not sufficient: they can be replayed or automated.

For the prototype, evaluate a layered approach:

- Passive PAD model on a short sequence of frames.
- Randomized, server-issued active challenge (for example, randomly selected head-pose / gaze actions), bound to one account and one-time nonce.
- Frame quality and temporal consistency checks.
- Replay / screen presentation / printed photo / mask test cases.
- Consider camera injection and modified-client attacks: browser-side checks can be patched by an attacker. For meaningful assurance, PAD and matching should be verified in a trusted server-side component or the flow must explicitly remain a low-assurance convenience feature.

NIST SP 800-63B-4 says facial recognition SHALL implement PAD, requires an alternative non-biometric option, and treats biometric data as sensitive personal information. It also specifies measurable false-match and attack-presentation performance targets. ISO/IEC 30107-3:2023 defines PAD testing and reporting; it does not prescribe one universal liveness algorithm.

## Credential and data protection policy

For future Face Recognition credentials:

- Do not store raw enrollment photos or video after feature extraction unless a separately justified, consented use case requires it.
- Treat embeddings as sensitive biometric data, not as passwords and not as irreversibly anonymous identifiers.
- If server-side matching is chosen, encrypt the embedding with AES-256-GCM using a random 96-bit nonce, 128-bit authentication tag, key version / key ID, and authenticated additional data binding at least the user ID, credential ID, and schema version.
- Keep encryption keys outside PostgreSQL and backups; use a dedicated secret/KMS-managed key with rotation and access logging. Never store the key beside ciphertext.
- Define deletion, re-enrollment, account closure, backup-retention and key-rotation behavior before adding a table.
- Avoid logging frames, embeddings, plaintext payloads, or cryptographic keys.

For the existing WebAuthn records, the public key is intentionally public. Protect database access, backups and integrity; do not confuse it with a private biometric template.

## Backend and session integration

A future Face Verification API must not mint tokens directly from the browser. It should:

1. Create a short-lived server challenge bound to the target account and purpose.
2. Consume the challenge atomically exactly once.
3. Verify PAD and embedding comparison under server-controlled policy.
4. Enforce per-account / per-IP rate limits, cooldowns and generic failure messages.
5. On success, call the shared session issuance service and shared access-token store; issue the same HttpOnly refresh cookie and normal access token as other login methods.
6. Preserve password login and WebAuthn as recovery/fallback methods.
7. Revoke a face credential independently from a user's WebAuthn passkeys and active sessions.

## Enrollment Stepper contract

Do not render a Face Enrollment Stepper as operational until the actual camera/model/API flow exists. When implemented, use:

1. Prerequisites and consent.
2. Camera permission and camera quality.
3. Face quality / PAD / embedding capture.
4. Backend challenge verification and credential persistence.
5. Completion, with retry and a clear failure reason.

Each step must retain prior state on Back, prevent skipping mandatory checks, and show loading/success/error/retry. Mobile uses a compact progress bar.

## Remaining audit risks / work before API implementation

- Passkey deletion currently requires an authenticated session but does not perform a fresh step-up authentication. Consider requiring recent reauthentication before credential removal.
- Review whether deleting the last passkey should be allowed when the user has no password or other recovery method.
- Keep the legacy `/biometric-login/*` route for compatibility for now; it is a WebAuthn alias, not a face-matching API.
- Define trusted-client / sensor assumptions and assess camera injection. Browser-only model execution cannot establish a trustworthy sensor path by itself.
- Select a specific recognition and PAD artifact only after its exact weights and licenses are verified.
- Establish evaluation data collected with informed consent and measure FMR/FNMR and PAD attack acceptance across representative lighting, devices and demographic groups.

## Verification status

Repository files were inspected and changes were written to the branch. No local build, browser test, API integration test, live Redis/PostgreSQL check, or database migration was run as part of this audit.
