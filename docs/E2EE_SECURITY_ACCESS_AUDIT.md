# E2EE Security Access Audit

**Repository:** `ToVanDat/Student-Manager`  
**Branch:** `feature/chat-1to1-complete`  
**Audit date:** 2026-10-26  
**Scope:** Express routes, device-auth middleware, E2EE relay services/repositories, provisioning, encrypted attachment service and R2 Worker.  
**Method:** Static code review of the branch and automated CI evidence. This is not a penetration test or live deployment verification.

## 1. Summary

A concrete prekey access weakness was found and mitigated: the authenticated prekey-bundle endpoint previously passed `requesterId` to the service but did not use it before the repository claimed one-time prekeys for the target device. The service now requires an existing direct conversation for cross-account bundle retrieval; a user's own linked devices remain eligible. Regression tests cover both paths.

The mitigation is deliberately narrow. The application allows users to initiate direct conversations, so this check is not a complete defense against deliberate prekey depletion. A Redis-backed atomic fixed-window limiter now caps cross-account bundle requests at 8 per requester-target pair and 60 per requester per minute; it fails closed with 503 if shared Redis is unavailable. Device inventory and active-device presence are now restricted to the account owner or an established direct-chat peer. Abuse monitoring and unsolicited-conversation policy remain follow-up work.

## 2. Controls verified in code

### Authentication and device ownership

- Both E2EE routers apply account authentication.
- SDK key mutation, mailbox and envelope routes additionally use `e2eeDeviceAuth`.
- Device credentials arrive in `X-E2EE-Device-Token`; the repository hashes the token with SHA-256 and looks up the tuple (authenticated user, device slot, token hash).
- Device authentication requires the device to be enabled, registered and not revoked.
- Device inventory and active-device presence reads require the requester to be the owner or an established direct-chat peer; identity public-key discovery remains available for protocol bootstrap.
- Service/repository writes bind device slots to the authenticated account; a client cannot select another user's device slot merely by changing the path parameter.

### Envelope sending and mailbox

- Envelope persistence checks that the sender is an active conversation member and that E2EE is active.
- The sender device is loaded for the authenticated sender account and must be active.
- The recipient must be an active member of the same conversation and the target device must be active.
- Mailbox pull is bound to the authenticated user/device slot and selects only envelopes addressed to that device's database row.
- Acknowledgement updates are constrained by envelope ID and recipient device ownership/slot, and reject revoked devices.
- Envelope payload validation limits ciphertext size, message/delivery types, timestamps and idempotency UUIDs.

### Provisioning and identity

- Provisioning sessions use random UUIDs, an owner user ID and expiry checks.
- Session state transitions are scoped by both session ID and owner user ID.
- Device assignment occurs transactionally and is capped at five device slots.
- Device tokens are generated from cryptographic randomness; only a SHA-256 token hash is stored in the device row.
- Identity rotation uses an expected-current commitment, updates the canonical identity transactionally, revokes sibling devices and clears their unacknowledged envelopes/prekeys.

### Encrypted attachments and R2

- Upload reservation requires conversation membership and an E2EE-enabled conversation.
- Reservation identity is scoped to uploader, request ID and preparation timestamp; digest and read-capability digest are checked for retry consistency.
- Completion, reconciliation and deletion verify uploader ownership.
- Download requires conversation membership and a read capability whose SHA-256 digest matches stored metadata.
- Backend-issued R2 tickets are HMAC-signed, short-lived and bound to HTTP method, attachment ID, object key, conversation, user, expected size and digest.
- The Worker verifies the ticket and method/path binding; upload is size-limited, digest-checked and configured not to overwrite an existing object. Reads verify stored size and digest. Responses use no-store and nosniff headers.
- No plaintext fallback was found in the reviewed E2EE attachment path.

## 3. Change applied

- `service/e2eeRelayService.js`: validate requester and target IDs; for cross-account bundle retrieval require `conversationRepository.findDirectConversation(requesterId, targetUserId)` to return an active direct conversation before calling the repository method that claims one-time prekeys.
- Own-account linked-device bundle retrieval remains allowed for multi-device flows.
- `middleware/e2eePreKeyBundleRateLimit.js`: applies atomic Redis Lua counters for pair and requester-wide quotas before a cross-account bundle fetch. The middleware returns 429 with `Retry-After` when either quota is exceeded and fails closed on Redis errors rather than falling back to per-process memory.
- `router/e2eeRelayRouter.js`: applies the distributed limiter to the prekey-bundle endpoint.
- `test/e2eeRelayService.test.js` and `test/e2eePreKeyBundleRateLimit.test.js`: cover conversation gating, pair/requester counters, quota rejection, Redis outage and own-device bypass.

This does not alter database schema or data and does not require a migration.

## 4. Additional hardening applied

