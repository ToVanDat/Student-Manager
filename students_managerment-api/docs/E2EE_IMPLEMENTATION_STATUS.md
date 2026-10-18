# E2EE implementation notes — Student-Manager

## Current scope on this branch

This branch is an incremental backend foundation. It is **not yet a complete or enabled E2EE implementation**.

### Added

- Additive PostgreSQL migration for per-device public identity/prekey material, one-time prekeys, per-recipient message envelopes, and conversation E2EE settings.
- Authenticated API routes under `/api/e2ee`:
  - `POST /devices` — register/update the current user's public device bundle and upload one-time public prekeys.
  - `GET /devices` — list the current user's active devices.
  - `DELETE /devices/:deviceId` — revoke one of the current user's devices.
  - `GET /conversations/:conversationId/device-bundles` — for conversation members only, list active public device bundles without consuming one-time prekeys.
  - `POST /conversations/:conversationId/users/:userId/devices/:deviceId/claim-prekey` — atomically claim one unused prekey for a specific active device belonging to a conversation member.
- Frontend API wrapper in `students_management-frontend/src/api/e2eeApi.js`.

### Hardening performed in this pass

- Fixed a malformed template string in the frontend device-bundle API URL.
- A device ID is now bound to its first identity public key; registration rejects an unexpected identity-key change with HTTP 409 rather than silently overwriting the trust identity.
- Normal registration cannot reactivate a revoked device ID; a reinstalled/recovered client must register a new device ID and use a separately designed trust/recovery flow.
- Re-uploading the same one-time prekey ID no longer clears its claimed state, preventing a claimed prekey from being reused by accidental bundle re-registration.
- Listing device bundles no longer consumes prekeys. Prekeys are claimed only for a specific user/device pair in the conversation, reducing accidental or cross-device prekey exhaustion.
- The one-time prekey claim route has a route-level request limit. This is a basic abuse control, not a substitute for account-aware distributed rate limiting or monitoring.
- Removed a redundant/ineffective condition from the own-device listing query.

## Important security boundary

- Private identity keys, private signed-prekeys, and ratchet/session state must remain on the client device. Do not add these to PostgreSQL or send them to Express.
- The API only transports public key material and opaque ciphertext/envelopes. It does not itself implement encryption.
- The existing `messages.content` flow still sends plaintext. Do **not** enable or advertise E2EE until a browser protocol SDK is integrated into send, history rendering, edit/recall, attachments, notifications, search, and Socket.IO.
- Legacy messages remain untouched. E2EE activation must apply only to messages created after the activation point.
- The bundle endpoint includes active devices belonging to all current conversation members, including the caller's other devices. The client protocol must encrypt to each intended recipient device and handle revoked devices.
- These endpoints are not yet a complete adapter for a production Signal-protocol SDK. Do not connect an SDK to them until the SDK's relay contract, identity assertions, message envelope format, prekey lifecycle, and per-device delivery/acknowledgement semantics are implemented and tested.

## Protocol SDK decision to validate

The current candidate is `@open-e2ee/signal-protocol-sdk@11.0.0`, which documents browser stores and a custom `SignalProtocolRelayServer` adapter. The current repository README lists MIT OR Apache-2.0; an older 2.x release used AGPL, so pin the version and verify the package tarball/lockfile license before install. This is an independent implementation/profile, not affiliated or wire-compatible with Signal Messenger/libsignal. Its assurance page explicitly says it has not been audited by an independent firm. The browser store also does not defend against same-origin XSS, and the SDK's public docs have some versioned reference pages that should be reconciled with the exact installed package exports. Review the protocol deviations, CSP, key persistence/recovery and threat model before production adoption.

References:
- https://github.com/open-e2ee/signal-protocol-js
- https://docs.open-e2ee.dev/start/browser
- https://docs.open-e2ee.dev/reference/adapters
- https://github.com/signalapp/libsignal
- https://docs.open-e2ee.dev/reference/adapters
- https://docs.open-e2ee.dev/start/browser
- https://docs.open-e2ee.dev/reference/api
- https://docs.open-e2ee.dev/reference/security-and-protocol-policy

## Additional plaintext guard added

The existing REST message-create controller and Socket.IO `message:send` event now check the conversation's E2EE activation record and reject legacy plaintext sends with an explicit `E2EE_REQUIRED` response. Before the migration exists, the repository checks `to_regclass` and leaves legacy behavior unchanged. This is a guard only: there is still no E2EE activation endpoint or encrypted send/receive relay, so it does not enable E2EE by itself.

## Browser SDK integration progress

- Pinned `@open-e2ee/signal-protocol-sdk` to `11.0.0` and added its `idb` peer dependency to the frontend package manifest. The frontend workflow installs with `npm install`; this repository does not currently contain a frontend lockfile.
- Added `students_management-frontend/src/services/e2ee/e2eeClient.js`. It opens the SDK's encrypted browser SQLite store in a per-account OPFS database and creates a local `SignalProtocolClient`. It exposes initialization, client access, lifecycle state subscription, and shutdown. Private keys/session state are not sent to the API.
- Added `students_management-frontend/src/hooks/useE2EEClient.js` for React-side lifecycle/status management.
- This is deliberately **local-only** at this stage. `local-ready` means only that the local store/client initialized; it does not mean a conversation is E2EE-enabled, that a relay is connected, or that messages are being encrypted. There is no plaintext fallback policy change from these files.
- The browser store currently requires OPFS/Web SQLite. It fails closed rather than silently switching to the SDK's fixed-name IndexedDB store, which could mix account identities in a shared browser profile. A separate account-scoped fallback needs a store adapter designed and tested for that purpose.

## Required next implementation stage

1. Implement the SDK-compatible relay contract against the exact pinned SDK `11.0.0` declarations: server-owned device slots, identity provisioning/rotation, signed/KEM/one-time prekeys, envelope mailbox, subscription state, durable acknowledgements, retries, linked-device sync, and rate limits.
2. Add a separate ciphertext-only message/envelope persistence model. Do not make `messages.content` contain plaintext or a fabricated ciphertext placeholder for E2EE messages.
3. Wire the SDK client to the authenticated relay, register the decrypt hook before starting subscriptions, and encrypt before any REST/Socket.IO network send. Decryption must happen only on recipient devices.
4. Adapt history, unread/delivery/read receipts, edit/recall/delete, attachments, notifications, and search so server-side features never need E2EE plaintext. Search of E2EE messages must be local-only unless a separately designed privacy-preserving search is adopted.
5. Add a deliberate per-conversation activation transition and mixed-history rendering. Activation must not occur until all active devices have registered compatible keys and the encrypted send/receive path is available.
6. Add two-account/two-device end-to-end tests, one-time-prekey concurrency/replay tests, revoked-device and missing-key tests, plus edit/recall, attachment, notification and search regressions.
7. Run frontend lint/build, backend API tests, migration tests against a disposable schema matching the actual database, and protocol round-trip tests on the latest commit before merging.

## Validation status

The migration has not been executed against the user's PostgreSQL database. The latest local-store integration has not yet been validated by a completed CI run. The SDK relay is not implemented, chat send/receive is not wired to the SDK, and E2EE activation remains unavailable. Do not describe this branch as complete E2EE until those gates pass.
