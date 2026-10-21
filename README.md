# Student Manager

Student Manager is a web application for student and academic administration, with account security and realtime chat features.

## Project structure

| Path | Purpose |
| --- | --- |
| `students_management-frontend/` | React 19 + Vite + Tailwind CSS frontend |
| `students_managerment-api/` | Node.js + Express API, PostgreSQL access, Redis-backed auth/realtime support |
| `students_managerment-api/cloudflare/e2ee-r2-worker/` | Cloudflare Worker adapter for encrypted attachment objects |
| `.github/workflows/` | Automated quality checks and API tests |

## Prerequisites

- Node.js 22 or newer and npm
- PostgreSQL and Redis
- Git
- Optional: Docker Desktop/Compose, Cloudflare Wrangler for local encrypted-attachment testing
- Optional: a Google OAuth **Web client ID** for Google Login

## Local development

### 1. Configure the API

In a terminal:

```bash
cd students_managerment-api
cp .env.example .env
```

Edit `.env` and set the database credentials, a strong `JWT_SECRET`, and the URLs used by your local frontend. If using Google Login, set `GOOGLE_CLIENT_ID` to the same public OAuth Web client ID used by the frontend. Keep real credentials only in ignored local environment files.

For a native API process, `DB_HOST` and `REDIS_HOST` should point to your local services. Docker Compose uses the service names `postgres` and `redis` inside its network.

Install and run:

```bash
npm install
npm run dev
```

The API listens on port `3000` by default. The root endpoint returns a small API health response; it does not verify every dependency.

### 2. Configure the frontend

In another terminal:

```bash
cd students_management-frontend
cp .env.example .env.local
npm install
npm run dev
```

Vite normally serves the frontend at `http://localhost:5173`. Set `VITE_API_BASE_URL=http://localhost:3000` for direct local API access. To use local HTTPS through Nginx, configure `VITE_API_BASE_URL=https://student-manager.local` and ensure Nginx proxies both `/api` and `/socket.io` to the API.

### 3. Google Login

Configure the same Google OAuth Web client ID in:

- Frontend: `VITE_GOOGLE_CLIENT_ID`
- Backend: `GOOGLE_CLIENT_ID`

Add the exact browser origin(s) used by your environment to the Google Cloud Console's **Authorized JavaScript origins**. Google Login is intended for an existing Student Manager account that has explicitly linked that Google identity. Do not put a Google client secret or `JWT_SECRET` in a `VITE_*` variable.

### 4. Database safety

This repository includes SQL migration files, but the application setup instructions do **not** imply that they should be run automatically. Before applying a migration to an existing database, inspect the current schema, confirm the migration's prerequisites, take a verified backup, and plan rollback.

If PostgreSQL is already running in Docker and contains data, do not run `docker compose down -v`, remove volumes, or recreate the database to troubleshoot a startup issue. Inspect the container's data mounts and `PG_VERSION` first.

## Checks

Run from the relevant project directory.

API tests:

```bash
cd students_managerment-api
npm test
```

Frontend checks:

```bash
cd students_management-frontend
npm run lint
npm run test:e2ee
npm run build
```

GitHub Actions runs the automated checks on pull requests. Passing CI does not replace browser/device acceptance testing.

## Security and E2EE notes

- Keep `.env`, `.dev.vars`, access tokens, OAuth secrets, and attachment-ticket secrets out of Git.
- If a secret was ever committed, rotate it; deleting the current file does not erase Git history.
- The encrypted-attachment Worker should use a private R2 bucket and the same high-entropy `E2EE_ATTACHMENT_TICKET_SECRET` as the API.
- E2EE capabilities and rollout readiness vary by feature. Before production use, verify two-account/two-device message encryption, attachment upload/download and decryption, offline/reconnect behavior, identity-change warnings, and recovery/revocation flows in a staging environment.

## Development branch

The current integration branch is `feature/chat-1to1-complete`. Use pull requests for changes, keep database/schema changes separate from routine UI work, and do not merge until the relevant checks and review are complete.
