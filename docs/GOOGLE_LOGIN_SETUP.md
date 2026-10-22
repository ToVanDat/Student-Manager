# Google Login setup

Google Login uses Google Identity Services in the browser and verifies the returned ID token in the API. On first sign-in, it creates a Student Manager account with the default `user` role only when the Google identity is not linked and the verified email is not already used by an internal account. It never links or merges accounts based on matching email alone.

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

- `POST /api/auth/google/login` — verifies the ID token, signs in an already-linked Google identity, or creates a new `user` account if the verified email is not already used.
- `POST /api/auth/google/link` — links Google while the user is authenticated.
- `GET /api/auth/google/link` — reads link status.
- `DELETE /api/auth/google/link` — unlinks after current-password confirmation.

The backend uses `user_oauth_accounts` with `provider`, `provider_subject`, `provider_email`, and `user_id`. A narrow, additive migration is included at `students_managerment-api/sql/google_oauth_accounts_migration.sql`. It creates only the OAuth-link table and index; it does not modify `users` or existing user data. The broader `advanced_auth_features_migration.sql` also creates this table but additionally creates passkey and QR-login tables; its OAuth `user_id` is declared `BIGINT`, which does not match this project's verified `users.id INTEGER`. Do not run that broader migration against this database. Use only the narrow Google migration whose `user_id` is `INTEGER`. First confirm the target database and back it up, then apply the narrow Google migration if the table is absent. The migration uses `IF NOT EXISTS` and uniqueness constraints to avoid duplicate provider links.

Google identity is keyed by Google's stable `sub`, not by email alone. If the Google `sub` is already linked, login returns the mapped Student Manager account and preserves its existing role. If this is a new Google identity and the verified email is not in `users`, the API creates a new internal account with role `user`, an automatically generated username, and a random unguessable password hash (the Google password is never stored). If the email already belongs to a Student Manager account, login is rejected with instructions to sign in to that existing account and explicitly link Google in **Settings → Security**. It never auto-links based on email and never grants `admin` from Google.

## 4. Verification checklist

1. Restart frontend and API; confirm the Google button renders without a GIS script-loading error.
2. First-time Google sign-in with a verified email not used by any internal account: it should create one `user` account and sign in.
3. Repeat the same Google sign-in: it must reuse the same internal user ID and must not create a duplicate.
4. Google sign-in with an email already used by a password account but an unlinked Google `sub`: it must be rejected without auto-linking; sign in with the existing password and link explicitly in Settings → Security.
5. Sign out, use the linked Google identity, and confirm the same Student Manager user ID/role/data is returned.
6. Attempt to link the same Google identity to a different Student Manager account: it must be rejected.
7. Test a disabled Student Manager account and an invalid/expired ID token; neither may establish a session.
8. Test both `http://localhost:5173` and `https://student-manager.local` only after their matching Google origins, API URL, and CORS allowlist are configured.

A configured Client ID alone does not prove the browser-to-API flow works. Real end-to-end verification requires the Google Cloud OAuth settings and a database with the required linking table.
