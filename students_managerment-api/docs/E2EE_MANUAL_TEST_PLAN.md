# E2EE manual browser verification — Student-Manager

## Safety and test setup

- Use a disposable test environment and two test accounts. Do not run the migration against production for this checklist.
- Use two independent browser profiles (Profile A and Profile B), not merely two tabs sharing one IndexedDB/OPFS origin.
- Start PostgreSQL, Redis, API, and frontend using the same configuration you intend to validate. Apply `sql/e2ee_foundation_migration.sql` only to the disposable database after backing up that database.
- Open browser DevTools Network and verify the legacy plaintext message endpoint is not called for messages in an E2EE-enabled conversation. Do not export private key material or device tokens into screenshots/logs.
- Current scope is direct text chat. Attachments and group E2EE must remain unavailable.

## Test matrix

| Case | Steps | Expected result |
|---|---|---|
| Initial state | Sign in as Account A in Profile A and Account B in Profile B; open a direct conversation | Existing legacy history remains visible; E2EE is not silently enabled |
| Device readiness | Register/link devices and confirm each active device has the same account identity and required signed/prekeys | UI enables activation only when every active device for both participants is ready |
| Activation | Activate E2EE in the direct conversation | Server records activation; group conversation activation is rejected |
| Text send | Send a unique test phrase from A to B | B decrypts the phrase; the network/API payload is ciphertext; plaintext create-message endpoint is not used |
| Multi-device | Link a second device to B and send another message from A | Both B devices receive/decrypt the message; no duplicate generic notification is generated for the same logical message |
| Offline delivery | Close Profile B, send from A, then reopen/reconnect B | B pulls the durable envelope and decrypts it; envelope is acknowledged after processing |
| Retry | Simulate a transient network failure and retry the same client message ID | Server returns the same envelope for the same sender/message/recipient device; no duplicate notification |
| Mailbox backoff | Make a mailbox pull or decrypt handler fail temporarily, then restore it without sending another Socket.IO event | Client retries with capped backoff, leaves failed envelope unacknowledged, then processes and acknowledges it once recovered |
| Mailbox pagination | Queue more than 100 envelopes for one device and reconnect once | Client drains subsequent pages without requiring another envelope-available event |
| Edit / recall / reaction | Perform each supported operation in the direct E2EE conversation | Operation is delivered as an encrypted control payload and updates local decrypted history |
| Legacy fail-closed | In an E2EE-enabled conversation, attempt the legacy plaintext REST and Socket.IO send paths | Both reject the plaintext message; no fallback sends it |
| Attachment | Attempt image, document, audio, or video attachment in E2EE chat | UI blocks the operation with a clear explanation; no legacy upload request occurs |
| Local history key missing | In a disposable test profile only, simulate a missing history key while encrypted history rows remain | UI shows the local-history warning; it does not silently generate a replacement key or delete local rows |
| Provisioning interrupted | Start linking a device, close/cancel before completion, then retry after expiry | Expired/cancelled session cannot be completed; no ghost active device remains |
| Device revocation | Revoke a linked secondary device, then attempt its mailbox pull and Socket.IO subscription | Relay rejects the revoked credential; pending envelopes/prekeys for that device are cleaned up |
| Account/identity mismatch | Attempt to provision a device with a different canonical identity | Server rejects it; no silent identity overwrite |
| Reconnect / reload | Reload each profile and reconnect Socket.IO | Local protocol state is reused; no new identity is silently generated for an existing account |

## Evidence to capture

- CI run URL and exact commit SHA.
- Console errors only after redacting tokens, URLs containing provisioning secrets, user IDs if needed, and all key material.
- Network request names/status codes and payload *shape* only. Never capture raw decrypted messages, ciphertext payloads if they are user data, private keys, device credentials, QR provisioning URLs, or bearer tokens.
- Confirm the database has envelope rows but no E2EE plaintext message rows. This app uses a separate ciphertext mailbox; do not add placeholder plaintext rows to the legacy `messages` table.

## Recovery expectations

- A missing local history key is not recoverable by the server because it never stores that key or decrypted history.
- Linking another device provisions protocol identity/session state; it does not synchronize this browser's local decrypted history.
- Do not clear IndexedDB/OPFS, reset the SDK store, or create a new identity to "fix" a history-key error. First preserve the profile's local browser data and investigate storage errors.
- A production recovery design must be explicit (e.g. encrypted export/backup or a carefully designed recovery key). Do not implement server-side plaintext escrow.

## Not covered by this checklist

- Group E2EE, encrypted attachments, live production schema migration, independent protocol audit, XSS resistance, and provider-specific Web Push behavior require separate validation.
