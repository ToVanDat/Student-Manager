# E2EE implementation status — Student-Manager

## Current scope

This branch now contains a first end-to-end integration slice for **direct text chat only**. The latest validated CI commit passed the Signal Protocol two-account/two-recipient-device round-trip, backend tests, frontend lint/build, idempotent PostgreSQL migration smoke test, and live PostgreSQL relay integration test. The live database test uses a purpose-built disposable schema; it is not validation against the user's deployed schema. This still is not production-ready until the remaining limitations below and manual browser tests are resolved.

### Browser client and local state

- Pinned `@open-e2ee/signal-protocol-sdk@11.0.0`, `idb`, and `qrcode.react`.
- `src/services/e2ee/e2eeClient.js` initializes the SDK with a per-account OPFS/Web-SQLite store, attaches the custom relay, registers the decrypted-message hook before subscription, and exposes send/receive lifecycle state.
- The relay adapter drains paginated mailbox batches and retries transient mailbox/decryption/handler failures with capped exponential backoff; failed envelopes remain unacknowledged. The latest CI run validates the protocol round-trip, but the browser reconnect/retry UX still requires manual acceptance.
- `src/hooks/useE2EEClient.js` exposes local readiness and relay state to React.
- `src/services/e2ee/e2eeDeviceStateStore.js` persists the numeric device slot and the SDK provisioning local-state keys.
- `src/services/e2ee/e2eeDeviceCredentialStore.js` stores the per-device relay bearer token in IndexedDB. The server stores only its SHA-256 hash. Same-origin XSS can still use the token; this is not an XSS defense.
- `src/services/e2ee/e2eeHistoryStore.js` stores decrypted application history encrypted with AES-GCM under a non-extractable WebCrypto key in the same browser profile. Losing that local key makes the local E2EE history unreadable; it is not recovered from the server.
- `src/components/chat/E2EEDeviceLinkPanel.jsx` provides QR/copy-link device provisioning using SDK helpers. The primary sends only an encrypted provisioning payload; the relay stores that payload opaquely.

### Relay and backend

- Additive migration: `students_managerment-api/sql/e2ee_foundation_migration.sql`.
- SDK-specific numeric device slots, one-time device credentials, account-level CompositeIdentityV1 pinning/commitments, EC/KEM prekeys, ciphertext envelope mailbox, expiring encrypted device-provisioning sessions, and conversation E2EE settings.
- Per-device credential middleware protects key mutation, envelope send, mailbox pull, acknowledgement, and Socket.IO subscription. Re-registering an existing active slot does not reveal its token; losing the token requires re-linking/recovery.
- Prekey bundle reads do not consume keys. Fetching a bundle atomically claims one EC and one KEM one-time prekey, with last-resort KEM fallback.
- Direct-message envelope sends are accepted only after the conversation's E2EE setting exists. REST/Socket.IO plaintext message creation is blocked after activation. Before the migration is present, the status API reports E2EE unavailable so existing legacy chat continues.
- Activation is direct-chat-only and requires all active devices of both members to have the canonical identity and required signed prekeys.
- Identity rotation uses a server-side commitment compare-and-swap and revokes other linked devices. Those devices must be securely re-linked afterward.

### Chat integration

