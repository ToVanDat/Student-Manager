# E2EE implementation status — Student-Manager

## Current scope

This branch now contains a first end-to-end integration slice for **direct text chat only**. CI now passes the two-client/two-recipient-device Signal Protocol round-trip, backend tests, frontend lint/build, and a PostgreSQL migration smoke test on a disposable minimal base schema. This still is not production-ready until the remaining limitations below and manual browser tests are resolved.

### Browser client and local state

- Pinned `@open-e2ee/signal-protocol-sdk@11.0.0`, `idb`, and `qrcode.react`.
- `src/services/e2ee/e2eeClient.js` initializes the SDK with a per-account OPFS/Web-SQLite store, attaches the custom relay, registers the decrypted-message hook before subscription, and exposes send/receive lifecycle state.
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
- E2EE relay requests generic notification-center and Web Push alerts through the existing notification service and preferences; it passes an empty message body and generic sender label, never decrypted body, filename, or attachment metadata. The relay deduplicates notification decisions across recipient devices for one logical message. Delivery is best-effort; notification-service failures do not fail a durable ciphertext send.
- Attachments are deliberately blocked in E2EE conversations. They must not fall back to the legacy plaintext upload path.

## Important limitations still open

1. **Protocol round-trip CI passes on the latest validated commit.** The test validates SDK encryption/decryption and fan-out to two recipient devices through an in-memory relay. It does not validate the deployed Express/PostgreSQL relay or real-browser storage.
2. The QR provisioning flow and server endpoints have been added, but must be exercised manually across two separate browser profiles and audited for interrupted/expired provisioning, rollback, token loss, and linked-device re-registration.
3. E2EE local history is per device. It is not a server-side decrypted transcript and is not synchronized to a newly linked device. Legacy history remains available from the existing server APIs.
4. E2EE attachments are not implemented because there is no configured encrypted remote-object-store adapter. The UI blocks uploads rather than leaking plaintext.
5. E2EE notifications are generic in-app notifications only. Push delivery and durable notification-center records for encrypted messages are not yet wired.
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

- Confirm all latest workflow jobs passed for the final commit; do not infer success from an earlier commit. The current branch runs API tests and migration smoke tests plus backend/frontend quality checks on pushes.
- Execute migration tests against a disposable PostgreSQL schema matching the deployed schema.
- Manual browser test across two separate profiles: link device, send text, reconnect/offline delivery, edit/recall/reaction, search, revoke device, missing local key, and failed provisioning rollback.
- API unit tests now cover relay request validation, direct-recipient mismatch, missing direct conversation, mailbox device-slot validation, and acknowledgement ID validation. These mock the repository boundary and are **not** database/HTTP integration tests.
- Added an Express HTTP integration test that exercises the actual JWT/session middleware and per-device credential middleware around the mailbox route; Redis, session/user lookups, and PostgreSQL repository operations are stubbed, so this verifies the HTTP/auth chain but is not a live database integration test.
- API unit tests cover relay request validation, direct-recipient mismatch, missing direct conversation, mailbox device-slot validation, acknowledgement ID validation, mailbox query scoping, device revocation query sequence, and notification deduplication/retry behavior. Repository tests use a stubbed PostgreSQL boundary; concurrency and transaction semantics still need a live PostgreSQL integration test.
- Still add live PostgreSQL integration tests for concurrent prekey claims, durable mailbox pull/ack/retry/idempotency, notification deduplication under concurrent sends, socket subscription authorization, device revocation, and migration constraints.
- The SDK provides a supported `adapters.remoteObjectStore` boundary and S3 adapter, but enabling it requires a broker with authenticated per-account object reservations, opaque server-generated object IDs, short-lived upload/download URLs, content-size/type enforcement, deletion propagation, and configured storage credentials. Do not ship cloud credentials to the browser. No storage provider/broker is configured in this branch, so E2EE attachments remain blocked.

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
