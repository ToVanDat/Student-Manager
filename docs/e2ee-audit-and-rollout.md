# E2EE audit and rollout plan

Branch audited: `feature/chat-1to1-complete`

## Status

This commit records the source audit and implementation plan only. It does **not** activate E2EE, change the database, install a crypto package, or claim production-ready encryption.

## Findings from the current source

- Frontend message API sends `{ conversationId, content, replyToMessageId }` to `POST /api/messages`; edits send `{ content }` to `PATCH /api/messages/:messageId`.
- Backend routes are in `students_managerment-api/router/messageRouter.js`; message validation and conversation-membership checks are in `service/messageService.js`.
- `repository/messageRepository.js` writes message bodies into `messages.content`, returns message content in history/reply data, and searches with PostgreSQL `ILIKE` against `m.content`.
- REST sends `message:new` and `conversation:updated` events in `controller/messageController.js`.
- Socket.IO has a separate `message:send` handler in `src/socket/socket.js` that also calls `messageService.createMessage` and broadcasts the stored message. Both REST and Socket.IO paths must enforce the same E2EE envelope validation.
- Existing features that depend on plaintext include server-side search, reply previews, edits, conversation last-message previews, and notification payload generation. These must not accidentally expose ciphertext as human-readable text or assume ciphertext is plaintext.
- Existing migration files include `sql/chat_features.sql`; do not rerun/recreate chat tables blindly. No schema change is made in this audit commit.

## Security and compatibility requirements

1. Preserve existing messages as plaintext legacy messages. New messages become E2EE only after the conversation has completed a device/key readiness check. Represent the format/version explicitly; never infer encryption from a string prefix.
2. Encrypt in the browser before either REST or Socket.IO transport. The API and database may route/store ciphertext and public routing metadata only; they must not hold device private keys or decrypt message bodies.
3. Keep the legacy history readable. Do not retroactively encrypt old records unless a separate, explicit migration/re-encryption feature is designed.
4. Multi-device means each device has its own cryptographic identity/session state. Private identity/session keys stay device-local. Device registration, public identity/prekey publication, revocation, new-device trust, and recovery are separate requirements; account login alone must not silently clone private keys.
5. E2EE message search must be client-side for decrypted messages. Server-side `ILIKE` search cannot search ciphertext. Legacy plaintext messages can continue to use existing server search.
6. Reply previews should resolve/decrypt the referenced message on the client. Server push/notification previews for E2EE messages must use generic text such as “Tin nhắn được mã hóa”, never message plaintext.
7. Edit, recall, delete, reactions, read receipts, typing, presence, and group membership metadata are not all automatically hidden by E2EE. Document what metadata remains visible. Edits must be encrypted again with the established protocol session; don't send plaintext in the edit endpoint.
8. Attachments require a separate client-side encryption design (unique content key, authenticated encryption, encrypted bytes uploaded as opaque blobs, and the content key delivered inside the E2EE message). Existing file optimization must run before encryption, not on ciphertext.
9. Do not introduce a custom cryptographic protocol or use AES-GCM alone as a substitute for a ratcheting messaging protocol.
10. Roll out behind an explicit feature flag and fail closed for a conversation once marked E2EE: do not silently fall back to plaintext if key/session setup or decryption fails.

## Protocol/library evaluation

The official `@signalapp/libsignal-client` repository describes TypeScript bindings but says external use is unsupported and APIs may change. It is not the straightforward browser choice for this React/Vite application. See https://github.com/signalapp/libsignal.

`@open-e2ee/signal-protocol-sdk` advertises a browser TypeScript implementation, browser-local stores, multi-device support, and encrypted messaging. Its own documentation says it is an independent implementation of a versioned Signal Protocol profile, is not affiliated with Signal Messenger, and is not wire-compatible with Signal Messenger/libsignal. The documentation also notes browser-origin JavaScript can access same-origin key storage and the implementation has not had an independent firm audit. These are evaluation findings, not a security endorsement. Sources:
- https://www.npmjs.com/package/@open-e2ee/signal-protocol-sdk
- https://docs.open-e2ee.dev/start/browser
- https://github.com/signalapp/libsignal

Recommendation: run a small isolated browser proof-of-concept against a pinned SDK version and verify license, key-store behavior, two-device sessions, replay/out-of-order handling, and interoperability needs before adding it to the production frontend. Do not promise compatibility with Signal Messenger.

