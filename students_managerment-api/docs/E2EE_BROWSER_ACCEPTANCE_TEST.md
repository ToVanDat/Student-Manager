# E2EE browser acceptance checklist

Run this checklist only against a disposable staging database and test accounts. Do not use production conversations or real private messages.

## Preconditions

- Apply `sql/e2ee_foundation_migration.sql` to a reviewed staging schema.
- Configure the same-origin frontend/API URLs and verify JWT/session authentication.
- Create two test accounts that can open a direct conversation.
- Use two separate browser profiles (Profile A and Profile B); do not use two tabs in one profile as a substitute for separate device storage.
- Keep a legacy plaintext message in the conversation before E2EE activation.
- Never export HAR files containing bearer tokens or device credentials.

## Acceptance tests

| ID | Action | Expected result | Failure condition |
|---|---|---|---|
| E2EE-B01 | Open the conversation before migration/activation | Legacy history remains readable; E2EE unavailable/disabled is shown clearly | Legacy messages disappear or are rewritten |
| E2EE-B02 | Register the primary device on Profile A and Profile B; link B from A using the QR/copy flow | B receives a linked slot and its own credential; private provisioning payload is not readable from API response/logs | A linked device silently creates an unrelated account identity |
| E2EE-B03 | Activate E2EE for the direct conversation only after both accounts' active devices are ready | Activation succeeds only when every active device has identity and required prekeys | Group conversation activates or an unready device is ignored |
| E2EE-B04 | Send a new text from A to B | B decrypts and displays it as E2EE; API/database/network payload contains ciphertext, not message text | Any plaintext fallback is used |
| E2EE-B05 | Send from B to A and send a reply while Profile B is offline, then reconnect | The mailbox delivers the message after reconnect; duplicate retries do not duplicate UI messages | Message is lost, duplicated, or appears in another account |
| E2EE-B06 | Edit, recall and react to a newly encrypted message | Only encrypted control payloads are sent; both active devices converge on the same visible state | Legacy plaintext edit/reaction endpoint is used for E2EE message |
| E2EE-B07 | Search inside an E2EE conversation | Search runs against locally decrypted/loaded history only | Search text is sent to the server |
| E2EE-B08 | Inspect notification center and Web Push for an E2EE message | Notification is generic; it contains no message body, file name, ciphertext, or attachment metadata | Preview leaks content or notification failure blocks message delivery |
| E2EE-B09 | Revoke linked Profile B from the primary device | B cannot pull or acknowledge new mailbox items; pending envelopes and prekeys for that slot are removed | Revoked credential still works or another slot is affected |
| E2EE-B10 | Remove/corrupt the local E2EE store in a disposable profile without changing server state | UI fails closed and requests secure re-link/recovery; it does not silently generate a replacement identity | Client silently replaces the identity or pretends old history is recoverable |
| E2EE-B11 | Interrupt device linking before acknowledgement and let a provisioning session expire | Rollback removes the pending linked slot; expired sessions cannot complete | A partially linked device remains active |
| E2EE-B12 | Attempt to attach a file while no remote object-store broker is configured | UI refuses the E2EE upload and does not call the legacy plaintext file endpoint | File is uploaded in plaintext or a fake success is shown |

## Evidence to record

- Test account labels (not passwords), browser/version, commit SHA, and test date.
- Pass/fail for each ID and sanitized console errors.
- Sanitized request path/status only; do not record authorization headers, device tokens, ciphertext payloads, QR provisioning payloads, or message content.
- Any failing ID should be fixed and rerun before enabling E2EE for real users.

## Scope boundary

This checklist does not certify a production cryptographic audit. E2EE group chat and encrypted attachments remain disabled until the corresponding group protocol and brokered object-storage path have been implemented and independently tested.
