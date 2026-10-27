# E2EE Provisioning Cryptographic Proof Design

## Status

**Design/audit only. Not implemented.** The installed frontend dependency is
`@open-e2ee/signal-protocol-sdk@11.0.0` (confirmed by package-lock). The
upstream `v11.0.0` implementation is the protocol source of truth for this
integration.

## Verified current SDK behavior

In `device/provisioning.ts`:

1. `provisionDevice()` derives an ECDH shared secret, derives the
   `DeviceProvisioning` AES-256-GCM key with HKDF, encrypts the JSON payload,
   and sends the encrypted message.
2. `receiveProvisioningMessage()` fetches the encrypted message, derives the
   same shared secret and AES-GCM key, and calls `aesGcmDecrypt()`.
3. It parses the plaintext and checks for the required ACI identity.
4. It calls `completeProvisioning()` before persisting identity keys and local
   bootstrap state.
5. It persists identity/group/username/device state, then calls
   `acknowledgeProvisioning(sessionId)`.
6. `ProvisioningService.acknowledgeProvisioning()` accepts only the session
   ID. It receives no proof, transcript hash, or challenge response.

Therefore the current ACK is an application lifecycle signal. AES-GCM
authenticates the ciphertext locally, but the relay cannot independently
verify that the new device possessed the shared secret or that the payload was
authenticated before it accepted the ACK.

## Security property we can realistically provide

A web browser cannot remotely attest that trusted JavaScript actually executed
AES-GCM decryption. A malicious or modified client can claim that it decrypted
a payload. The server must not label a protocol response as hardware-backed or
independent proof of code execution.

The practical protocol property is **proof of possession of the session's
ECDH-derived secret**, bound to the exact provisioning transcript and a
single-use server challenge. In the honest SDK flow, the SDK must only produce
this proof after AES-GCM authentication and payload validation. This is
stronger than a boolean `decrypted: true`, but it is not remote code
attestation.

## Proposed protocol (requires SDK and backend contract changes)

### 1. Server challenge

When the new device connects, the relay creates a cryptographically random
32-byte, single-use challenge. It is bound to:
- provisioning session ID;
- primary and new-device ephemeral public keys;
- session expiry and pending state.

The challenge is made available to both authenticated primary and connected
new device through provisioning-specific methods. It must not be reusable
across sessions or after expiry.

### 2. Transcript-bound proof key

Both SDK peers already derive the same ECDH shared secret. Derive a separate
proof key using HKDF with a new domain label, not the AES encryption key:

```text
K_proof = HKDF(
  ikm  = ECDH_shared_secret,
  salt = SHA-256(challenge || sessionId),
  info = "StudentManager/E2EE/ProvisioningProof/v1",
  len  = 32
)
```

Construct a canonical, length-delimited transcript containing protocol
version, session ID, challenge, both ephemeral public keys, and SHA-256 of the
exact encrypted provisioning message. Compute:

```text
proof = HMAC-SHA-256(K_proof, canonicalTranscript)
```

No shared secret, AES key, private key, or plaintext is sent to the relay.
Canonical encoding and field order must be specified byte-for-byte in the
protocol implementation; do not rely on ordinary JSON serialization.

### 3. Primary commitment and new-device proof

The primary submits the expected proof over its authenticated account session
alongside the encrypted payload. The relay stores only the expected 32-byte
proof and transcript digest, scoped to the pending session.

After AES-GCM authentication and strict payload validation, the new-device
SDK computes the same proof and sends it with the ACK using its linked-device
credential. The relay compares fixed-length values with a constant-time
comparison, verifies challenge/session/transcript binding, and consumes the
challenge atomically with the ACK transition.

### 4. State machine

- `waiting/connected`: no proof accepted.
- `ready`: ciphertext and primary commitment stored; challenge is live.
- `linked_pending_ack`: server has provisionally assigned the device; proof
  must be valid before activation.
- `completed`: only reachable through one transaction that validates proof,
  checks expiry and transcript binding, consumes the challenge, and activates
  the device.
- `rolled_back/expired`: terminal; proofs are rejected.

Missing, malformed, stale, replayed, mismatched, or absent proof must fail
closed. A lost ACK response remains an unknown outcome and is reconciled using
the existing durable recovery journal.

## Required SDK API changes

The installed SDK contract currently exposes
`acknowledgeProvisioning(sessionId)` only. A safe implementation needs an
upstream SDK change or a reviewed, pinned local fork that:

1. Generates/obtains the server challenge and transcript consistently on both
   peers.
2. Computes the primary commitment inside `provisionDevice()`.
3. Computes the new-device proof only after successful AES-GCM decryption and
   required payload validation in `receiveProvisioningMessage()`.
4. Passes proof bytes to a typed relay method; does not expose ECDH shared
   secret, AES key, or plaintext to application callbacks.
5. Wipes derived proof-key byte arrays in `finally`.
6. Preserves rollback behavior if proof submission or ACK fails.

Do not monkey-patch SDK internals, reimplement its crypto primitives in the
application, or add a client-controlled boolean as a substitute.

## Backend changes required

- Add challenge and expected-proof persistence to the existing provisioning
  session state using a reviewed migration; do not apply it to a user database
  until separately approved.
- Add authenticated primary commitment and linked-device proof/ACK handling.
- Validate canonical base64 and exact 32-byte lengths.
- Use `crypto.timingSafeEqual` only after equal-length checks.
- Perform proof verification, challenge consumption, device activation, and
  session completion in one database transaction with row locking.
- Enforce owner/session/device binding, TTL, idempotency, and terminal-state
  semantics.
- Never return proof material or challenge secrets in logs.

## Test requirements before enabling

1. Valid proof activates exactly one linked device.
2. Random, truncated, non-canonical, wrong-session, wrong-device, wrong-key,
   wrong-transcript, and wrong-challenge proofs are rejected.
3. A replayed proof cannot activate a second session or repeat a terminal
   transition.
4. Challenge expiry and simultaneous ACK/abort are race-safe.
5. Lost complete/ACK/proof responses preserve journals and reconcile safely.
6. Corrupted AES-GCM tag, malformed JSON, missing ACI identity, and invalid
   group payload never reach the proof/ACK success path.
7. Integration tests run against an ephemeral PostgreSQL fixture; browser
   fault-injection tests use a disposable account.
8. Existing Signal protocol round-trip, lint, build, API, R2, and migration
   smoke tests remain green.

## Decision

Do not implement only the backend half or only the client half. The current
SDK's public interface does not expose the necessary cryptographic transcript
or a post-decryption proof hook. First agree on the typed upstream SDK API (or
a pinned local fork) and wire format, then implement client and backend
atomically with compatibility/version negotiation. Until then, retain the
current fail-closed recovery/ACK behavior and describe ACK accurately as a
lifecycle acknowledgment, not cryptographic proof.