- Attachment authorization now distinguishes new upload reservations from historical access. A new upload ticket requires the conversation E2EE mode to be `active`; a paused conversation returns `E2EE_PAUSED`.
- Existing uploaded ciphertext remains accessible while E2EE is paused, and already-created pending uploads can still complete. This avoids turning pause into deletion or loss of historical encrypted content.
- Added unit tests for paused-mode rejection and fail-closed behavior when E2EE is unavailable/disabled.

## 4. Remaining risks / follow-up

| Priority | Observation | Follow-up |
|---|---|---|
| High | SDK `removeDevice` rejects device slot 1. The reviewed SDK route therefore cannot revoke the primary device through this operation. | Define and test a recovery-safe primary-device revocation path, including confirmation and prevention of accidental account lockout. |
| Closed | Device inventory and active-device presence were readable by any authenticated account; these routes now allow only self or an established direct-chat peer. Public identity-key discovery remains unchanged for protocol bootstrap. | Keep the peer-scope regression tests; revisit identity-key discovery only if the protocol's public directory policy changes. |
| Medium | Direct conversations can be initiated by an authenticated user. The conversation check and Redis-backed pair/requester quotas limit prekey depletion, but an attacker can still initiate chats and consume the allowed quota repeatedly. | Add prekey depletion telemetry, alerting and abuse controls for unsolicited conversation initiation. |
| Closed | New E2EE attachment reservations require mode `active`; paused conversations preserve historical ciphertext access and completion of already-created pending uploads. Unit tests cover the pause policy. | No further change required for this finding; retain regression coverage. |
| Closed (repository-level) | Added regression coverage for revoke → old device credential rejected → mailbox pull denied → envelope acknowledgement denied. The primary device slot remains protected and its rejection path is tested. | Retain these tests and add a live PostgreSQL/device-auth integration test before production rollout. |
| Medium | Provisioning ownership/expiry is enforced in repository SQL, but no full browser/device-pairing adversarial test was observed in the reviewed CI. | Add two-client E2E tests for wrong-owner session IDs, expiry, replay, rollback and acknowledgement races. |

## 5. Verification evidence and limits

The latest revocation regression tests are code-level repository tests using mocked PostgreSQL query behavior. They do not replace a live PostgreSQL integration test or a real stolen-browser-token replay test.

On commit `b4d90c8dbe828db45b2efc3ead7350f3ad4f7042`:

- API tests workflow `40289133762`: success.
- Quality checks workflow `40289133740`: success.

The API workflow includes backend unit tests, Cloudflare Worker tests, E2EE migration smoke and live PostgreSQL relay integration. Quality checks include backend tests and frontend lint/production build. These results validate configured CI jobs only; they do not establish a production penetration test, browser pairing test, live R2 test or hosted deployment readiness.

No live user database was accessed or modified. No migration was run. No merge was performed.


## 6. Provisioning lifecycle follow-up (SDK 11.0.0)

- Confirmed the frontend lockfile resolves `@open-e2ee/signal-protocol-sdk` to exactly `11.0.0`; review of provisioning must use that package contract rather than current-major examples.
- Provisioning allocates linked slots 2–5 under an account-row lock. The new device credential is issued by `completeProvisioning` and stored by the relay adapter; the frontend then restarts the client using the provisioned local store.
- Expired `linked_pending_ack` sessions remove only the device row allocated by that session, guarded by user, slot, linked flag, revocation state and `created_at <= completed_at`. This prevents cleanup from deleting a later device that reused the slot.
- **Newly closed finding:** expired `completed` sessions were excluded from expiry cleanup, so encrypted provisioning payload and transient public-key metadata could remain stored indefinitely. The cleanup query now includes completed rows after their five-minute retention window, clears encrypted payload/metadata and ephemeral public-key fields, and preserves `status='completed'` so the primary device can still observe successful completion.
- Added a repository regression test for completed-session scrubbing and status preservation. The test is mocked at the PostgreSQL query boundary; it has not been executed in this environment.
- Cleanup remains opportunistic: it runs when a provisioning endpoint is next called. There is no background expiry worker, so an idle account's expired rows can remain until its next provisioning request.

### Still unverified before production

- The SDK's exact v11 provisioning wire encoding for ephemeral public keys has not been independently confirmed from the installed package artifact. Do not add a guessed fixed-length validation to Base64 values.
- The exact SDK v11.0.0 source was inspected at tag `v11.0.0`: it decrypts/authenticates the payload before `completeProvisioning`, stores identity/device/group state locally, then calls `acknowledgeProvisioning`; on any error after server completion it attempts server rollback and local-state cleanup.
- No real-browser two-device pairing, wrong-key rejection, provisioning replay, or PostgreSQL concurrency test was run in this environment. The next required test is a real primary/new-browser pair with network interruption between decrypt, completion, acknowledgement and client initialization.
- `completeProvisioning` remains authenticated by the account session and returns a device credential. This is not server-verifiable proof that the caller decrypted the AES-GCM payload; do not infer that HTTP authentication proves possession of the primary device's local identity key.

No schema change, migration, live database operation, or merge was performed for this follow-up.


