# UI/UX Audit — 2026-11-04

## Scope and method

Repository: `ToVanDat/Student-Manager`  
Branch: `feature/uiux-foundation-refresh`  
Baseline inspected: `14d7b5f537f55b9ffc6a0be271a50847b6526a9a`  
Scope: frontend source, package dependencies, shared styles, authentication, navigation, admin/student dashboards, chat/calling, settings, and available visual assets.

This is a source-level audit from the GitHub branch. No local browser session, runtime screenshot capture, screen-reader test, or real-device test was available during this pass. Findings below distinguish source evidence from visual/runtime verification.

## Skill and dependency inventory

- The repository tree does not contain `.agents/skills/`, Taste skill files, Impeccable skill files, `craft-floor.md`, or `app-screens.md`.
- The available ChatGPT skill registry returned no installed skills. The previously supplied Taste app-screen guidance and Impeccable Craft Floor rules are therefore applied as user-provided design criteria, not as a claim of direct access to the user's local Windows folders.
- Frontend dependencies include React 19, Tailwind CSS 4, Lucide React, i18next/react-i18next, and Vite.
- No `three`, `@react-three/fiber`, `@react-three/drei`, `gsap`, `framer-motion`, or `motion` dependency is declared.
- The inspected asset tree contains `src/assets/images/hero.png` as a relevant hero visual; no GLB/GLTF/FBX/OBJ 3D model asset was found in the repository tree.
- Conclusion: do not add 3D or animation dependencies in this phase. Existing CSS motion is sufficient for small transitions; a real 3D use case and asset pipeline must be established before introducing WebGL.

## Existing implementation baseline

PR #63 already contains broad UI work across authentication, Chat/Call, Settings, Student Portal, Admin overview/management, shared styles, and Vietnamese/English translations. It remains open and Draft. This audit does not assume those changes have passed visual QA.

## Findings and priorities

### P0 — Must resolve before declaring UI/UX complete

1. **Visual and responsive verification is outstanding.** Source changes alone cannot establish that layouts work at desktop, tablet, and narrow mobile widths. Validate overflow, sticky navigation, dialog height, safe-area insets, and touch target sizes on actual rendered screens.
2. **Keyboard/dialog behavior needs runtime verification.** Chat and group information components contain custom focus-management logic; E2EE confirmation and call/group overlays need checks for focus entry, focus return, Escape handling, and background interaction.
3. **Authentication has at least one hard-coded visible label.** `LoginForm.jsx` contains the literal Vietnamese Face Login label rather than a translation key, despite the surrounding login form using i18n. Verify all auth methods in both Vietnamese and English.

### P1 — High-value consistency and maintainability

4. **Shared styling layers overlap.** `reference-ui.css`, `product-ui-refresh.css`, `auth-motion.css`, and `chat-messenger-polish.css` all contribute global or cross-screen styling. The token bridge in `product-ui-refresh.css` coexists with legacy `--ui-*` definitions in `reference-ui.css`; cascade order and dark-mode contrast should be tested before adding more overrides.
5. **Some visual treatments conflict with the supplied Craft Floor constraints.** Source still includes gradient backgrounds in shared/auth/dashboard/management styles, blur effects in authentication and group overlays, and strong shadow treatments in some navigation/dashboard surfaces. Remove only where they are decorative or redundant; retain contrast and clear layering where functionally needed.
6. **Admin and Student dashboard hierarchy needs screenshot review.** Admin overview still uses a large hero surface and a recent-students region; Student Portal has multiple academic regions. Check whether each section communicates a distinct task instead of repeating card patterns, and verify empty states do not imply missing academic data.
7. **Chat component complexity is high.** `ChatWindow.jsx` is approximately 1,965 lines and `GroupInfoPanel.jsx` approximately 546 lines. Keep behavior changes out of a visual pass; use focused edits and regression checks for message send, attachments, search, E2EE, group membership, and calls.

### P2 — Polish after P0/P1

