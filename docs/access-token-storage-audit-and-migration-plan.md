# Access-token storage audit and migration plan

Date: 2026-10-25  
Branch reviewed: `feature/chat-1to1-complete`  
Scope: frontend token lifecycle, Axios, Socket.IO, auth endpoints, E2EE relay compatibility.  
Status: read-only audit; no authentication behavior or database schema changed.

## Current verified behavior

- `students_management-frontend/src/api/client.js` initializes its module-level access token from `localStorage`.
- `setAccessToken()` writes/removes the access token in `localStorage` and dispatches `auth:access-token-changed`.
- The Axios request interceptor attaches the bearer token. The response interceptor refreshes after 401 and retries once.
- `AuthContext.jsx` independently initializes React auth state from `localStorage`, schedules proactive refresh, and synchronizes token changes through a window event.
- Socket.IO authenticates with `socket.auth = { accessToken }`, then supports `auth:token-refresh` without deliberately tearing down an active call. Session-revocation handling currently reads and removes the token directly from `localStorage`.
- `authApi.js` contains several direct localStorage reads for logout and authenticated Google/Passkey/QR operations. These use a separate Axios instance, not the shared `apiClient` interceptor.
- Chat APIs and most E2EE relay APIs use the shared `apiClient`; E2EE device-token headers are a separate credential and must not be confused with the account access token.
- Backend access middleware validates JWT issuer/audience, subject, session ID, Redis token hash, active session, and current user state. It does not require the browser to persist the access token.
- Advanced auth session responses return the access token in JSON and set the refresh token in an HttpOnly cookie. The refresh cookie currently uses HttpOnly, SameSite=Lax, a seven-day lifetime, and Secure in production.

## Security assessment

Persisting a bearer access token in localStorage makes token exfiltration possible if an attacker executes JavaScript in the origin (XSS). The in-memory variable in `client.js` does not reduce that exposure while the same token is also persisted.

The refresh token is already HttpOnly, which is a stronger storage boundary. The access token can therefore be moved to memory without requiring a new database table or changing JWT validation. However, this is a cross-cutting migration, not a one-line storage change.

## Recommended target architecture

1. Keep the refresh token exclusively in the HttpOnly cookie.
2. Keep the access token only in JavaScript memory (shared token module); never persist it in localStorage, sessionStorage, IndexedDB, or logs.
3. At application startup, call the refresh endpoint once before treating a remembered user profile as authenticated. The profile cache alone must never grant access.
4. Make every authenticated API request obtain the current in-memory token through one shared Axios client. Remove direct localStorage bearer construction from authApi.
5. Keep Socket.IO on the same in-memory token source. On refresh, update socket auth and use the existing token-refresh event; do not force-disconnect an active WebRTC call.
6. Coordinate refresh across tabs. The current Web Locks code serializes refreshes, but a waiting tab must not blindly rotate a cookie that another tab has just rotated. The implementation needs a safe post-lock recheck/coordination strategy and a fallback for browsers without Web Locks.
7. Distinguish invalid refresh credentials (401) from transient network/5xx errors. Only definitive invalidation should clear the local profile and end the session.
8. Clear in-memory credentials and disconnect authenticated transports on logout, session revocation, and confirmed refresh rejection.
9. Keep E2EE device credentials and local cryptographic keystore lifecycle independent from account access-token persistence.

## Migration order (must be implemented as one coordinated change set)

- Inventory all token consumers, including direct `localStorage` reads, custom Axios instances, fetch calls, Socket.IO, WebRTC signaling, E2EE, downloads, and settings APIs.
- Add a single memory-only token source with explicit get/set/clear and change notifications.
- Refactor authApi authenticated methods to use the shared client or inject the in-memory bearer token without reading storage.
- Implement startup refresh/bootstrap state so protected routes wait for session restoration rather than briefly redirecting to login.
- Update AuthContext, proactive refresh, response interceptor, logout, and session-revocation paths to use the shared source.
- Update Socket.IO authentication and token refresh to use the same source while preserving call continuity.
- Remove all access-token persistence and stale token cleanup code only after every consumer has migrated.
- Verify backend cookie/CORS/HTTPS behavior for local HTTP and production HTTPS; do not weaken cookie flags to compensate for a deployment-origin mismatch.
- Run frontend lint/build and backend tests, then manual browser checks for password login, Google login/link, passkey login/registration, QR login/approval, reload restoration, two-tab refresh, logout, session revoke, chat, E2EE relay, incoming/outgoing calls, and network/5xx recovery.

## Explicit non-goals

- Do not change JWT signing, issuer/audience, token claims, Redis revocation, refresh-token hashing/rotation, or database schema as part of the frontend storage migration unless a separate verified defect requires it.
- Do not switch the access token to a cookie in this migration. That would require a separate CSRF and WebSocket authentication design.
- Do not clear or reset the E2EE local keystore when the account access token changes.
- Do not claim XSS is solved: memory-only storage reduces persistence/exfiltration opportunities but malicious same-origin JavaScript can still act as the user while running.

## Audit limitation

This is a repository-source audit, not a runtime security test. No browser session, live database, Redis instance, HTTPS deployment, or automated test suite was exercised in this audit. The migration is intentionally not applied until the full consumer inventory and test coverage are ready.
