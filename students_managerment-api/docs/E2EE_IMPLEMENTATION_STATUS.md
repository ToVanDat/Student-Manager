# E2EE implementation notes — Student-Manager

## Current scope on this branch

This branch is an incremental backend foundation. It is **not yet a complete or enabled E2EE implementation**.

### Added

- Additive PostgreSQL migration for per-device public identity/prekey material, one-time prekeys, per-recipient message envelopes, and conversation E2EE settings.
- Authenticated API routes under `/api/e2ee`:
  - `POST /devices` — register/update the current user's public device bundle and upload one-time public prekeys.
  - `GET /devices` — list the current user's active devices.
  - `DELETE /devices/:deviceId` — revoke one of the current user's devices.
  - `GET /conversations/:conversationId/device-bundles` — for conversation members only, return active public device bundles and claim at most one unused one-time prekey per device.
- Frontend API wrapper in `students_management-frontend/src/api/e2eeApi.js`.

### Hardening performed in this pass

- Fixed a malformed template string in the frontend device-bundle API URL.
- A device ID is now bound to its first identity public key; registration rejects an unexpected identity-key change with HTTP 409 rather than silently overwriting the trust identity.
- Normal registration cannot reactivate a revoked device ID; a reinstalled/recovered client must register a new device ID and use a separately designed trust/recovery flow.
- Re-uploading the same one-time prekey ID no longer clears its claimed state, preventing a claimed prekey from being reused by accidental bundle re-registration.
- Removed a redundant/ineffective condition from the own-device listing query.

## Important security boundary

- Private identity keys, private signed-prekeys, and ratchet/session state must remain on the client device. Do not add these to PostgreSQL or send them to Express.
- The API only transports public key material and opaque ciphertext/envelopes. It does not itself implement encryption.
- The existing `messages.content` flow still sends plaintext. Do **not** enable or advertise E2EE until a browser protocol SDK is integrated into send, history rendering, edit/recall, attachments, notifications, search, and Socket.IO.
- Legacy messages remain untouched. E2EE activation must apply only to messages created after the activation point.
- The bundle endpoint includes active devices belonging to all current conversation members, including the caller's other devices. The client protocol must encrypt to each intended recipient device and handle revoked devices.
- These endpoints are not yet a complete adapter for a production Signal-protocol SDK. Do not connect an SDK to them until the SDK's relay contract, identity assertions, message envelope format, prekey lifecycle, and per-device delivery/acknowledgement semantics are implemented and tested.

## Protocol SDK decision to validate

A browser-compatible option worth evaluating is `@open-e2ee/signal-protocol-sdk`. Its current docs describe browser-local stores and a custom relay interface. It is an independent implementation/profile, not affiliated or wire-compatible with Signal Messenger/libsignal. Review the exact package version, license, protocol deviations, storage threat model, and independent audit status before adopting it. Do not treat package documentation as a security audit.

References:
- https://github.com/open-e2ee/signal-protocol-js
- https://docs.open-e2ee.dev/start/browser
- https://docs.open-e2ee.dev/reference/adapters
- https://github.com/signalapp/libsignal

## Additional plaintext guard added

The existing REST message-create controller and Socket.IO `message:send` event now check the conversation's E2EE activation record and reject legacy plaintext sends with an explicit `E2EE_REQUIRED` response. Before the migration exists, the repository checks `to_regclass` and leaves legacy behavior unchanged. This is a guard only: there is still no E2EE activation endpoint or encrypted send/receive relay, so it does not enable E2EE by itself.

## Required next implementation stage

1. Pin a specific browser SDK version and complete license/security review before installing it.
2. Implement its device-local store and adapter to the existing authenticated backend; do not trust user IDs supplied by the client.
3. Design and implement the SDK-compatible relay contract, including identity assertions, envelope fan-out, acknowledgements, prekey replenishment, and device revocation semantics.
4. Integrate encryption before REST/Socket.IO and decryption only on recipient devices.
5. Change message persistence/realtime payloads so the server receives only ciphertext for E2EE messages, while legacy messages remain readable.
6. Add conversation activation and explicit mixed-history UI.
7. Add multi-device, one-time-prekey concurrency, replay, revoked-device, edit/recall, file, and regression tests.
8. Run frontend build/lint, backend tests, migration against a disposable schema matching the actual DB, and protocol round-trip tests before merging.

## Validation status

The migration has not been executed against the user's PostgreSQL database. No build, lint, or automated tests have been run in the remote repository environment. This branch must be reviewed and tested before merge.
