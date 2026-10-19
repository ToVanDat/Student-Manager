# E2EE pause: mixed-mode rollout contract

## Goal

Temporarily allow ordinary messages in a conversation whose E2EE history already exists, while retaining the encrypted history and all device/key material. This is a downgrade in confidentiality: after the pause, new ordinary messages are readable by the server and must be clearly labeled as non-E2EE.

## Current behavior verified on `fix/pause-new-e2ee-activation`

- `messageController.createMessage` rejects plaintext REST sends when `e2eeRepository.isConversationE2EEEnabled(conversationId)` is true.
- Socket.IO `message:send` independently rejects plaintext for those conversations.
- `conversation_e2ee_settings` currently acts as an enabled marker: a row means enabled. The repository does not expose a paused state.
- E2EE history is kept in per-user browser IndexedDB (`e2eeHistoryStore.js`), encrypted with a locally stored non-extractable AES-GCM key. It is not the same store as ordinary server-side `messages`.

## Required design before enabling mixed mode

1. **Represent mode explicitly.** Add a backwards-compatible migration for a conversation E2EE mode/state (for example `active` / `paused`) instead of deleting settings rows. Existing rows must migrate to `active`. Preserve existing key/device/prekey/envelope rows.
2. **Centralize server policy.** Both REST and Socket.IO must call the same repository/service policy. `active` rejects plaintext and accepts only encrypted envelopes; `paused` allows ordinary messages but must not accept new E2EE envelopes unless explicitly reactivated through a verified workflow. Missing schema must never silently downgrade a conversation known to be E2EE.
3. **Authorize pause.** Require an explicit authenticated conversation member action, rate-limit it, record actor/time/reason, and emit a mode-change event to every conversation member. If the product wants a member-only pause, disclose that the choice affects all participants; otherwise restrict to owner/admin.
4. **Keep history separate.** Do not copy, decrypt, rewrite, or delete local E2EE history. Merge normal server messages and locally decrypted E2EE history in the UI, deduplicate safely, and mark every item with its actual mode. A new browser/device may not possess the old local history; show that limitation instead of implying server recovery.
5. **Prevent misleading security UX.** Display a persistent “E2EE paused — new messages are not end-to-end encrypted” banner and a per-message mode marker. Reactivation must be explicit and only occur after device/key state is checked; do not silently switch modes.
6. **Cover dependent behavior.** Test reply, edit, recall, delete, reactions, search, unread counts, last-message previews, notifications, attachments, pagination, optimistic updates, reconnect/retry, and multiple devices. Do not leak E2EE plaintext into server notifications/search.
7. **Test the transition.** Test active → paused → normal message via REST and Socket.IO, old local E2EE history remains decryptable, new messages render as plaintext-mode, active-mode plaintext remains rejected, unauthorized users cannot pause, and missing migration/schema fails safely.

## Rollout / acceptance checklist

- [ ] Migration is additive and has a rollback plan; no existing rows or key material are deleted.
- [ ] REST and Socket.IO use the same explicit mode policy.
- [ ] Existing E2EE history remains readable on the original device.
- [ ] UI warns all participants before/after the downgrade.
- [ ] Regression tests cover both transports and mixed history ordering.
- [ ] Build, lint, API tests, and two-account/multi-device tests pass.

## Safety note

The pause flag that blocks *new activation* is not equivalent to pausing E2EE on a conversation already active. Do not remove the existing `E2EE_REQUIRED` guards until the explicit mode state, authorization, UI warning, and regression tests are implemented together.
