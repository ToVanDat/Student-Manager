# E2EE pause and safe reactivation

## Current rollout decision

New conversation E2EE activation is paused by default. The backend flag is opt-in:
`E2EE_ACTIVATION_ENABLED=true`.

The activation gate is intentionally separate from the existing conversation encryption state. It prevents new activation requests; it does not clear existing E2EE settings, device registrations, identity keys, prekeys, envelopes, or browser-local E2EE history.

## Required safety behavior

- Keep the REST `createMessage` and Socket.IO `message:send` plaintext guards for conversations already marked E2EE.
- Do not delete or rewrite `conversation_e2ee_settings`, E2EE relay envelopes, device/key tables, or local IndexedDB history as part of pausing activation.
- Keep existing E2EE conversations marked and handled as E2EE. Do not silently fall back to plaintext if an encrypted send fails.
- Make the UI state explicit: paused activation does not mean an already-encrypted conversation has been converted back to plaintext.
- If a future product decision requires plaintext sends in an existing E2EE conversation, implement that as a separate, explicit mixed-mode design with server-side policy, per-message encryption metadata, and clear UI disclosure. Do not achieve it by removing the guards.

## Operational configuration

Default / paused:
```env
E2EE_ACTIVATION_ENABLED=false
```

Enable new activation only after validation:
```env
E2EE_ACTIVATION_ENABLED=true
```

Restart the API process after changing the environment variable. Any value other than the exact string `true` keeps activation disabled.

## Validation checklist before enabling

### API and relay
- [ ] Activation status reports `activationEnabled: false` when the flag is unset or false.
- [ ] New activation requests return HTTP 503 with code `E2EE_ACTIVATION_PAUSED` while disabled.
- [ ] Existing enabled conversations still report enabled and can retrieve their existing encrypted history.
- [ ] REST plaintext sends to an E2EE-enabled conversation remain rejected with `E2EE_REQUIRED`.
- [ ] Socket.IO plaintext sends to an E2EE-enabled conversation remain rejected with `E2EE_REQUIRED`.
- [ ] Encrypted envelope delivery, acknowledgement, retry/pull, and device revocation behavior are unchanged.

### Frontend
- [ ] An unencrypted conversation shows that E2EE activation is paused and does not offer a working activation action.
- [ ] An already-E2EE conversation continues to show its encrypted state rather than a paused/plaintext state.
- [ ] Local E2EE history remains visible after refresh when the same browser key store is available.
- [ ] No ciphertext or protocol envelope is rendered as ordinary message text.
- [ ] A failed E2EE send does not retry automatically through the plaintext API.

### Regression and multi-device
- [ ] Test with two separate accounts and at least two devices for one account.
- [ ] Test page refresh, socket reconnect, duplicate delivery, offline recipient pull, and delivery acknowledgement.
- [ ] Test edit, recall, reactions, attachment behavior, search, and notification previews separately for E2EE and regular messages.
- [ ] Run API tests (`npm test` in `students_managerment-api`), frontend lint/build, and the E2EE round-trip test (`npm run test:e2ee` in `students_management-frontend`).

## Important limitation

This pause is not a conversion of existing E2EE conversations to plaintext. Existing encrypted history is stored in the browser's local E2EE history store, while regular chat history is served by the API. A future mixed-mode feature must merge both sources by stable message identity and handle cross-device history explicitly. This document is a rollout checklist, not evidence that the listed tests have been run.
