# E2EE Security Access Audit

**Repository:** `ToVanDat/Student-Manager`  
**Branch:** `feature/chat-1to1-complete`  
**Audit date:** 2026-10-26  
**Scope:** Express routes, device-auth middleware, E2EE relay services/repositories, provisioning, encrypted attachment service and R2 Worker.  
**Method:** Static code review of the branch and automated CI evidence. This is not a penetration test or live deployment verification.

## 1. Summary

A concrete prekey access weakness was found and mitigated: the authenticated prekey-bundle endpoint previously passed `requesterId` to the service but did not use it before the repository claimed one-time prekeys for the target device. The service now requires an existing direct conversation for cross-account bundle retrieval; a user's own linked devices remain eligible. Regression tests cover both paths.

The mitigation is deliberately narrow. The application allows users to initiate direct conversations, so this check is not a complete defense against deliberate prekey depletion. A requester/target-aware distributed rate limit and abuse monitoring remain follow-up work.

## 2. Controls verified in code

### Authentication and device ownership

- Both E2EE routers apply account authentication.
- SDK key mutation, mailbox and envelope routes additionally use `e2eeDeviceAuth`.
- Device credentials arrive in `X-E2EE-Device-Token`; the repository hashes the token with SHA-256 and looks up the tuple (authenticated user, device slot, token hash).
- Device authentication requires the device to be enabled, registered and not revoked.
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
- `test/e2eeRelayService.test.js`: added regression cases proving that no bundle/prekey claim occurs without a direct conversation and that valid peer/self-device paths are preserved.

This does not alter database schema or data and does not require a migration.

## 4. Remaining risks / follow-up

| Priority | Observation | Follow-up |
|---|---|---|
| High | SDK `removeDevice` rejects device slot 1. The reviewed SDK route therefore cannot revoke the primary device through this operation. | Define and test a recovery-safe primary-device revocation path, including confirmation and prevention of accidental account lockout. |
| Medium | `GET /users/:userId/devices`, `identity` and `active-devices` require account authentication but do not require a shared conversation. Identity public keys are intended for discovery; device inventory and active-device presence may disclose more metadata than necessary. | Decide which metadata is public by protocol; restrict nonessential inventory/presence to shared-conversation peers or another explicit policy. |
| Medium | Direct conversations can be initiated by an authenticated user. The new membership check therefore reduces unrelated bundle harvesting but does not stop an attacker from initiating a chat and then repeatedly claiming prekeys. | Add requester+target scoped rate limits backed by Redis/database, monitor prekey depletion and consider abuse controls for unsolicited conversation initiation. |
| Medium | Attachment authorization checks `enabled` but not the E2EE mode value `active`; because a paused conversation can remain enabled, new attachment reservations may still be created while envelope sends are paused. | Decide whether pause should block new uploads while preserving historical downloads; if so, split upload-active checks from historical-download access and add tests. |
| Medium | `removeDevice` revokes linked devices and deletes their pending envelopes/prekeys, but there is no reviewed end-to-end runtime test for stolen-device credential replay after revocation. | Add repository/integration tests for revoke → old token rejected → mailbox and envelope operations denied. |
| Medium | Provisioning ownership/expiry is enforced in repository SQL, but no full browser/device-pairing adversarial test was observed in the reviewed CI. | Add two-client E2E tests for wrong-owner session IDs, expiry, replay, rollback and acknowledgement races. |

## 5. Verification evidence and limits

On commit `b4d90c8dbe828db45b2efc3ead7350f3ad4f7042`:

- API tests workflow `40289133762`: success.
- Quality checks workflow `40289133740`: success.

The API workflow includes backend unit tests, Cloudflare Worker tests, E2EE migration smoke and live PostgreSQL relay integration. Quality checks include backend tests and frontend lint/production build. These results validate configured CI jobs only; they do not establish a production penetration test, browser pairing test, live R2 test or hosted deployment readiness.

No live user database was accessed or modified. No migration was run. No merge was performed.