## Implementation sequence

### Phase 1 — protocol proof-of-concept (no production traffic)
- Pin the candidate package version and record its license/version.
- Implement a local browser-only two-identity round trip using the SDK's documented browser storage adapter.
- Test reload persistence, two devices for one account, session establishment, tampered ciphertext, duplicate/replayed envelope, and decrypt failure.
- Confirm the project build supports the SDK's browser/WASM/CSP requirements.

### Phase 2 — minimal backend/device schema design
After inspecting the live schema and the SDK adapter contracts, prepare a separate migration with only missing objects. Expected concepts (not yet committed as SQL): registered devices, public identity/prekeys, device revocation, conversation E2EE state/version, and message envelope/version metadata. Never store private keys in PostgreSQL.

### Phase 3 — 1-to-1 integration behind feature flag
- Add authenticated device/key publication and fetch endpoints with rate limits, membership checks, input-size limits, and one-time-prekey consumption.
- Define one envelope format shared by REST and Socket.IO; validate envelope structure and size server-side without decrypting it.
- Keep old messages as legacy plaintext; only send encrypted messages after both parties' devices are ready.
- Adapt edit/reply/search/last-message/push notification behavior and provide client-side decryption/error states.
- Add integration tests for mixed legacy/E2EE history and REST/Socket.IO parity.

### Phase 4 — production readiness and groups
- Review threat model, backup/recovery and new-device verification UX, key rotation/revocation, spam/abuse handling, observability that never logs plaintext, and independent security review.
- Add group encryption only after 1-to-1 multi-device correctness is proven; group membership changes must trigger the protocol's required key/session updates.
- Add encrypted attachments only after the message protocol and key distribution are stable.

## Acceptance criteria before enabling for users

- Database/API/logs/push payloads contain no E2EE plaintext or private key material.
- REST and Socket.IO cannot bypass envelope validation or silently downgrade E2EE.
- Existing legacy messages remain visible and are not modified.
- Two devices belonging to one account can send and decrypt, while revoked devices cannot fetch new key material.
- Tampering, invalid envelope, missing session, and failed decryption show an explicit error and never display ciphertext as if it were plaintext.
- Search, reply, edit, notifications, reconnect, and pagination have tests for both legacy and E2EE messages.
- Frontend build, backend test suite, and migration tests are run and their actual results recorded before rollout.


## Updated package verification (2026-10-18)

The current npm versions page and the SDK GitHub repository now agree that `@open-e2ee/signal-protocol-sdk@11.0.0` is the latest tag and that this version is dual-licensed `MIT OR Apache-2.0`. The npm versions page still shows older releases (including `2.0.2`) with different license metadata; do not use an older version or an unpinned install. Pin `11.0.0` explicitly if and only if the isolated proof-of-concept is approved after review. Sources:
- https://www.npmjs.com/package/@open-e2ee/signal-protocol-sdk?activeTab=versions
- https://github.com/open-e2ee/signal-protocol-js (package.json at the repository's current release)
- https://docs.open-e2ee.dev/start/browser

Important limitations remain:
- This is an independent implementation of a versioned Signal Protocol profile; it is not affiliated with Signal Messenger and is not wire-compatible with Signal Messenger/libsignal.
- The project states that it has not received an independent firm security audit. The package has been published very recently, so it should not be treated as a proven drop-in dependency solely because the license/version metadata now matches.
- Browser storage is not an absolute secret boundary: same-origin JavaScript can access data and keys. The web SQLite adapter needs OPFS and a CSP allowing `wasm-unsafe-eval`; IndexedDB fallback also requires a threat-model review.
- The Student-Manager repository is available to this workflow through GitHub file APIs, but this environment does not provide the local checkout, npm install/build runtime, or connected PostgreSQL instance needed to execute the browser two-device round-trip or inspect the live schema.

Decision: the candidate's version and license metadata discrepancy is resolved for `11.0.0`, but the implementation gate is **not** passed. No SDK dependency, production source, or database migration has been committed. Next implementation step is an isolated browser-only proof-of-concept in a real checkout, pinned to `11.0.0`, with two independent device stores; verify round-trip, reload persistence, tampering/decrypt failure, duplicate/out-of-order delivery, CSP/build compatibility, and the SDK's adapter/API behavior before integrating it into REST or Socket.IO.
