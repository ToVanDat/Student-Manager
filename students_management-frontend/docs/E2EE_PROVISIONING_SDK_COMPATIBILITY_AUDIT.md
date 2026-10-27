# E2EE Provisioning SDK Compatibility Audit

Date: 2026-10-27
Branch: feature/chat-1to1-complete
Status: source inspection only; no dependency changes.

## Findings

- The frontend currently depends on `@open-e2ee/signal-protocol-sdk@11.0.0` and imports `@open-e2ee/signal-protocol-sdk/device/provisioning`.
- Upstream SDK 12.0.0 changelog explicitly removes the `./device/provisioning` export, ProvisioningService, all provisioning relay methods, and the corresponding device exports. The replacement managed link flow is not a drop-in replacement.
- Upstream SDK 13.3.0 continues with managed device linking. Its API assumes one process can coordinate the active-device store and new-device store. The current application uses a QR + server relay flow across separate browser contexts, so this is a different architecture.
- Upstream package metadata declares `(MIT OR Apache-2.0)`; any fork must preserve applicable upstream license and notice files.

## Decision

Do not upgrade this application to SDK 12/13 as a shortcut. It would break the current UI imports and relay contract.

The least disruptive path is a narrowly scoped, source-built fork from SDK 11.0.0. Add typed proof hooks inside `device/provisioning.ts` and its `ProvisioningService` interface, then update the frontend and backend as one protocol-versioned change. Pin the application to an immutable fork commit or versioned artifact; do not depend on a floating branch, minified bundle, or monkey patch.

Before implementation, the fork work must:
1. Preserve upstream source attribution and license notices.
2. Add a dedicated HKDF domain-separated proof key and canonical transcript encoding.
3. Generate the primary commitment inside `provisionDevice()`.
4. Generate the new-device proof only after AES-GCM authentication and strict payload validation in `receiveProvisioningMessage()`.
5. Submit proof through typed relay methods without exposing shared secrets, proof keys, or plaintext to application callbacks.
6. Wipe derived key material in `finally`.
7. Include SDK-level tests for transcript canonicalization, proof equality, wrong key/challenge/transcript, malformed ciphertext, replay, and lost responses.

## Important protocol qualification

This proof establishes possession of the ECDH-derived secret bound to the session transcript. It is not remote attestation that trusted JavaScript actually executed AES-GCM. The honest SDK must gate proof generation on successful authenticated decryption, but a malicious client can always claim application-level success.

## Not performed

No SDK dependency was changed, no fork was created, no backend schema migration was added or applied, no user data was changed, and no runtime test or CI run was performed during this audit.
