# E2EE Provisioning Proof v1 — SDK Source Patch Map

Baseline: upstream `open-e2ee/signal-protocol-js` tag `v11.0.0` (MIT OR Apache-2.0).
Inspected upstream files:
- `device/provisioning.ts`
- `remote/relay/types.ts`
- `internal/crypto/index.ts`
- `device/index.ts`

This document is an implementation map, not a claim that the SDK has been patched or integrated.

## Confirmed source behavior

### Primary device: `device/provisioning.ts::provisionDevice`
- Collects identity keys and optional group master keys.
- Builds the serialized payload.
- Computes ECDH shared secret with `crypto.computeSharedSecret`.
- Derives the existing AES-GCM key with `crypto.hkdf`.
- Encrypts JSON with `crypto.aesGcmEncrypt`.
- Sends only the encrypted JSON through `relay.sendProvisioningMessage(sessionId, JSON.stringify(encrypted), userId)`.
- Wipes `sharedSecret` and `encryptionKey` only after the relay call succeeds. The catch path does not wipe them. Move both buffers to nullable outer variables and wipe them in `finally`. Wipe the plaintext byte buffer in `finally` too; note that the JS JSON string and object copies cannot be reliably zeroized.

### New device: `device/provisioning.ts::receiveProvisioningMessage`
- Reads `relay.getProvisioningMessage(sessionId)`.
- Derives ECDH secret and AES key, then calls `crypto.aesGcmDecrypt`.
- Parses JSON and currently validates only that `identityKeys.aci` exists before proceeding to device-name encryption and server completion.
- Calls `relay.completeProvisioning` before writing identity keys, local device state, username state, and group keys.
- Calls `relay.acknowledgeProvisioning(sessionId)` after local writes.
- Its `finally` already wipes shared secret and decryption key.
- The current ACK contains no proof and is therefore only a lifecycle acknowledgment.

### Crypto primitives already available inside the SDK
`internal/crypto/index.ts` exports:
- `hkdf`
- `hmac`
- `sha256`
- `concatBytes`
- `stringToBytes`
- `bytesToString`
- `base64ToBytes`, `bytesToBase64`
- `constantTimeEqual`
- `secureZeroBytes`

Use these existing SDK primitives. Do not add a second cryptographic implementation to the application adapter.

### Relay type gap: `remote/relay/types.ts::ProvisioningService`
The current interface has no protocol-version challenge, no primary commitment, and no proof argument to ACK. The source fork must change the interface and implementation together; an adapter-only shim cannot establish proof because it cannot access the SDK's ECDH secret.

## Required SDK patch shape

1. Add a required proof-capability object to the provisioning context returned to both authenticated account sessions. It must include protocol version 1 and a canonical 32-byte challenge. It must not expose the primary commitment to the new device.
2. Bind the primary and new-device ephemeral public keys to the challenge and session transcript. Reject malformed/non-canonical 32-byte public keys before deriving proof material.
3. In `provisionDevice`, after the exact encrypted JSON string is formed, compute SHA-256 over its UTF-8 bytes and the primary commitment:
   `HMAC-SHA256(K_proof, canonicalTranscript)`.
   Send ciphertext, protocol version, and commitment in one relay operation. The exact ciphertext string accepted by the relay is the value hashed.
4. In `receiveProvisioningMessage`, after AES-GCM authentication, JSON parsing, and strict validation of all required identity-key fields, derive the proof from the same ECDH shared secret and transcript. Do not compute or send proof on any earlier path.
5. Complete the existing local bootstrap writes, then call `acknowledgeProvisioning(sessionId, proof)`. The relay adapter must continue authenticating this call with the new device's per-device credential.
6. The backend verifies proof against the stored primary commitment and activates the linked device in the same database transaction. Challenge consumption and device activation must be atomic.
7. Move primary shared-secret, AES-key, and plaintext-byte cleanup into `finally`, matching the receiver's cleanup discipline.

The exact transcript, HKDF labels, HMAC construction, canonical base64 rules, and deterministic test vector are specified in:
- `E2EE_PROVISIONING_PROOF_SDK_FORK_CONTRACT.md`
- `E2EE_PROVISIONING_PROOF_V1_TEST_VECTOR.md`

