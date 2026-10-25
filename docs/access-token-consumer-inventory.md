# Access-token consumer inventory — follow-up

Reviewed on 2026-10-25 against `feature/chat-1to1-complete`. This supplements `docs/access-token-storage-audit-and-migration-plan.md`.

## Concrete frontend dependencies confirmed

| File | Current dependency | Required migration |
|---|---|---|
| `src/api/client.js` | Loads AT from localStorage; writes/removes it; request/response interceptors; refresh mutex and Web Locks | Become the single memory-only AT owner; add explicit bootstrap and robust refresh coordination |
| `src/context/AuthContext.jsx` | Initializes AT and user from localStorage; refresh timer; token-change event; socket token; reads localStorage to compare session IDs; clears token in multiple branches | Initialize unauthenticated/loading; restore session from refresh cookie; use shared token getter; centralize invalid-session cleanup |
| `src/api/authApi.js` | Separate Axios requests; logout and authenticated passkey/Google/QR approval build Authorization from localStorage | Use shared authenticated client for protected endpoints; keep public login/QR polling endpoints credentialed as appropriate |
| `src/socket/socket.js` | Socket.IO configured with credentials and manual connection; token supplied by AuthContext | Keep socket handshake bearer sourced from memory; retain token-refresh event and active-call continuity |
| `src/routes/ProtectedRoute.jsx` | Redirects immediately when `isAuthenticated` is false; no restoration/loading state | Wait for auth bootstrap before redirecting |
| `src/routes/AppRoutes.jsx` | Protected student and chat routes depend on ProtectedRoute | No route redesign required; ensure bootstrap state is surfaced |
| `src/api/chatApi.js` | Chat API uses shared Axios client | Should inherit memory-only bearer automatically |
| `src/api/e2eeRelayApi.js` | E2EE relay uses shared Axios client; separate `X-E2EE-Device-Token` for device operations | Preserve distinct E2EE device token header and local key lifecycle |

## Additional observations

- `AuthContext` currently considers a persisted AT sufficient to initialize authenticated state. With memory-only AT, a startup/bootstrap phase is mandatory; otherwise refresh restoration and route rendering race.
- `ProtectedRoute` currently has only authenticated/not-authenticated branches. Add a loading branch as part of the coordinated migration, not as an isolated UI patch.
- The Login page calls `loginUser(data)` after password login. Other successful login paths must also be traced through `AdvancedLoginMethods.jsx` and `QrLoginPanel.jsx` to ensure they all call the same central token setter.
- `rememberMe` currently persists the remembered username and preference, not the access token; preserve that distinction.
- `apiClient` currently initializes default Authorization headers and also sets them in the request interceptor. Remove stale default headers during migration so a cleared token cannot remain attached to a later request.
- The Web Locks implementation serializes refresh requests per origin. Validate behavior across tabs with rotated HttpOnly cookies and browsers without Web Locks; do not assume this is solved by the existing module-level promise (which is tab-local).
- Socket.IO currently decodes the stored token to compare session IDs on a revoke event. Replace this with the in-memory token getter and handle a missing token safely.
- Avoid deleting cached user profile merely because the page is reloading. The cached profile may be used for a non-authoritative loading shell, but only a successful refresh/bootstrap may establish authenticated state.

## Scope decision

No source code changed in this follow-up. The migration touches startup routing, every authenticated API entry point, socket lifecycle, and several independent login methods. Applying a partial change would create a known regression risk. The next implementation should be a single coordinated commit series with testable intermediate states, followed by CI/browser regression checks.