8. **Motion should remain restrained and accessible.** Existing auth motion uses a single panel entrance and reduced-motion handling. Keep this pattern; avoid staggered field animations, parallax expansion, or continuous decorative motion.
9. **3D is not currently justified by the repository.** There is no 3D model asset or rendering dependency. If a future landing/hero requirement genuinely needs 3D, first define the scene, fallback image, reduced-motion behavior, mobile performance budget, and asset ownership.
10. **Localization audit should cover visible UI strings and accessibility labels.** Prioritize login methods, chat dialogs, group actions, call center, upload/recording controls, and settings feedback.

## Screen-by-screen audit checklist

| Area | Source-level status | Next verification |
|---|---|---|
| Login / OTP / password recovery / registration | Shared auth styling and reduced-motion animation exist; at least one literal Face Login label remains | VN/EN, invalid/loading/success states, password visibility, QR/Face Login labels, keyboard |
| Navbar / Sidebar | Student sidebar uses semantic nav and current-page state; responsive collapse and overlay behavior are source-defined | 1280/1024/768/390 widths, focus order, mobile open/close |
| Admin Dashboard / CRUD | KPI and management surfaces have been revised; forms/tables/dialogs have responsive CSS | Table overflow, form validation, destructive confirmation, loading/empty/error |
| Student Dashboard / Portal | Academic sections and empty states are present in source | Real-data vs empty-data distinction, no fabricated timetable/GPA, mobile stacking |
| Chat / Chatbot | Chat shell, conversation list, timeline, composer, E2EE and search surfaces exist | 1:1/group, attachment, recording, search, E2EE, chatbot, mobile viewport |
| Call Center | History/notification panel and localized labels have been revised | permission denied, missed/active calls, keyboard, narrow mobile |
| Settings / Profile | Settings sections and responsive navigation exist | long labels, save/error feedback, security actions, dark theme |
| Landing / 3D | Hero image exists; no 3D model/runtime dependency found | assess actual product need before any WebGL work |

## Changes applied after the audit

- Localized the Face Login action in the login form for Vietnamese and English.
- Replaced the student sidebar's translucent/blurred surface and gradient logo tile with solid surfaces.
- Replaced the student header's translucent/blurred surface with a solid surface.
- Removed blur from the authentication panel entrance keyframes; reduced-motion behavior remains.
- Simplified the Student Management primary action to a solid button, removed the modal backdrop blur, reduced the modal shadow, and removed the redundant eyebrow above the dialog title.
- Removed the Student Portal eyebrow above its page heading and the decorative shadow on its date surface.

These are source-level presentation changes only. They have not yet been validated by a local frontend build or browser/device visual QA.

## Implementation order

1. Continue the remaining localization and accessibility audit with minimal component changes.
2. Consolidate conflicting global styling only after rendered regression checks.
3. Refine Login/OTP and Sidebar navigation.
4. Refine Dashboard/Admin CRUD and Student Portal.
5. Complete Chat/Call and Settings checks without changing APIs, routes, authorization, E2EE protocol, or business logic.
6. Run frontend lint/build and the existing E2EE tests; record results. Perform manual desktop/tablet/mobile and keyboard QA separately.

## Guardrails

- UI/presentation/accessibility only.
- No API contract, backend, database, authorization, routing, Socket.IO, E2EE protocol, or business-logic changes.
- No new dependency installation in this phase.
- No destructive operation, deployment, or merge.
- Do not mark browser/device QA complete without actual screenshots and interaction tests.


## Follow-up implementation — Group information panel

- Replaced remaining hardcoded Vietnamese labels in the group information panel with existing i18n keys so the panel follows the selected language, including the no-matching-users empty state.
- Added localized confirmation-dialog titles for removing a member and leaving a group in Vietnamese and English.
- Reused existing translation entries for cancel, confirm, processing, member count, roles, and group actions; no API, authorization, Socket.IO, or group-membership behavior changed.
- Source-level validation only. Browser keyboard/focus and responsive verification remain outstanding.


## Follow-up implementation — Chat conversation header and menu

- Localized E2EE state and help text, theme-picker status/actions, conversation details controls, and direct-chat action menu.
- Added matching Vietnamese/English entries while reusing existing keys where available.
- Preserved all event handlers, conversation-setting operations, and E2EE state transitions; presentation/localization only.
- Both locale JSON files were parsed after editing. Browser and full frontend checks remain required.