## Strict payload validation still required

Before generating proof, the receiver must validate:
- `userId` equals the authenticated account/session owner expected by the relay contract.
- `identityKeys.aci` exists and contains canonical base64 public/private key material of the expected lengths.
- Every present `pni` identity has the same complete structure and valid registration ID.
- Registration IDs are safe integers in the SDK's accepted range.
- `userProfile` is an object with bounded optional string fields.
- `groupMasterKeys`, when present, is an array with bounded count, unique non-empty group IDs, and canonical key encoding/length.
- No unexpected or duplicate serialized fields are accepted where the parser can detect them.

Do not log plaintext, private keys, shared secrets, proof keys, proof bytes, or the provisioning payload.

## Compatibility and rollout rules

- Keep SDK v11 provisioning as the compatibility baseline. SDK v12 removed the legacy `./device/provisioning` surface and is not a drop-in upgrade for this app's two-browser relay workflow.
- Pin the fork to an immutable commit or exact package version. Never depend on a moving branch.
- New proof-enabled sessions must reject legacy ACK. Do not downgrade silently if challenge/proof data is absent.
- Existing sessions created before proof mode can finish only under the explicitly retained legacy policy and must not be mislabeled proof-verified.
- Do not activate a device on `completeProvisioning`; completion may reserve a reversible pending device, but activation must occur only after proof verification and local-state ACK.
- Owner-authenticated abort and proof ACK must lock the same provisioning-session row so only one terminal outcome wins.
- Do not apply a database migration until the current schema, migration ordering, deployment rollback strategy, and PostgreSQL integration tests have been inspected.

## Acceptance gates before production enablement

- SDK unit tests for transcript serialization, canonical base64, HKDF, HMAC, ciphertext binding, and malformed inputs.
- SDK integration tests proving no proof is emitted when AES-GCM authentication or strict payload validation fails.
- Backend tests for wrong proof, wrong session, changed ciphertext, changed ephemeral key, expired challenge, replay, duplicate ACK, lost ACK response, and ACK-vs-abort races.
- PostgreSQL integration tests verify proof check + activation + challenge consumption are one transaction.
- Browser fault-injection tests cover lost complete response, lost ACK response, reload on either browser, owner abort retry, and device-token loss.
- Only after all gates pass may the proof protocol be enabled for new production sessions.

## Current completion status

- Source audit: complete for the files listed above.
- Proof protocol and deterministic vector: specified in the companion documents.
- Upstream SDK source fork: not created; the available GitHub integration cannot create a repository/fork.
- SDK source patch: not applied; the frontend still uses the pinned upstream v11.0.0 package.
- Backend: an opt-in proof-v1 persistence and ACK gate has been implemented on the application branch. It stores a 32-byte challenge, primary commitment, exact-ciphertext SHA-256 digest, proof-consumption timestamp, and ACK digest. The primary commitment is never returned by the message-read endpoint. Proof-enabled sessions reject missing proofs; invalid proofs do not activate the pending device. ACK and owner abort continue to lock the same session row.
- Additive migration: `students_managerment-api/sql/e2ee_provisioning_proof_v1_migration.sql`; it has not been applied to any user or production database. CI migration-smoke and PostgreSQL integration are configured to apply it only to disposable test databases.
- Backend verification is a constant-time equality check of the receiver's proof against the primary's stored commitment, plus a re-check of the stored ciphertext digest. The server does not possess the ECDH secret and cannot independently derive the HMAC. Correct transcript construction and post-decryption proof generation remain SDK responsibilities; this is not remote attestation.
- Frontend adapter does not request proof protocol v1 yet. Existing sessions remain legacy; do not enable v1 from the UI until the patched SDK is built, pinned, and proven interoperable.
- Backend CI at commit `a127b9c3bbf30be87bf84b292becb2e5b36d2b55`: API unit tests, PostgreSQL relay integration (including proof v1 activation/replay), migration idempotency smoke, frontend lint/build, and E2EE frontend tests all passed. This validates the staged backend path, not the unimplemented SDK fork or browser interoperability.


## Backend schema baseline inspected

