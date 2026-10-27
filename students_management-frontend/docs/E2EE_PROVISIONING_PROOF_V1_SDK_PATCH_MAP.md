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
- Upstream SDK source fork: not created.
- SDK source patch: not applied.
- Backend proof verification/schema: not implemented.
- Runtime tests and CI for this work: not run.
