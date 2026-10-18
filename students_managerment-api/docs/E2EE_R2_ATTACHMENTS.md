# E2EE ciphertext attachments via Cloudflare R2

## Scope and fail-closed behavior

This slice adds an authenticated metadata/ticket API and a Cloudflare Worker that writes only opaque ciphertext objects to a private R2 bucket. It does not yet wire the chat attachment picker or Signal SDK's `remoteObjectStore` adapter into the React UI. The current UI must continue blocking E2EE attachment sends until that client integration and browser acceptance tests are complete.

The API stores only an opaque attachment UUID, conversation/user authorization references, expected ciphertext byte length, state, and timestamps. It does not store a filename, MIME type, plaintext hash, file key, or decrypted content. The Worker uses an opaque random R2 key and sets `application/octet-stream`; R2 must remain private and must not be exposed through a public bucket/custom domain.

## Deploy the Worker

1. Create a private Cloudflare R2 bucket.
2. Install Wrangler in the Worker directory's deployment environment (do not add it to the API runtime dependencies solely for deployment).
3. Edit `cloudflare/e2ee-r2-worker/wrangler.toml`: set `bucket_name` and `E2EE_FRONTEND_ORIGIN` to the exact deployed frontend origin.
4. Generate a random secret of at least 32 bytes. Store the same secret in the API environment as `E2EE_ATTACHMENT_TICKET_SECRET` and in Worker secrets:
   `npx wrangler secret put E2EE_ATTACHMENT_TICKET_SECRET`
   Never commit the secret or place it in frontend/Vite variables.
5. Deploy from `students_managerment-api/cloudflare/e2ee-r2-worker` using Wrangler.
6. Configure the API environment:
   - `E2EE_R2_WORKER_URL=https://<your-worker-host>`
   - `E2EE_ATTACHMENT_TICKET_SECRET=<same secret as Worker>`
7. Keep the feature unavailable until the database migration has been reviewed and applied to a disposable database matching the deployed schema.

The API returns 503 if the Worker URL or sufficiently long ticket secret is missing. The Worker validates HMAC-SHA256 tickets, expiry, HTTP method, attachment UUID, and exact expected size. Upload bytes are streamed with a 500 MiB hard ceiling; the Worker rejects overrun/underrun and uses a conditional create so a ticket cannot overwrite an existing object. Download tickets are short-lived and issued only after the API confirms membership in an E2EE-enabled conversation.

## API flow

- `POST /api/e2ee/relay/conversations/:conversationId/attachments/upload-ticket` with `{ "ciphertextSize": <bytes> }`
- Browser PUTs the **already encrypted bytes** to `uploadUrl` with `Authorization: Bearer <uploadToken>` and `Content-Type: application/octet-stream`.
- `POST /api/e2ee/relay/attachments/:attachmentId/complete` verifies the object exists and its actual size matches the declared ciphertext size before marking it uploaded.
- `POST /api/e2ee/relay/attachments/:attachmentId/download-ticket` returns a short-lived GET ticket only to a current conversation member. The browser downloads bytes and decrypts locally with the key/nonce carried inside the Signal SDK's encrypted attachment reference, never in server metadata.

The current API scope allows only conversations whose existing E2EE status is enabled. Group E2EE is still disabled, so this endpoint cannot be used to bypass group activation.

## Operational requirements before enabling in the UI

- Configure Worker CORS to the exact frontend origin and test OPTIONS/PUT/GET/HEAD in separate browser profiles.
- Add scheduled cleanup for expired pending metadata and orphaned R2 objects; this slice does not create a cron job.
- Monitor R2 storage and request costs; enforce per-user quotas before production rollout.
- Run the migration against a disposable schema matching the deployed schema first. Do not apply it to the live database without backup/review.
- Verify ticket expiry, token replay, oversized/undersized upload, membership removal, revoked membership, and E2EE-disabled conversation cases.
- Do not log bearer tickets, object keys, ciphertext bytes, filenames, or attachment keys.
- Keep chat UI upload disabled until the official SDK's attachment encryption/decryption and remote object store contract are integrated and tested. The Worker only transports bytes; it does not encrypt them.
