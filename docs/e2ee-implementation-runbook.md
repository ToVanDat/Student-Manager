# E2EE implementation runbook — Student-Manager

Target branch: `feature/chat-1to1-complete`
Status: preparation only; E2EE is not enabled.

## Critical architecture decision

The existing application uses PostgreSQL + Express REST + Socket.IO. The candidate SDK is not a drop-in encryption helper: its client also needs a device-local protocol store and a `SignalProtocolRelayServer` transport contract, or the SDK's hosted relay client and identity assertions. The published SDK does not provide a server implementation for a self-hosted relay. Do not assume the existing `message:send` Socket.IO event automatically implements this contract.

Before code changes, choose exactly one delivery path:

1. **Self-hosted relay adapter (preferred if all E2EE delivery must remain in Student-Manager infrastructure):** implement the SDK's documented relay contract over authenticated backend routes/Socket.IO. Must cover device registration, public identity/prekey publication, atomic one-time-prekey consumption, encrypted-envelope storage/delivery, device provisioning/sync, revocation and access policy. Review the exact pinned SDK interface/types first.
2. **Hosted relay:** use the SDK's hosted relay and identity assertion integration. This introduces an external delivery service and a new identity integration; it does not automatically reuse Student-Manager's existing chat persistence, notification, search, and conversation list behavior. Obtain deployment/privacy approval first.

Do not mix the two paths in one initial release.

## Phase A — isolated proof-of-concept

Prerequisites: local checkout, Node 22.18+ as required by the current SDK quickstart, npm access, a test browser, and a Sandbox relay environment if using the hosted client.

1. Create a separate temporary Vite test app; do not modify production package dependencies yet.
2. Pin `@open-e2ee/signal-protocol-sdk@11.0.0` and `idb` to the versions documented by the SDK. Commit the lockfile in the test app.
3. Use one independent persistent store per test identity. Do not create two browser identities by opening two default stores under the same origin/database name; the SDK browser guide warns they can share the same store. Use the documented two-identity setup or separate isolated origins/profiles.
4. Prove both directions: A sends to B, B decrypts and replies, A decrypts.
5. Reload each browser context and prove session state persists.
6. Tamper with an envelope and confirm decryption fails closed. Exercise duplicate, delayed and out-of-order delivery; confirm SDK error and retry semantics.
7. Confirm ciphertext in transport/log inspection and no plaintext or private keys in relay payloads.
8. Record actual commands, browser versions, output and failures. A documentation-only review is not a passing test.

## Phase B — Student-Manager schema audit

In the local checkout and against a backed-up development database:

1. Read every migration that defines `messages`, `conversations`, conversation members, devices/sessions and notifications.
2. Inspect the actual PostgreSQL schema and constraints; compare it with migrations before designing a new migration.
3. Identify the exact existing message ID type, sender/user FK types, conversation ID type, message body column, and cascade behavior.
4. Check if any equivalent device/key/envelope tables already exist. Add only missing structures.
5. Test migration against a disposable copy of the current database and confirm all old message rows remain byte-for-byte unchanged.

Never store device private keys, prekey private halves, ratchet state or decrypted search indexes in PostgreSQL.

## Phase C — backend relay and message integration

1. Implement device endpoints and SDK relay transport from the pinned SDK's exact types.
2. Authenticate each operation using the current access token/session; enforce conversation membership, device ownership, device revocation, request limits and envelope-size limits.
3. Consume one-time prekeys atomically and prevent duplicate client message IDs.
4. Add an explicit message format/version discriminator without guessing based on content prefixes.
5. Preserve legacy plaintext history. New E2EE messages are accepted only after conversation activation and device readiness.
6. Route REST and Socket.IO through the same service validator. An E2EE conversation rejects plaintext; there is no downgrade fallback.
7. Return opaque ciphertext to other clients. Only the sender/recipient browser SDK decrypts.
8. Redact E2EE push previews to generic text; do not send plaintext into notification providers or logs.
9. Disable server-side plaintext search for E2EE messages and add client-side search over locally decrypted content.
10. Adapt reply previews and edit flow to client-side decryption/re-encryption. Do not let edit endpoints accept plaintext for E2EE messages.
11. Keep group chat and encrypted attachments out of Phase C until 1:1 multi-device passes.

## Phase D — release gate

- [ ] SDK exact version and lockfile reviewed
- [ ] Browser round-trip and reply pass
- [ ] Reload persistence passes
- [ ] Tamper, replay/duplicate, out-of-order and missing-session failures fail closed
- [ ] Two separate devices for one account work
- [ ] Revoked device cannot fetch new prekeys or send/receive new envelopes
- [ ] REST and Socket.IO share the same E2EE validation path
- [ ] Legacy messages are unchanged and still readable
- [ ] E2EE search/reply/edit/pagination/reconnect tested
- [ ] Push payloads and logs do not contain plaintext/private keys
- [ ] Migration tested on a disposable database copy
- [ ] Frontend build, backend tests, migration tests and security review recorded
- [ ] Feature flag remains off until all checks pass

## Current environment limitation

This task session has GitHub repository file APIs but no local checkout, npm runtime, browser automation, or connected PostgreSQL instance. It can commit source/documentation changes through GitHub, but cannot truthfully run the SDK POC, inspect the live database, install a lockfile, or verify the application build. Therefore no production E2EE behavior should be enabled from this environment alone.
