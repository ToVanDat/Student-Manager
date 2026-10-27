# E2EE Provisioning Proof: SDK Fork Contract

Date: 2026-10-27
Status: implementation contract; not yet implemented.

## Compatibility boundary

The application uses the SDK 11.0.0 cross-browser provisioning API. Upstream 12.0.0 removed `./device/provisioning`, `ProvisioningService`, and the provisioning relay methods; 13.3.0 uses a different managed-link architecture. Keep the existing v11 flow and add the proof protocol in a narrowly scoped, source-built fork.

## Wire protocol v1

All proof byte strings are canonical standard Base64 (RFC 4648, padded). Decoders MUST decode and re-encode to confirm canonical form. All challenges, commitments, and proofs are exactly 32 bytes.

### Challenge and transcript

After the new device connects and both ephemeral public keys are known, the relay creates a cryptographically random 32-byte challenge bound to the session and expires it with the session. The existing status/message read returns the challenge to both authenticated primary and session-bound new device; it MUST NOT return the primary commitment.

The canonical transcript is binary and length-delimited, not JSON:

1. Fixed ASCII domain: `StudentManager/E2EE/ProvisioningTranscript/v1`.
2. Protocol version as one unsigned byte (`0x01`).
3. Session ID as UTF-8, prefixed by a 32-bit unsigned big-endian byte length.
4. Challenge (exactly 32 bytes).
5. Primary ephemeral X25519 public key (exactly 32 bytes).
6. New-device ephemeral X25519 public key (exactly 32 bytes).
7. SHA-256 digest of the exact UTF-8 encrypted-message string accepted by the relay (exactly 32 bytes).

Field order and lengths are fixed. Reject malformed encodings and invalid public-key lengths before cryptographic operations.

### Proof derivation

Both SDK peers derive the existing X25519 ECDH shared secret. Then:

```text
salt      = SHA-256(ASCII("StudentManager/E2EE/ProvisioningSalt/v1") || challenge || UTF8(sessionId))
K_proof   = HKDF-SHA256(sharedSecret, salt, ASCII("StudentManager/E2EE/ProvisioningProof/v1"), 32)
proof     = HMAC-SHA256(K_proof, canonicalTranscript)
```

The proof is 32 bytes. It is a proof of possession of the ECDH-derived secret bound to this transcript, not remote attestation. The SDK only exposes proof bytes to its typed relay method; it never exposes sharedSecret, K_proof, AES key, or decrypted identity payload through an application callback.

## Typed SDK relay contract

Extend `ProvisioningService` without changing the existing app-level provisioning function signatures where avoidable:

- `getProvisioningMessage(sessionId)` returns optional `proofProtocolVersion: 1` and `proofChallenge: string` once both ephemeral public keys are registered. It never returns the commitment.
- `sendProvisioningMessage(sessionId, encryptedMessage, userId, proofCommitment)` submits the encrypted payload and primary commitment together. The SDK computes the commitment only after it has constructed the exact ciphertext string whose digest enters the transcript.
- `acknowledgeProvisioning(sessionId, proof)` submits the new-device proof using the existing linked-device credential supplied by the adapter. The proof is created inside `receiveProvisioningMessage()` only after AES-GCM authentication, JSON parsing, and strict payload validation (including ACI identity and required key-field validation).

The existing ordering remains: server-side `completeProvisioning()` creates a reversible `linked_pending_ack` device and returns its credential; local bootstrap writes complete; then the SDK calls proof-bearing ACK. The relay activates the device only after validating the proof. Any proof/ACK failure follows the existing rollback journal.

## Relay/backend invariants

- The challenge is random, one-time, session-bound, expiry-bound, and never reused.
- The relay stores the primary commitment and the digest of the exact ciphertext, but never returns the commitment to the new device.
- At proof ACK, lock the provisioning session and linked device row in one transaction. Check owner, session, device, state, expiry, protocol version, challenge, and transcript binding. Compare equal-length 32-byte values with `crypto.timingSafeEqual`.
- Consume the challenge and activate the device in the same transaction. A replay, missing proof, malformed proof, wrong transcript, expired challenge, or terminal session must fail closed.
- Owner abort and proof ACK race on the same locked session row. If abort wins, proof cannot activate. If ACK wins, abort returns already-completed and must not revoke the active device.
- Idempotent ACK retries after a lost response may return the same completed result only for the same session/device/proof digest; do not permit another device or transcript to reuse it.

## Fork-specific code review notes

The v11 primary `provisionDevice()` currently wipes ECDH shared-secret and AES-key buffers only on its success path. The fork must move cleanup to `finally` so errors after derivation also wipe them. It must also wipe the plaintext byte buffer after encryption where possible. JavaScript strings and object copies cannot be reliably zeroized; keep them short-lived and never log them. The receive flow already wipes shared-secret and decryption-key buffers in `finally`; extend that cleanup to the derived proof key and temporary proof buffers.

Use the SDK's existing internal Noble/WebCrypto primitives rather than adding a second crypto stack. Add SDK unit tests before integrating any backend endpoint.

## Implementation gates

1. Fork exact upstream tag and commit; preserve MIT/Apache notices and source attribution.
2. Add transcript encoder and proof derivation with independent test vectors.
3. Extend SDK relay types and provisioning code; run SDK typecheck/build/tests.
4. Implement backend challenge/commitment/proof transaction and ephemeral-PostgreSQL tests.
5. Integrate the pinned SDK artifact and adapter wire methods.
6. Run current frontend, API, R2, migration-smoke, and browser fault-injection suites.
7. Enable only when client and server both advertise protocol v1. No silent legacy-ACK fallback for sessions requiring proof.

No fork, code change, schema migration, or runtime test is included in this contract.
