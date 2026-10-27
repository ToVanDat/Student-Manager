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

## Existing application relay integration audit (2026-10-27)

The current backend already has an authenticated account-scoped route:
`GET /provisioning/:sessionId/message`. Its repository response currently contains status, encrypted message, the new-device ephemeral public key, and expiry. The router applies `authMiddleware`; the controller passes the authenticated account ID to the service and repository. This is a viable place to expose the v1 challenge to both browser contexts, provided both are already authenticated as the same account under the existing application flow.

The existing primary-to-relay write is:
`POST /provisioning/:sessionId/message`, which currently stores only `encrypted_message` and moves `connected -> ready`. It must become an atomic write of ciphertext, protocol version, challenge-bound primary commitment, and transcript digest. Validate that the session has both ephemeral keys and an unexpired challenge before transitioning to ready.

The existing new-device ACK is:
`POST /provisioning/:sessionId/ack`, authenticated with `X-E2EE-Device-Token`. This is the correct place to carry the proof. The repository currently activates the linked device on ACK; that activation must be gated on proof verification in the same transaction, not in a preflight read followed by a separate update.

The existing owner-abort route remains separate and must continue to serialize with proof ACK by locking the same provisioning-session row.

### Integration details that must not be overlooked

- The challenge must be created when the new-device ephemeral public key is accepted, not when the session is first created (the second public key is not yet known then).
- Challenge issuance and the `waiting -> connected` transition must be atomic. A repeated connect request must not replace the challenge or the bound public key.
- The primary needs the challenge and the new-device public key before it calls `provisionDevice()`; the current SDK relay contract has no explicit challenge method, so the fork must add one or formally extend the existing status read used by the primary.
- The new device receives the same challenge and public keys through the same session-bound read, alongside ciphertext when ready.
- The owner commitment must not be returned by the GET route. Only the new-device proof is submitted to ACK.
- The current route-level account authentication is not a substitute for device-token authentication at ACK. Keep the token check and bind the token to the exact pending device/session.
- A proof-enabled session must reject legacy ACKs. A legacy session must not accidentally be treated as proof-enabled based on client-supplied flags.

## Staged backend implementation status (2026-10-27)

The application backend now contains an opt-in protocol-v1 path; it does not enable it for the current frontend:

- `POST /provisioning` accepts `proofProtocolVersion: 1`; omitted version continues to create a legacy session.
- `connect` creates a random 32-byte challenge atomically with the first `waiting -> connected` transition. The challenge is returned to the connecting device and to the authenticated account's message/status read. A repeated connect cannot rotate it.
- `POST /message` requires a canonical 32-byte `proofCommitment` for v1 sessions and atomically stores it with the exact ciphertext SHA-256 digest. Legacy sessions reject a commitment.
- `GET /message` exposes the protocol version and challenge but never the primary commitment.
- `complete` refuses to reserve a pending device for a v1 session unless challenge, commitment, and ciphertext digest are present.
- `POST /ack` accepts the proof in the JSON body while retaining the per-device credential header. In one transaction it locks the session, validates the proof against the stored commitment with constant-time comparison, checks the stored ciphertext digest, activates the device, consumes the challenge, and records the ACK digest.
- Same-proof ACK retries are idempotent only for the same active device credential. A different proof conflicts. Owner abort still serializes on the same session row.
- Expiry and rollback scrub challenge/commitment/ciphertext-digest material. The ACK digest is retained for completed-session retry validation.
- The additive migration is `students_managerment-api/sql/e2ee_provisioning_proof_v1_migration.sql`. It is not applied to any persistent database.

This backend gate does not independently recompute the HMAC: the server cannot derive the ECDH shared secret. It verifies that the receiver submitted the exact commitment created by the primary, while the SDK must ensure that commitment/proof are HMACs over the canonical transcript. A malicious or compromised client can lie about having completed local decryption; this protocol is not remote attestation.

The frontend currently does not request protocol v1 and still uses the upstream v11 SDK. Do not enable v1 until the source fork, SDK build, deterministic vector, and two-browser interoperability tests pass.

Backend verification record: commit `a127b9c3bbf30be87bf84b292becb2e5b36d2b55` passed API unit tests, live PostgreSQL relay integration (including invalid-proof non-activation, valid-proof activation, challenge consumption, same-proof retry, and different-proof conflict), migration idempotency smoke, frontend lint/build, and frontend E2EE tests. This does not prove SDK interoperability because the patched SDK is not yet available.

Deployment ordering is strict: apply and verify `students_managerment-api/sql/e2ee_provisioning_proof_v1_migration.sql` on the target database before deploying this backend revision. The repository queries now include the new columns even for legacy sessions; deploying the backend before the additive migration will break provisioning endpoints. The migration has only been exercised on disposable CI PostgreSQL databases and has not been applied to the user's local or production database.
