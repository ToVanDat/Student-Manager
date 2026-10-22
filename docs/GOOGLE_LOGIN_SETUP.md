# Google Login setup

Google Login uses Google Identity Services in the browser and verifies the returned ID token in the API. It signs in only to a Student Manager account that has already linked that Google identity. It does not create or merge accounts based on email.

## 1. Environment variables

Copy the examples into local, ignored environment files:

- Frontend: `students_management-frontend/.env.local`
- Backend: `students_managerment-api/.env`

Set the same Web OAuth Client ID in both files:

```dotenv
# students_management-frontend/.env.local
VITE_GOOGLE_CLIENT_ID=38499596029-h8ff2pbip076q6jodjmi4g65f4r7qrjg.apps.googleusercontent.com
VITE_API_BASE_URL=http://localhost:3000
```

```dotenv
# students_managerment-api/.env
GOOGLE_CLIENT_ID=38499596029-h8ff2pbip076q6jodjmi4g65f4r7qrjg.apps.googleusercontent.com
```

The Client ID is public configuration. Do not add a Google client secret to Vite or commit real `.env` files. The API still requires its normal `JWT_SECRET`, PostgreSQL and Redis configuration to create the existing session.

After changing Vite environment variables, restart the frontend dev server. Restart the API after changing backend `.env`.

## 2. Google Cloud Console

Open the OAuth 2.0 Client ID corresponding to the supplied Client ID and confirm:

- Application type is **Web application**.
- Authorized JavaScript origins include the exact origins used in development:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `https://student-manager.local` (only when using local HTTPS)
- For production, add the real HTTPS site origin separately.
- Configure the OAuth consent screen and add the Google accounts used for testing as test users if the app remains in Testing mode.

Google Identity Services uses the browser ID-token flow here; do not invent a redirect URI for this button flow. Never put a client secret in frontend environment variables.

## 3. Account-linking and database prerequisite

The API routes are:

- `POST /api/auth/google/login` — verifies the ID token and resolves the existing linked account.
- `POST /api/auth/google/link` — links Google while the user is authenticated.
- `GET /api/auth/google/link` — reads link status.
- `DELETE /api/auth/google/link` — unlinks after current-password confirmation.

The backend uses `user_oauth_accounts` with `provider`, `provider_subject`, `provider_email`, and `user_id`. Before testing, verify that the additive migration creating this table and its uniqueness constraints has already been applied to the target database. Do not run an unreviewed migration against an existing database. If the table is missing, linking and Google login will fail even when OAuth variables are correct.

Google identity is keyed by Google's stable `sub`, not by email alone. A Google account must first be linked from **Settings → Security** while signed in with the intended Student Manager account. The existing Student Manager role, username and data remain unchanged.

## 4. Verification checklist

1. Restart frontend and API; confirm the Google button renders without a GIS script-loading error.
2. Attempt Google login with an unlinked Google account: it should show the link-first guidance and must not create a new Student Manager account.
3. Sign in with username/password, link that Google account in Settings → Security, and confirm the link status/email appears.
4. Sign out, use Google Login, and confirm the same Student Manager user ID/role/data is returned.
5. Attempt to link the same Google identity to a different Student Manager account: it must be rejected.
6. Test a disabled Student Manager account and an invalid/expired ID token; neither may establish a session.
7. Test both `http://localhost:5173` and `https://student-manager.local` only after their matching Google origins, API URL, and CORS allowlist are configured.

A configured Client ID alone does not prove the browser-to-API flow works. Real end-to-end verification requires the Google Cloud OAuth settings and a database with the required linking table.