- Follow-up: localized the remaining conversation-header back control and message-search field labels/placeholder using shared i18n keys.


## Follow-up implementation — Settings and enrollment dialogs

- Localized the enrollment deletion confirmation title, irreversible-action notice, cancel action, and busy/confirm labels using the existing language context.
- Localized account avatar requirements, immutable username guidance, and display-name labels/help text.
- Kept deletion, account update, and avatar upload behavior unchanged. Translation entries added in Vietnamese and English.


## Follow-up implementation — Face Login and advanced security settings

- Added Vietnamese/English localization for Face Login status, enrollment guidance, camera errors, liveness steps, privacy explanation, release-gate messaging, confirmation dialog, and action labels.
- Added Vietnamese/English localization for Passkey registration/verification, Google account linking/unlinking, status/error feedback, and destructive-action confirmation.
- Kept the Face Login release gate, camera capture flow, challenge lifecycle, server calls, Passkey WebAuthn payloads, sensitive re-authentication, and Google linking behavior unchanged.
- Parsed both locale JSON files after the additions; both contain 797 keys with no missing counterpart keys at this checkpoint.
- This remains source-level validation. Frontend build/lint, actual camera/Passkey runtime, browser keyboard/focus, and responsive visual QA are not yet verified.


## Follow-up implementation — Admin catalog and class management dialogs

- Localized the catalog and class deletion-confirmation title, irreversible-action notice, cancel action, and busy/confirm labels with the existing Vietnamese/English translation keys.
- Removed decorative backdrop blur and reduced oversized dialog shadows in catalog, class, Face Login, advanced security, and student-account-link confirmation surfaces.
- Corrected the mixed-language password/passkey verification label in advanced security and the Vietnamese cancel label in account-link removal.
- Preserved CRUD requests, validation, API payloads, enrollment/security flows, and account-link behavior.
- Re-fetched the changed source files and verified the intended strings and existing translation keys at source level. Frontend compilation, lint, and browser/device interaction tests remain outstanding.


## Follow-up implementation — Admin management and settings review

- Reviewed Catalog, Class, User, Student Account Link, and the Settings subpages (Appearance, Language, Notifications, Password, Security, Sessions, menu, and page shell).
- Catalog and Class delete confirmations now use the shared Vietnamese/English confirmation labels; their primary actions use solid surfaces instead of gradients and the redundant header-card shadow treatment was removed.
- Removed the redundant eyebrow/kicker from User Management and simplified its confirmation overlay/shadow.
- Localized the remaining Refresh Token tooltip through the existing translation key. The other reviewed Settings subpages did not expose hardcoded visible labels in the source scan.
- User Management and Student Account Link currently use explicit Vietnamese/English branches; these were retained rather than introducing a second translation pattern into those components in this pass.
- No endpoint, API payload, permission, role, or account-link behavior changed. Source inspection only; frontend build/lint and browser QA remain unverified.

## Follow-up implementation — Product motion foundation

- Added a shared, lightweight CSS motion layer and loaded it from the frontend entry point. No animation dependency was added.
- Authentication: added a short entrance transition for guided recovery steps, refined OTP focus feedback and tabular code presentation, and simplified OTP/password-reset primary actions to solid surfaces with restrained hover/press feedback.
- Navigation and overlays: scoped active/press feedback to the Student Sidebar, added a consistent modal/popover entrance, and retained existing focus/dismissal behavior.
- Chat: marked the message timeline and typing indicator with semantic UI regions; newly mounted message bubbles now enter with a short opacity/position transition. Existing messages are not replayed on parent rerenders.
- Calls: removed decorative backdrop blur from incoming and active call overlays; existing call-dialog entrance, countdown, and state feedback remain lightweight.
- Accessibility/performance: motion is enabled only when `prefers-reduced-motion: no-preference`; reduced-motion disables the new transitions/animations and smooth scrolling. No timers, animation loops, API calls, Socket.IO events, E2EE state, or business rules were introduced by this motion layer.
- Validation status: source changes committed to the UI/UX feature branch. Frontend build/lint, visual QA at desktop/tablet/mobile breakpoints, keyboard testing, reduced-motion testing, and real incoming/active-call testing are still required before marking the motion work production-ready.
