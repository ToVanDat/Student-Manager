# E2EE Provisioning Recovery Test Plan

## Scope

Validate the browser-side durable provisioning journal and rollback reconciliation.
These are browser fault-injection tests; they must use a disposable test account and
must not run database migrations or mutate production data.

## Safety invariants

1. A linked device remains unusable until the server ACK transaction succeeds.
2. The device token and provisioning journal are persisted in one IndexedDB
   transaction before the separate current-device pointer is written.
3. A rollback timeout is an unknown server outcome. Keep the token and journal.
4. Never delete the local token/journal until the rollback endpoint returns a
   successful finalization response.
5. On client startup, reconcile incomplete journal entries before resolving the
   current device ID or registering a relay device.
6. An incomplete journal is fail-closed: startup rolls it back rather than
   assuming that local identity persistence or ACK succeeded.

## Browser fault-injection cases

Use a disposable linked device and browser profile. In DevTools, enable Network
throttling/offline at the indicated boundary. For crash cases, close the tab or
terminate the browser process rather than only navigating away.

| ID | Injection point | Expected result |
| --- | --- | --- |
| PR-01 | Offline immediately after complete response | Token + journal remain durable; linked device is not enabled before ACK. |
| PR-02 | Force IndexedDB quota/write failure during token+journal transaction | Transaction aborts atomically; no half-written credential/journal pair is treated as recoverable. |
| PR-03 | Allow token+journal transaction, then force the device-state DB write to fail | Startup discovers the journal without the current device ID and attempts rollback. |
| PR-04 | Close browser after token+journal persistence but before local identity commit | Startup finds the journal, queues rollback, and does not initialize relay operations first. |
| PR-05 | Fail local identity persistence | SDK rollback persists rollback intent; a network error retains token and journal. |
| PR-06 | Let ACK commit server-side, then drop the HTTP response | Journal remains; next startup retries rollback. Backend must revoke the completed linked device idempotently. |
| PR-07 | Let rollback commit server-side, then drop the HTTP response | Token and journal remain until retry receives server confirmation; repeated rollback must be idempotent. |
| PR-08 | Reload while offline with rollback pending | Startup fails closed; journal and token remain. Reconnect and initialize again to retry. |
| PR-09 | Dispose the adapter while its retry timer is pending | Journal survives disposal; a new initialization performs recovery. |
| PR-10 | Delete only the current-device pointer while preserving credentials DB | Recovery still locates the pending session from the journal. |
| PR-11 | On the primary browser, reload after the owner journal is saved but before the new device completes provisioning | Startup uses the authenticated owner abort endpoint, clears the owner journal only after a terminal response, and never treats the owner record as a device-token rollback. |
| PR-12 | Race primary-side abort against new-device ACK | If abort wins, the pending device is removed and ACK cannot activate it. If ACK wins, abort returns `alreadyCompleted` and must not revoke the active device. |

## Required assertions

- Inspect IndexedDB database `student-manager-e2ee-credentials-{userId}`:
  - `credentials` contains the linked device token until server finalization.
  - `provisionings` contains the session, device ID, phase and rollback state.
- Inspect `student-manager-e2ee-device-state-{userId}` separately to verify
  recovery does not depend on its `device/current` record.
- Confirm that `requireCredential` blocks normal relay operations while a
  rollback marker is present.
- Confirm that a successful ACK removes only the device-side journal metadata and preserves
  the device token for normal use.
- Confirm owner journals are recovered separately with the authenticated account session;
  they do not require a device token or `deviceId`.
- Confirm owner-side `alreadyCompleted` clears only the owner journal and never revokes
  the linked device.
- Confirm that a successful rollback removes the matching credential and
  journal, and clears the current-device pointer only when it references the
  rolled-back device.
- Confirm no unrelated device slot or account data is changed.

## Current verification status

The implementation is committed to `feature/chat-1to1-complete`, but these
browser fault-injection cases have not yet been executed. Do not mark this plan
passed based only on source inspection or mocked repository tests.
