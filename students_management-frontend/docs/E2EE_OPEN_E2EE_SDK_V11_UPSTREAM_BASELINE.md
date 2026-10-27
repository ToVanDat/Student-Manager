# OpenE2EE SDK v11.0.0 — immutable upstream baseline

This file records the exact upstream source baseline for the provisioning-proof work. It is not a fork and does not change the installed runtime dependency.

## Upstream

- Repository: https://github.com/open-e2ee/signal-protocol-js
- Tag: `v11.0.0`
- Package: `@open-e2ee/signal-protocol-sdk@11.0.0`
- License declared by upstream package: `(MIT OR Apache-2.0)`
- Upstream source files inspected:
  - `device/provisioning.ts` — blob SHA `2477996e0e640a3fb2a234700107b9cf1a3aea43`
  - `remote/relay/types.ts` — inspected at tag `v11.0.0`
  - `internal/crypto/index.ts` — inspected at tag `v11.0.0`
  - `device/index.ts` — blob SHA `9e3c011941a096217ea6d33fa535275b4a59eebc`
  - `package.json` — blob SHA `12b1465174991e60c6733184a06feb193817113a`

## Existing SDK primitives confirmed

The v11.0.0 internal crypto barrel exports `hkdf`, `hmac`, `sha256`, `concatBytes`, `stringToBytes`, `bytesToString`, `base64ToBytes`, `bytesToBase64`, `constantTimeEqual`, and `secureZeroBytes`. The proof implementation should reuse these primitives from within the SDK source. Do not reimplement crypto in the React application.

## Required source changes (not yet applied)

1. Extend `ProvisioningService` with proof-context retrieval and proof-bearing send/ack contracts.
2. Add a typed v1 proof context and canonical transcript/proof helper within the SDK.
3. Have the primary retrieve the server-created challenge after the new device connects; bind both ephemeral public keys and the exact ciphertext digest.
4. Have the primary atomically send ciphertext, protocol version, and commitment.
5. Have the receiver verify AES-GCM and strictly validate all payload fields before deriving/sending the HMAC proof.
6. Pass proof through `acknowledgeProvisioning(sessionId, proof)`; the relay must still authenticate the per-device credential.
7. Move primary secret/key/plaintext-byte cleanup to `finally`.
8. Add SDK tests for malformed challenge/key/ciphertext, wrong transcript, invalid payload, and no-ACK/no-proof failure paths.
9. Build the SDK and run its typecheck/tests before integrating a pinned immutable artifact.

## Repository operation limitation in this work session

The connected GitHub operations available here support reading and writing files/branches in repositories the account can access, but do not expose a GitHub repository-fork/create-repository operation. Therefore an actual fork under a new repository cannot be created from this session. No fake fork, copied partial SDK, or application-level crypto shim is being represented as an SDK fork.

Safe continuation requires either:
- a GitHub fork of the upstream repository created under the user's account, after which its URL can be used as the source target; or
- an approved vendored SDK source directory in this application repository, including the complete upstream source, build scripts, tests, and both license texts.

Until one of those source targets exists, the installed `@open-e2ee/signal-protocol-sdk@11.0.0` remains unchanged. The backend proof protocol must not be enabled ahead of a tested SDK implementation.