- New text messages in an activated direct conversation call the SDK `send` method; they do not go through the legacy message-create REST endpoint.
- Decrypted messages are labeled `E2EE` and merged with legacy server history. Existing legacy messages are not migrated or rewritten.
- Encrypted edits, recalls, and reactions are sent as encrypted control messages and saved to the local encrypted history store.
- Search for an activated E2EE conversation is local-only; search text is not sent to the server.
- E2EE relay requests generic notification-center and Web Push alerts through the existing notification service and preferences; it passes an empty message body and generic sender label, never decrypted body, ciphertext, filename, or attachment metadata. The relay deduplicates notification decisions across recipient devices for one logical message. Delivery is best-effort; notification-service failures do not fail a durable ciphertext send.
- The E2EE attachment broker has additive metadata and retry migrations, authenticated short-lived HMAC tickets, account-scoped idempotency, SHA-256 verification of actual R2 object bytes, conversation membership checks, and a private Cloudflare Worker with a 500 MiB ceiling. The frontend SDK adapter supports upload, completion, download, reconciliation, abandonment, and deletion; durable conversation binding is persisted in IndexedDB and the backend can resolve the original reservation after a lost response. The adapter is now attached to the singleton Signal client, and `e2eeClient.js` exports `setE2EEAttachmentConversationId()` to supply the active conversation context. However, the chat page has not yet been connected to that setter, and the existing attachment picker intentionally blocks E2EE-enabled conversations before falling through to the legacy plaintext upload API. Therefore E2EE attachments are **not enabled end-to-end** and must remain blocked until the UI integration, SDK attachment-pointer send/receive path, private-R2 deployment, and real-browser tests are complete. Previously reported CI results apply only to the commit that was tested; they do not validate the latest attachment-adapter wiring.

## Important limitations still open

1. **Protocol round-trip CI passes on the latest validated commit.** The test validates SDK encryption/decryption and fan-out to two recipient devices through an in-memory relay. It does not validate the deployed Express/PostgreSQL relay or real-browser storage.
2. The QR provisioning flow and server endpoints have been added, but must be exercised manually across two separate browser profiles and audited for interrupted/expired provisioning, rollback, token loss, and linked-device re-registration.
   Mailbox retry and pagination also need validation under transient API errors, decryption failures, reconnects, and unsubscribe/cleanup.
3. E2EE local history is per device. It is not a server-side decrypted transcript and is not synchronized to a newly linked device. Legacy history remains available from the existing server APIs. If the local history key is missing or history decryption fails, the chat now shows a warning and does not auto-generate a replacement key.
4. **E2EE attachment transport is implemented at the broker/adapter layer, but not yet enabled end-to-end.** See `docs/E2EE_R2_ATTACHMENTS.md`. The Worker is not deployed/configured in the user's environment, the additive migrations have not been applied to the real database, the adapter is not wired into the singleton Signal client, and the chat UI does not send/receive SDK attachment pointers yet. Keep UI uploads blocked until private-R2 deployment, migration review, and real-browser acceptance are complete.
5. E2EE notifications are generic and best-effort. The relay calls the existing notification-center/Web Push delivery service with a generic sender label and an empty message body. Delivery failure does not fail an already durable ciphertext send; validate behavior against the configured push provider and recipient preferences.
6. Group-chat E2EE is not implemented. The activation endpoint intentionally rejects group conversations.
7. Device revocation/rotation invalidates relay credentials and prekeys, but full UX for account recovery after loss of the primary device's identity/private key is not implemented. Do not silently generate a replacement identity for an existing account.
8. The PostgreSQL migration passed a smoke test twice against a disposable PostgreSQL 16 database with minimal `users`, `conversations`, and `messages` base tables, including idempotency. It has **not** been applied or validated against the user's actual database. Check existing constraints/types and test against a disposable schema matching the deployed schema first.
9. The SDK is an independent implementation/profile, not affiliated or wire-compatible with Signal Messenger/libsignal, and its public docs state it has not been independently audited. Browser storage and IndexedDB credentials do not protect against same-origin XSS. Review the protocol profile, CSP, key recovery, threat model, and exact package tarball/license before production use.

## Validation plan

CI workflow `.github/workflows/quality-checks.yml` now includes:

- Backend API/unit test suite.
- Frontend SDK encryption/decryption round-trip with two accounts and two recipient devices using an in-memory relay.
- Frontend lint.
- Frontend production build.

Still required before merge/production:

