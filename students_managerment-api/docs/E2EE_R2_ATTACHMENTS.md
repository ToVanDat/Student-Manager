# E2EE ciphertext attachments via Cloudflare R2

## Scope and fail-closed behavior

This slice adds an authenticated metadata/ticket API and a Cloudflare Worker that writes only opaque ciphertext objects to a private R2 bucket. A client-side `SignalProtocolRemoteObjectStore` adapter now maps the SDK upload/download contract to the authenticated API. It is intentionally not configured on the singleton Signal client and the chat attachment picker remains blocked pending real-browser acceptance and deployment validation.

The API stores only an opaque attachment UUID, conversation/user authorization references, expected ciphertext byte length, SHA-256 digest of ciphertext, a hash commitment to the SDK read capability, retry preparation identity, state, and timestamps. It does not store a filename, MIME type, raw read capability, file key, or decrypted content. The Worker uses an opaque random R2 key and sets `application/octet-stream`; R2 must remain private and must not be exposed through a public bucket/custom domain.

## Deploy the Worker

1. Create a private Cloudflare R2 bucket.
2. Install Wrangler in the Worker directory's deployment environment (do not add it to the API runtime dependencies solely for deployment).
3. Edit `cloudflare/e2ee-r2-worker/wrangler.toml`: set `bucket_name` and `E2EE_FRONTEND_ORIGIN` to the exact deployed frontend origin.
4. Generate a random secret of at least 32 bytes. Store the same secret in the API environment as `E2EE_ATTACHMENT_TICKET_SECRET` and in Worker secrets:
   `npx wrangler secret put E2EE_ATTACHMENT_TICKET_SECRET --name student-manager-e2ee-r2`
   Never commit the secret or place it in frontend/Vite variables.
5. Deploy from `students_managerment-api/cloudflare/e2ee-r2-worker` using Wrangler.
6. Configure the API environment:
   - `E2EE_R2_WORKER_URL=https://<your-worker-host>`
   - `E2EE_ATTACHMENT_TICKET_SECRET=<same secret as Worker>`
7. Keep the feature unavailable until both `sql/e2ee_attachment_objects_migration.sql` and `sql/e2ee_attachment_retry_identity_migration.sql` have been reviewed and applied in that order to a disposable database matching the deployed schema. The retry-identity migration is designed to be rerunnable.

The API returns 503 if the Worker URL or sufficiently long ticket secret is missing. The Worker validates HMAC-SHA256 tickets, expiry, HTTP method, attachment UUID, exact expected size, and SHA-256 of the actual uploaded bytes using R2 checksum validation. Upload bytes are streamed with a 500 MiB hard ceiling; the Worker rejects overrun/underrun and uses a conditional create so a ticket cannot overwrite an existing object. HEAD receipts expose the verified SHA-256 for SDK reconciliation. Download tickets are short-lived and issued only after the API confirms membership in an E2EE-enabled conversation.

## API flow

- `POST /api/e2ee/relay/conversations/:conversationId/attachments/upload-ticket` with ciphertext size plus SDK `requestId`, immutable `preparedAt`, Base64 SHA-256 `digest`, and Base64 `readCapabilityDigest` for retry-stable reservations.
- Browser PUTs the **already encrypted bytes** to `uploadUrl` with `Authorization: Bearer <uploadToken>` and `Content-Type: application/octet-stream`.
- `POST /api/e2ee/relay/attachments/:attachmentId/complete` verifies the object exists and its actual size and SHA-256 match the immutable upload reservation before marking it uploaded.
- `POST /api/e2ee/relay/attachments/:attachmentId/reconcile` reconciles uncertain uploads against R2 and returns an SDK-compatible receipt only after stored bytes are verified.
- `POST /api/e2ee/relay/attachments/uploads/resolve` resolves a retry identity to its original conversation after navigation/reload. `POST /api/e2ee/relay/attachments/uploads/abandon` safely closes an upload and deletes its object; `DELETE /api/e2ee/relay/attachments/:attachmentId` deletes an uploaded object owned by the caller.
- `POST /api/e2ee/relay/attachments/:attachmentId/download-ticket` requires the `readCapability` carried inside the SDK encrypted attachment pointer and verifies its SHA-256 commitment before issuing a short-lived GET ticket. Conversation membership is checked again. The raw capability, media key, and plaintext never enter server metadata.

The current API scope allows only conversations whose existing E2EE status is enabled. Group E2EE is still disabled, so this endpoint cannot be used to bypass group activation.

## Operational requirements before enabling in the UI

- Configure Worker CORS to the exact frontend origin and test OPTIONS/PUT/GET/HEAD in separate browser profiles.
- Add scheduled cleanup for expired pending metadata and orphaned R2 objects; this slice does not create a cron job.
- Monitor R2 storage and request costs; enforce per-user quotas before production rollout.
- Run the migration against a disposable schema matching the deployed schema first. Do not apply it to the live database without backup/review.
- Verify ticket expiry, token replay, oversized/undersized upload, membership removal, revoked membership, and E2EE-disabled conversation cases.
- Do not log bearer tickets, object keys, ciphertext bytes, filenames, or attachment keys.
- Keep chat UI upload disabled until the official SDK's attachment encryption/decryption and remote object store contract are integrated and tested. The Worker only transports bytes; it does not encrypt them.

## SDK adapter status and remaining gates

`students_management-frontend/src/services/e2ee/e2eeR2ObjectStore.js` implements `createUpload`, `completeUpload`, `createDownload`, `reconcileUpload`, `abandonUpload`, and `deleteObject`. The adapter persists request/conversation binding in IndexedDB before reserving the upload and also resolves the reservation through the authenticated API after a lost response or navigation. The backend scopes request IDs to the authenticated account, verifies R2 checksums independently of caller metadata, and provides idempotent reconciliation/deletion paths. CI covers API tests, the Worker ticket/checksum tests, migration reruns, relay PostgreSQL integration, frontend lint/build, and the SDK round-trip. The adapter is now supplied to `createSignalProtocolClient` through the SDK's `adapters.remoteObjectStore` option. The conversation resolver deliberately returns no conversation until the chat layer provides an authenticated, E2EE-enabled active conversation; therefore attachment reservation fails closed for now. No real-browser E2EE attachment send/receive has been completed. Keep the chat attachment picker blocked until browser acceptance and deployed private-R2 tests pass.
