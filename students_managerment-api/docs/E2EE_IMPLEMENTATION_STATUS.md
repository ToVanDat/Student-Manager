# E2EE implementation notes — Student-Manager

## Current scope on this branch

This branch is an incremental backend foundation. It is **not yet a complete or enabled E2EE implementation**.

### Added

- Additive PostgreSQL migration for per-device public identity/prekey material, one-time prekeys, per-recipient message envelopes, and conversation E2EE settings.
- Authenticated API routes under `/api/e2ee`:
  - `POST /devices` — register/update the current user's public device bundle and upload one-time public prekeys.
  - `GET /devices` — list the current user's active devices.
  - `DELETE /devices/:deviceId` — revoke one of the current user's devices.
  - `GET /conversations/:conversationId/device-bundles` — for conversation members only, return active public device bundles and atomically claim at most one unused one-time prekey per device.
- Frontend API wrapper in `students_management-frontend/src/api/e2eeApi.js`.

### Important security boundary

- Private identity keys, private signed-prekeys, and ratchet/session state must remain on the client device. Do not add these to PostgreSQL or send them to Express.
- The API only transports public key material and opaque ciphertext/envelopes. It does not itself implement encryption.
- The existing `messages.content` flow still sends plaintext. Do **not** enable or advertise E2EE until the browser SDK is integrated into send, history rendering, edit/recall, attachments, notifications, search, and Socket.IO.
- Legacy messages remain untouched. E2EE activation must apply only to messages created after the activation point.
- The bundle endpoint includes active devices belonging to all current conversation members, including the caller's other devices. The client protocol must encrypt to each intended recipient device and handle revoked devices.

## Protocol SDK decision to validate

The official `@signalapp/libsignal-client` is not a browser SDK. The older `@privacyresearch/libsignal-protocol-typescript` has a browser-oriented implementation but is stale and GPL-3.0-only. A possible browser candidate is `@open-e2ee/signal-protocol-sdk`, which documents browser storage and a custom relay interface, but it is an independent implementation, not affiliated or wire-compatible with Signal Messenger, and its own docs state it has not received an independent security audit. Its license, protocol deviations, storage threat model, and relay interface must be reviewed before adopting it.

References:
- https://github.com/open-e2ee/signal-protocol-js
- https://docs.open-e2ee.dev/start/browser
- https://docs.open-e2ee.dev/reference/adapters
- https://github.com/signalapp/libsignal

## Required next implementation stage

1. Pin and review a browser-compatible protocol SDK and its license/security posture.
2. Implement its device-local encrypted store and adapter to the existing authenticated backend; do not trust user IDs supplied by the client.
3. Integrate encryption before REST/Socket.IO and decryption only on recipient devices.
4. Change message persistence/realtime payloads so the server receives only ciphertext for E2EE messages, while legacy messages remain readable.
5. Add conversation activation and explicit mixed-history UI.
6. Add multi-device, one-time-prekey concurrency, replay, revoked-device, edit/recall, file, and regression tests.
7. Run frontend build/lint, backend tests, migration against a disposable schema matching the actual DB, and protocol round-trip tests before merging.

## Validation status

The migration has not been executed against the user's PostgreSQL database. No build, lint, or automated tests have been run in the remote repository environment. This branch must be reviewed and tested before merge.