The current repository's `students_managerment-api/sql/e2ee_foundation_migration.sql` creates `e2ee_sdk_provisioning_sessions` with:
- `owner_ephemeral_public_key`
- `new_device_ephemeral_public_key`
- `encrypted_message`
- status, owner, assigned device, expiry and completion timestamps

It has no protocol-version, challenge, primary-commitment, ciphertext-digest, or proof-consumption columns. The integration test loads this foundation migration into a disposable database before running repository flows.

The current repository writes only the encrypted message in `sendProvisioningMessage`; `getProvisioningMessage` returns the ciphertext and new-device ephemeral public key; `acknowledgeProvisioning` validates the per-device token, then activates the disabled device and marks the session completed. This confirms the exact persistence gap described above.

A future additive migration will need, at minimum, nullable versioned fields for the challenge, primary commitment, and ciphertext digest, plus a consumed/verified marker or equivalent state. The final shape must be chosen after checking all migration entry points and production schema drift. Do not add these columns to the existing foundation migration: it is already an established migration and changing it risks breaking deployed databases. Do not apply any migration as part of this phase.

## Repository-level implementation seams

- `connectNewDevice`: generate and persist the challenge atomically with the first `waiting -> connected` transition; a repeated connect must not rotate it.
- `sendProvisioningMessage`: accept and persist protocol version, primary commitment, ciphertext digest, and encrypted message atomically with `connected -> ready`.
- `getProvisioningMessage`: return protocol version/challenge and ciphertext to the authenticated account session, but never return the primary commitment.
- `acknowledgeProvisioning`: require proof for proof-enabled sessions, verify it using constant-time comparison, then activate the device and consume the challenge in the same transaction.
- `abortProvisioningSession`: preserve the existing owner-abort behavior; it already locks the same session row and must remain serialized with proof ACK.

Legacy ACK must remain unavailable to a proof-enabled session. A missing proof is not a reason to fall back to the old lifecycle-only ACK.


## Verified upstream v11.0.0 source coordinates (2026-10-27)

The upstream repository was inspected at immutable tag `v11.0.0`, not inferred from generated package declarations:

| Upstream file | Git blob SHA | Required patch |
|---|---|---|
| `device/provisioning.ts` | `2477996e0e640a3fb2a234700107b9cf1a3aea43` | Extend send/receive flow; primary commitment; receiver proof after AEAD + payload validation; secret cleanup in `finally` |
| `remote/relay/types.ts` | `87dccac08033805798c4f06a5363e9c3f7a2bb15` | Extend provisioning relay request/response contracts for challenge, commitment and proof |
| `internal/crypto/index.ts` | `8cfce5c8148be72594a7fcee565a8e93654e1a28` | Reuse SDK-owned HKDF, HMAC, SHA-256, byte concatenation, Base64 and constant-time comparison |
| `package.json` | `12b1465174991e60c6733184a06feb193817113a` | Preserve package export map and build/test scripts when publishing the patched fork |

Important source-level observations:

1. `provisionDevice()` currently calls `relay.sendProvisioningMessage(sessionId, JSON.stringify(encrypted), userId)`; the relay call has no commitment argument.
2. `receiveProvisioningMessage()` currently decrypts AES-GCM, parses JSON and checks only that ACI identity exists before calling `completeProvisioning()`. The rest of the payload is not yet strictly validated.
3. The current receiver calls `completeProvisioning()` before local identity/group state writes, then calls `acknowledgeProvisioning(sessionId)` without proof. This confirms the previously identified server activation gap.
4. The primary currently wipes `sharedSecret` and `encryptionKey` only after a successful relay send. An exception can bypass cleanup. Move byte-array cleanup to `finally`; private key parameters are Base64 strings and cannot be reliably zeroed.
5. The SDK's crypto barrel exports the required primitives, including `hkdf`, `hmac`, `sha256`, `stringToBytes`, `concatBytes`, `constantTimeEqual`, `base64ToBytes`, `bytesToBase64`, and `secureZeroBytes`. The fork should use these existing primitives rather than introduce application-side cryptography.

No upstream source files have been copied into the application repository. These blob hashes are provenance anchors for the eventual full fork patch. Do not apply backend proof enforcement until the patched SDK has built and the two-client interoperability tests pass.