- On commit `5a1c100a14ce80b97b5a71d5124f2b49e800fb8d`, GitHub Actions passed the API unit tests, R2 Worker tests, attachment/foundation migration reruns, live relay PostgreSQL integration, frontend lint/build, SDK encryption/decryption round-trip, and quality-workflow backend tests. Documentation-only commits after that run still need CI confirmation if the PR is updated again.
- Execute migration tests against a disposable PostgreSQL schema matching the deployed schema. The current live integration job uses a purpose-built minimal schema, not a copy of the deployed schema.
- Manual browser acceptance checklist is documented in `students_managerment-api/docs/E2EE_BROWSER_ACCEPTANCE_CHECKLIST.md`. Run it across two separate browser profiles before merge: link device, send text, reconnect/offline delivery, edit/recall/reaction, search, revoke device, missing local key, and failed provisioning rollback.
- API unit tests cover relay request validation, direct-recipient mismatch, missing direct conversation, mailbox device-slot validation, acknowledgement ID validation, and repository query paths. Those mocked tests remain useful but are not a substitute for the new live PostgreSQL integration test.
- Added an Express HTTP integration test for JWT/session middleware and per-device credential middleware around the mailbox route. Redis, session/user lookups, and repository calls are stubbed; it verifies the HTTP/auth chain, not live database integration.
- API unit tests cover relay request validation, direct-recipient mismatch, missing direct conversation, mailbox device-slot validation, acknowledgement ID validation, mailbox query scoping, device revocation query sequence, and notification deduplication/retry behavior. These unit tests use a stubbed repository/database boundary.
- Added `test/e2eeRelayPostgres.integration.test.js`, run in CI against a disposable PostgreSQL 16 service. It applies the additive migration and exercises concurrent one-time prekey claims, per-device mailbox delivery, acknowledgement idempotency, notification deduplication across recipient devices, and pending-envelope cleanup after device revocation. This validates the repository against a purpose-built minimal schema, not the user's actual deployed schema.
- A live PostgreSQL integration test now runs in the disposable PostgreSQL CI job for concurrent one-time-prekey claims, ciphertext mailbox fan-out, retry idempotency, acknowledgement, notification decision deduplication across recipient devices, and device revocation/pending-envelope cleanup. It does not yet test concurrent notification delivery under independent processes, Redis-backed session authorization against a live Redis instance, or Socket.IO subscription authorization end-to-end.
- The SDK provides a supported `adapters.remoteObjectStore` boundary and S3 adapter, but enabling it requires a broker with authenticated per-account object reservations, opaque server-generated object IDs, short-lived upload/download URLs, content-size/type enforcement, deletion propagation, and configured storage credentials. Do not ship cloud credentials to the browser. No storage provider/broker is configured in this branch, so E2EE attachments remain blocked.

## Browser verification

- Added `docs/E2EE_MANUAL_TEST_PLAN.md` with a two-independent-profile test matrix for activation, encrypted text, offline delivery, retry, controls, fail-closed legacy paths, missing local history key, provisioning expiry, and device revocation. This is a runbook, not evidence that those manual tests have already been performed.

## Key files

- `students_management-frontend/src/services/e2ee/e2eeRelayAdapter.js`
- `students_management-frontend/src/services/e2ee/e2eeClient.js`
- `students_management-frontend/src/services/e2ee/e2eeHistoryStore.js`
- `students_management-frontend/src/components/chat/E2EEDeviceLinkPanel.jsx`
- `students_management-frontend/test/e2eeProtocolRoundTrip.test.mjs`
- `students_managerment-api/repository/e2eeRelayRepository.js`
- `students_managerment-api/middleware/e2eeDeviceAuth.js`
- `students_managerment-api/sql/e2ee_foundation_migration.sql`

References:
- https://github.com/open-e2ee/signal-protocol-js
- https://docs.open-e2ee.dev/start/browser
- https://docs.open-e2ee.dev/reference/adapters
- https://github.com/signalapp/libsignal
