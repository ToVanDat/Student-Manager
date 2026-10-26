# E2EE API contract v1 (design only; not enabled)

Branch: `feature/chat-1to1-complete`

This document is a contract for implementing 1-to-1 E2EE in Student-Manager. It is not a migration or a claim that these endpoints exist. Do not expose them to clients until the SDK proof-of-concept, live schema audit, authorization tests, and integration tests pass.

## Non-negotiable boundaries

- The browser owns plaintext, identity private keys, prekey private halves, sessions, and ratchet state.
- The API and PostgreSQL store only public device/key material, opaque protocol envelopes, and routing metadata for E2EE messages.
- Existing rows remain legacy plaintext and are not rewritten.
- A conversation marked E2EE must fail closed. Never retry a failed encrypted send as plaintext.
- REST and Socket.IO must call the same validation/service boundary.
- Do not log message bodies, ciphertext blobs, private keys, access assertions, or prekey secrets.

## Envelope version

Use a separate, explicit message format discriminator; never infer encryption from a string prefix.

Legacy message:
```json
{ "format": "legacy", "content": "existing plaintext" }
```

E2EE message concept:
```json
{
  "format": "e2ee",
  "protocol": "open-e2ee-signal-profile",
  "protocolVersion": 1,
  "conversationId": "server-authorized-conversation-id",
  "clientMessageId": "random-idempotency-id",
  "envelope": {
    "recipientDeviceId": "registered-public-device-id",
    "type": "protocol-defined-envelope-type",
    "ciphertext": "base64-or-sdk-defined-encoding"
  }
}
```

This is a wire-contract sketch, not the SDK's final envelope type. Before implementation, replace the sketch with the exact pinned SDK types and serialize/validate those types without hand-editing cryptographic fields. The server must enforce a maximum body size and allowlist protocol version, message type, and required fields.

## Proposed endpoint responsibilities

These are proposed routes, not existing endpoints.

- `POST /api/e2ee/devices`: authenticate the current session; register a device public identity and public prekeys; never accept private key material.
- `GET /api/e2ee/devices?userId=...`: return only public, non-revoked device/key bundles allowed by policy.
- `POST /api/e2ee/devices/:deviceId/revoke`: allow only the authenticated account owner or authorized recovery workflow to revoke a device.
- `POST /api/e2ee/conversations/:conversationId/enable`: require conversation membership and readiness of every required recipient device; persist protocol/version state only after key readiness succeeds.
- Existing `POST /api/messages` and Socket.IO `message:send`: accept either legacy format for non-E2EE conversations or a validated E2EE envelope for E2EE conversations; reject plaintext in an E2EE conversation.
- Existing history endpoint: return legacy messages unchanged and E2EE envelopes as opaque payloads with an explicit format/version.
- Existing edit endpoint: for E2EE messages, accept only a newly encrypted SDK envelope; never accept plaintext.
- Existing search endpoint: continue legacy plaintext search only. E2EE search must search decrypted content on the client.

Endpoint names may be adjusted after checking route conventions and current authorization middleware. Do not create duplicates if an equivalent route or schema object already exists.

## Persistence concepts to verify against live PostgreSQL first

Potential concepts only; exact table/column names and constraints are deliberately not specified until the live schema and migration history are inspected:

1. Per-account registered devices: stable device ID, account FK, public identity key/fingerprint, timestamps, revocation timestamp/status.
2. Public signed/one-time prekeys: device FK, key ID, public key material, signature, consumed timestamp for one-time prekeys. One-time-prekey consumption must be atomic.
3. Conversation E2EE state: conversation FK, protocol/profile version, activation state and timestamp.
4. Message format/version metadata and an opaque envelope payload if the current `messages.content` contract cannot represent both formats safely. Preserve all existing records and defaults.
5. Idempotency key unique per sender device to prevent duplicate envelope insertion on reconnect/retry.

Never store identity private keys, prekey private halves, plaintext backups, or decrypted search indexes in PostgreSQL.

## Integration gates

1. SDK version pinned exactly to `@open-e2ee/signal-protocol-sdk@11.0.0`; check lockfile integrity and license in the actual checkout.
2. Isolated browser round-trip with independent sender/recipient device stores and SDK-supported relay/transport; test tampering, reload persistence, duplicates, out-of-order delivery, and decryption failure.
3. Inspect live schema and every existing migration before authoring SQL. Migration must be additive and idempotent where project conventions require it; no table recreation or data deletion.
4. Unit-test one shared service validator through both REST and Socket.IO.
5. Integration-test mixed legacy/E2EE history, two devices per account, revocation, reply/edit/search, notification preview redaction, pagination and reconnect.
6. Run frontend build, backend tests, migration tests, and security checks in the real checkout. Record actual outcomes.
7. Keep rollout disabled until all gates pass.

## Current status

The current workflow has GitHub file access but no local project checkout, npm runtime, or connected PostgreSQL database. Therefore this contract can be reviewed and committed, but the SDK round-trip, schema inspection, code integration, migrations, and builds cannot be honestly marked complete here. No production E2EE behavior is enabled by this document.
