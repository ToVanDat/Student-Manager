# E2EE R2 Worker: local setup and troubleshooting

This guide is for local development only. It does not deploy a production Worker or require a custom domain.

## Secret contract

The backend attachment service reads `process.env.E2EE_ATTACHMENT_TICKET_SECRET` and signs tickets with HMAC-SHA256. The Worker verifies the same signature using `env.E2EE_ATTACHMENT_TICKET_SECRET`. Both processes must use the exact same value. `JWT_SECRET` is not read by the Worker code and is not a substitute for this setting. Do not delete or rotate `JWT_SECRET` if the API uses it for login tokens.

Generate a high-entropy local value in a terminal:

```cmd
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep the output private. Use that exact value in both local configuration files.

## Worker local configuration

From `students_managerment-api/cloudflare/e2ee-r2-worker`:

1. Copy `.dev.vars.example` to `.dev.vars` (`copy .dev.vars.example .dev.vars` in Windows Command Prompt).
2. Replace the placeholder in `.dev.vars` with a fresh random value generated above.
3. Put the exact same value in the backend `.env` as `E2EE_ATTACHMENT_TICKET_SECRET`.
4. `.dev.vars` is ignored by Git; never commit it or paste its value into chat/issues.
5. Keep `E2EE_FRONTEND_ORIGIN=http://localhost:5173` while the frontend uses that origin.
6. Start the Worker with `npx wrangler dev`.

The checked-in `wrangler.toml` binds `E2EE_BUCKET` to a bucket name. Wrangler local mode normally uses local R2 emulation unless remote bindings are explicitly enabled. A successful local request does not prove data was written to the Cloudflare-hosted bucket.

## Backend local configuration

In the backend's ignored local `.env`, set:

```dotenv
E2EE_ATTACHMENT_TICKET_SECRET="THE_EXACT_SAME_LOCAL_VALUE"
E2EE_R2_WORKER_URL="http://127.0.0.1:8787"
```

Keep all existing variables. Restart both backend and Worker after editing environment files. The backend should continue to validate conversation membership and E2EE status before issuing a ticket.

## Endpoint behavior

- `GET /` returns a small JSON health response (`service` and `status: ok`); it does not test R2 connectivity.
- Object operations use `/v1/objects/{attachmentId}` with `PUT`, `GET`, `HEAD`, or `DELETE`.
- An unauthenticated request or a request with a made-up ticket should return 403. That is expected and does not test successful upload.
- A successful upload requires a backend-issued ticket in `Authorization: Bearer <ticket>` and the exact ciphertext size and digest bound into that ticket.
- Do not test by reusing a ticket with a different method, object ID, size, digest, user, or conversation.

## Safe verification sequence

1. Start Worker local and API.
2. Sign in through the application and send an E2EE attachment through the UI so the API issues a real short-lived ticket.
3. Verify upload completes, then verify recipient download and client-side decryption using a second account/device.
4. Verify an invalid/expired ticket is rejected and an existing object cannot be overwritten.
5. Check API and Worker logs for errors, but never paste secret values or bearer tickets into logs/issues.

## Production is a separate step

Do not use localhost origin settings for a deployed Worker. Before production deployment, define a real frontend origin, verify the intended Cloudflare R2 bucket, configure `E2EE_ATTACHMENT_TICKET_SECRET` as a deployed Worker secret and as a backend secret through the deployment platform, and run staging acceptance tests. The secret value must never be placed in `wrangler.toml`, frontend code, or source control.