## 7. Provisioning acknowledgement now gates device activation

The pinned SDK source for tag `v11.0.0` was inspected at `device/provisioning.ts`. Its receiver sequence is:

1. Fetch the ready provisioning payload.
2. Derive the ECDH shared secret and decrypt/authenticate the AES-GCM payload.
3. Call `completeProvisioning`.
4. Store the received identity and local device state.
5. Call `acknowledgeProvisioning`.
6. If a later step fails after server completion, attempt `rollbackProvisioning`.

The relay adapter already stores the returned device credential during step 3. The backend previously inserted the device as enabled immediately, before the SDK had stored its local identity state and acknowledged success.

### Change applied

- New linked device rows are now inserted with `enabled = FALSE`.
- The frontend relay adapter retrieves the newly issued device credential and sends it in `X-E2EE-Device-Token` when the SDK calls `acknowledgeProvisioning`.
- The backend hashes that credential and activates only the exact device slot assigned to that pending session, matching account, linked flag, revocation state and creation-time guard.
- The provisioning session changes to `completed` in the same database transaction as activation. A bad/missing credential or failed session transition rolls the transaction back.
- Added repository regression tests for credential-gated activation and missing-credential rejection; the slot-allocation test also asserts that new devices are initially disabled.

### Security boundary that remains

This closes the window in which a newly allocated device could use its relay credential before the SDK had stored its provisioned local state and acknowledged. It does **not** provide server-verifiable proof that the caller of `completeProvisioning` actually decrypted the AES-GCM payload: that endpoint still returns the device credential to the authenticated account session that calls it. The SDK v11 provisioning callback does not pass a decrypt-derived proof parameter to the relay interface. A complete cryptographic proof-of-possession design therefore requires a compatible SDK extension/fork or a separately reviewed challenge protocol; do not describe this as fully closed.

The SDK v11 source confirms decryption/authentication occurs before `completeProvisioning`, and acknowledgement follows local identity/state storage. This code-level sequence is not a substitute for a real two-browser test.

No schema change or migration is required because `e2ee_sdk_devices.enabled` already exists.

### 8. Provisioning activation is restricted to a disabled pending device

- The acknowledgement update now includes `enabled = FALSE` in its predicate. A valid token cannot re-enable a device that is already active, nor can the same update silently act as a reactivation path.
- The update remains scoped to the account, server-assigned slot, linked-device state, token hash, and creation time recorded by the provisioning session.
- A repository regression test verifies that a failed activation rolls back and does not mark the provisioning session completed.
- This is a state-transition hardening, not cryptographic proof that the new device decrypted the provisioning payload. The authenticated account session still receives the device token from `completeProvisioning`; a future protocol-level proof requires an SDK-supported challenge/signature or a reviewed SDK extension.

### 9. Expired ACK cleanup must commit before returning a conflict

- Previously, the repository expiry helper could delete an expired pending device and mark its session expired, then throw a conflict from inside the same transaction. That exception caused the transaction wrapper to roll back the cleanup.
- The ACK repository now returns an internal `expiredOrUnavailable` sentinel after the cleanup path, allowing the transaction to commit. The service maps that sentinel to HTTP 409 only after the repository promise resolves.
- Regression coverage checks that expired ACK removes the pending device, scrubs session payloads, commits the transaction, and never executes device activation. A service-level test checks the sentinel is translated to a conflict.
- If expiry occurs in the narrow interval after the initial cleanup scan but before the final ACK update, the ACK remains fail-closed (device stays disabled); cleanup is retried on the next provisioning operation.

## 9. Provisioning rollback handles a lost ACK response

The SDK v11 receiver catches errors after `completeProvisioning`, calls `rollbackProvisioning`, and then clears partially stored local identity/device/group state. A network interruption can occur after the ACK transaction commits but before the browser receives its response. Previously the server would reject rollback because the session was already `completed`; the SDK would still clear local state, leaving an enabled server device with no corresponding local identity state.

The rollback path now:

- Requires the new device's `X-E2EE-Device-Token` and validates its SHA-256 hash against the assigned device.
- For `linked_pending_ack`, removes only the matching disabled pending device, constrained by account, assigned slot, linked flag, token hash and creation time.
- For `completed`, revokes only the matching enabled linked device, clears its device credential hash, and removes its unacknowledged mailbox envelopes and prekeys in the same transaction.
- Marks the provisioning session `rolled_back` in that transaction. A bad token cannot revoke the device or change the session state.
- Treats an already `expired` or `rolled_back` session as an idempotent cleanup result so the adapter can clear the local credential after expiry cleanup already removed the pending server row.

The adapter now sends the per-device credential on rollback and clears the local credential only after the server confirms rollback/idempotent finalization. This addresses the server-committed-ACK / lost-response recovery case at the relay boundary. It still requires a real browser test that drops the ACK response after commit and verifies both local keystore cleanup and server revocation. It does not solve the separate lack of server-verifiable cryptographic proof at `completeProvisioning`.
