# E2EE browser acceptance checklist

Use a disposable test account and a test database. Do not run destructive tests against production accounts or a production database. Complete this checklist only against a local/staging deployment where the E2EE migration has been applied and backed up.

## Setup

- [ ] Apply `sql/e2ee_foundation_migration.sql` to a disposable PostgreSQL schema that matches the deployed application's existing schema.
- [ ] Run API and frontend with the same staging configuration.
- [ ] Create two test accounts, Alice and Bob, with an existing direct conversation.
- [ ] Open Alice and Bob in separate browser profiles (not merely separate tabs).
- [ ] Confirm the E2EE status endpoint is available and that legacy messages are still readable.
- [ ] Record browser/version and commit SHA used for the test.

## Text E2EE and legacy-history separation

- [ ] Before E2EE activation, send a legacy message and confirm it remains visible after activation.
- [ ] Register/provision the primary device for both accounts and publish signed/prekeys.
- [ ] Activate E2EE only after the UI reports every active device is ready.
- [ ] Send a unique text message from Alice to Bob.
- [ ] Confirm Bob can read it and the UI marks it as E2EE.
- [ ] Inspect the network request and database row: the relay request contains ciphertext, not the unique plaintext marker.
- [ ] Confirm the legacy message-create API is not called for the E2EE message.
- [ ] Disconnect Bob, send another message, reconnect, and confirm the durable mailbox delivers it once.
- [ ] Refresh each profile and confirm decrypted local history reloads without a plaintext server transcript.

## Controls and local search

- [ ] Send an edit control; both recipient devices reflect the edit after decrypting the control.
- [ ] Send a reaction and remove it; both recipient devices converge.
- [ ] Recall a message; confirm the UI updates only after the encrypted control is sent successfully.
- [ ] Search for a unique E2EE phrase; confirm search is local and the phrase is not sent to the server.
- [ ] Confirm unsupported group conversations cannot be activated as E2EE.

## Device linking, revocation, and recovery failures

- [ ] Link Bob's second browser profile from the already provisioned primary device using the QR/copy-link flow.
- [ ] Confirm the second device uses the same account identity but maintains its own device/session state and prekeys.
- [ ] Send a message to Bob; confirm both active devices receive their own ciphertext envelope and only one generic notification is requested per logical message.
- [ ] Close or expire a provisioning session before completion; confirm it cannot be completed later.
- [ ] Trigger rollback before acknowledging a linked device; confirm the new slot and credential are invalidated.
- [ ] Revoke Bob's linked device; confirm its relay credential is rejected and pending mailbox envelopes/prekeys are removed.
- [ ] Try to reuse a revoked device token; expect an authorization failure.
- [ ] In a disposable browser profile, remove the local history key while retaining encrypted history rows; confirm the UI reports an unrecoverable local-history error and does not silently replace the key.
- [ ] In a disposable account, remove the local protocol store; confirm the client fails closed and requires the documented re-link/recovery flow rather than silently creating a new identity for the existing account.
- [ ] Verify there is no UX or server endpoint claiming the lost private identity/history key can be recovered if no valid backup exists.

## Notifications and attachment safety

- [ ] Enable notification preferences and send an E2EE message; confirm the notification is generic and contains no message preview or attachment filename.
- [ ] Disable notifications or mute the conversation; confirm existing preference rules are respected.
- [ ] Force notification provider failure; confirm the already persisted ciphertext send still succeeds.
- [ ] Try to upload an attachment in an E2EE conversation before the remote-object-store broker is configured; confirm the UI blocks it and no legacy file upload/message placeholder is created.
- [ ] After a broker is configured in a separate implementation, upload a harmless test file and confirm storage receives ciphertext only, media keys appear only inside the encrypted message, downloads are authorization-checked, and delete removes the remote object.

## Sign-off

Record each test as PASS / FAIL / NOT RUN and attach only redacted logs. Do not mark E2EE production-ready until all applicable tests pass, the deployed schema has been validated, and a security review has accepted the protocol profile, browser threat model, identity recovery policy, and object-store broker.
