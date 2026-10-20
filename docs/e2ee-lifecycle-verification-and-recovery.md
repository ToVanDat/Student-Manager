# E2EE lifecycle, identity verification, devices, and recovery

Target branch: `feature/chat-1to1-complete`

## Implemented in this change

- Closing the in-memory Signal client, relay listeners, and local protocol-store connection during explicit logout and definitive refresh-token expiry. Local key material and encrypted history are preserved; logout must not silently erase them.
- Fail-closed behavior for text and attachment sends when the conversation-status response is malformed or does not explicitly declare whether E2EE is available. A failed status request already rejects the send; it must never be interpreted as permission to fall back to plaintext.
- A direct-chat safety fingerprint UI. It hashes the canonicalized public identity object returned by the relay with SHA-256, shows the complete fingerprint, supports copying, and stores the user's manual verification pin in device-local IndexedDB. A changed fingerprint is shown as a warning and requires a new explicit verification action.
- Linked-device inventory and revoke controls in the existing E2EE device panel. The current device cannot revoke itself from its own panel; use another trusted device to revoke it.

## Security semantics and limitations

- The fingerprint is a **manual safety-code comparison aid**, not proof that the server gave the correct key on first use. Users must compare the full code through an independent trusted channel. Pins are local to the current browser profile and are not synchronized.
- A key change must be treated as a security warning, not silently accepted. The current UI permits repinning only after an explicit confirmation; operators should investigate unexpected rotations before asking users to verify again.
- Device linking transfers protocol identity through the SDK's encrypted provisioning flow. It does not automatically transfer the device-local decrypted chat history.
- Revoking a device blocks its relay credential and server-side device state. It does not remotely erase data already copied to a previously authorized device. Confirm identity rotation and re-link behavior against the installed SDK and backend.
- If every trusted device and all private identity/history keys are lost, the application cannot decrypt existing E2EE history from the server. No server-side plaintext recovery is added by this change.

## Safe recovery policy

1. Prefer linking a new device from a still-trusted primary device using the SDK provisioning flow.
2. Do not generate a replacement identity automatically when the server already has a registered identity or when local key material is missing. Require re-link/recovery and make the impact explicit.
3. Keep legacy server history separate from E2EE history. Do not delete, rewrite, or pretend to decrypt legacy messages.
4. A future portable recovery backup must be client-encrypted, authenticated, versioned, and protected by a user-held recovery secret. Derive a backup key with a reviewed password KDF (prefer Argon2id where supported, otherwise a deliberately configured PBKDF2-SHA-256 policy), use an authenticated encryption mode with unique nonces, and never send the recovery secret or plaintext backup to the server. Prefer SDK-supported identity/session export APIs rather than serializing private SDK stores manually.
5. Recovery must have explicit failure handling for wrong secrets, corrupted backups, rollback/version mismatch, and revoked identities. Do not silently overwrite local keys or merge untrusted protocol state.
6. Do not implement a recovery backup until the SDK's supported export/import APIs, format stability, and threat model have been reviewed and tested. A hand-rolled backup of undocumented SDK internals is not safe.

## Manual staging acceptance checklist

Use two test accounts in separate browser profiles and a disposable database. Never run destructive key-loss/revocation tests against production accounts.

- [ ] Login initializes the local store once and keeps a stable device identity across reloads.
- [ ] A first-time device for an account with existing registered devices is required to link; it must not generate a replacement identity.
- [ ] Logout closes the client/subscription, and login on a different account cannot reuse the previous account's active context.
- [ ] Send while the conversation status endpoint fails or returns an unknown shape; no plaintext REST message or legacy file upload is created.
- [ ] Send an E2EE message; inspect the request and database to confirm plaintext is absent from the relay payload.
- [ ] Compare the safety fingerprint on both participants through an independent channel; verify, reload, and confirm the local pin persists.
- [ ] Change/rotate the recipient identity in a disposable test account; confirm the old pin produces a warning and is not silently replaced.
- [ ] Link a second browser from the trusted primary; verify the new device can send and receive after provisioning.
- [ ] Revoke a linked device from another trusted device; confirm the revoked credential can no longer send, pull mailbox, or acknowledge envelopes.
- [ ] Confirm the local E2EE history remains readable after ordinary logout/login on the same profile.
- [ ] In a disposable profile, remove the local history key while retaining encrypted rows; the UI must report unrecoverable local history rather than minting a new key.
- [ ] Confirm a linked device does not automatically receive the first device's local history.
- [ ] Treat all-device loss as unrecoverable until a separately reviewed client-encrypted recovery backup is implemented.

## Validation boundary

Repository CI and static builds do not replace browser acceptance. The fingerprint UI, provisioning/revocation UX, key-rotation warning, and logout cleanup must be validated in a real staging deployment. Do not mark production-ready until the checklist, deployment schema review, SDK review, browser XSS/CSP review, and recovery policy have been accepted.
