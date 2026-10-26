# AI Assistant and Face / Biometric Login

## AI assistant (Ollama)

The authenticated global assistant is mounted in the shared React application shell and calls `POST /api/assistant/chat`. It uses the existing access-token middleware and a Redis per-user limit (20 requests/minute).

Backend environment:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
```

Run Ollama locally and pull the model:

```powershell
ollama pull qwen2.5:3b
ollama serve
```

The backend makes server-to-server requests to Ollama; the browser never connects directly to Ollama. Configure a private network or HTTPS endpoint when Ollama is hosted remotely. Do not expose Ollama's port publicly.

The current release grounds responses in read-only subject, department, class, and semester catalog queries. It performs parameterized SQL lookups for explicitly named catalog terms. The first document-RAG slice supports admin-only UTF-8 TXT upload (1 MB maximum), strict UTF-8 decoding (malformed byte sequences are rejected), BOM/newline normalization, binary/NUL rejection, safe source-name handling, bounded chunking, `nomic-embed-text` embeddings, PostgreSQL/pgvector storage, role-filtered cosine-distance retrieval, and source metadata returned with streamed answers. PDF/DOCX parsing, OCR, re-indexing/deletion workflows, and vector ANN indexes are not implemented yet. Until the guarded schema migration is applied and pgvector is available, the assistant falls back to catalog-only context and explicitly tells the user that document retrieval is unavailable. Admin prompts additionally receive aggregate counts only. No student PII, grades, or individual enrollment records are sent to the model. Student accounts are not yet linked to student rows through a verified foreign key, so personal grade/schedule lookup is intentionally unavailable to all chatbot users until that identity mapping and row-level authorization are audited and implemented.

The SSE chat endpoint propagates client disconnects to the Ollama request so a closed browser stream can cancel generation and release the in-process request slot. Conversation history is stored in Redis, scoped to the authenticated user and current login session, with a 30-day TTL for the current implementation. It is not written to PostgreSQL and expires automatically. A new login session does not automatically share the previous session's conversation list. The chatbot accepts one full request at a time per Node.js process, and Ollama inference calls (chat generation and RAG embeddings) share a separate single-slot gate to protect low-memory local machines. Both limits are process-local, not distributed across multiple backend replicas. Do not send passwords, access/refresh tokens, identity documents, or sensitive personal data to the assistant. Model output is untrusted text; it is not executed as SQL, HTML, or application commands.

## Access-token refresh and passkey troubleshooting

The frontend keeps the access token in memory and sends the refresh cookie with credentialed requests. The shared Axios client retries an eligible protected request once after HTTP 401 by calling the refresh endpoint; the AuthContext also schedules proactive refresh before the access token expires. Passkey registration/list/delete, sensitive re-authentication, Google account-linking, and QR approval use this shared client so they do not bypass the refresh-and-retry behavior. Passkey login options/verification and the refresh endpoint remain unauthenticated/direct requests by design.

The refresh cookie is HttpOnly and scoped to `/api/auth`. Verify that the frontend/API deployment uses a compatible site arrangement for the configured `SameSite=Lax` cookie and that the browser sends the cookie on `POST /api/auth/refresh`. Do not copy cookie values, bearer tokens, or challenge secrets into issue reports.

Passkey endpoints return `503 ADVANCED_AUTH_SCHEMA_NOT_READY` when the required advanced-auth table/column is absent, rather than exposing PostgreSQL details as a generic authentication failure. Confirm `user_webauthn_credentials` exists and that its `user_id` type matches `users.id` before applying the migration. A `503 WEBAUTHN_CONFIG_NOT_READY` indicates an invalid/missing origin or RP ID configuration. `WEBAUTHN_ORIGIN` must match the browser origin (HTTPS in production; localhost is permitted for local development), and `WEBAUTHN_RP_ID` must be the origin host or a valid parent domain. These checks do not apply migrations or modify database data.

## Face login decision

The repository already has WebAuthn/passkey registration and login. The server requires user verification during both registration and authentication and stores the credential public key, not the device's biometric data. On supported devices, the platform authenticator may verify the user with Windows Hello face recognition, Apple Face ID, fingerprint, or the device PIN.

This is the recommended first production path for a web application: the browser and operating system perform biometric verification and the application receives a signed WebAuthn assertion. The application cannot force the authenticator to use face specifically, and it never receives a face image or biometric template. The feature must therefore be described as **device biometric/passkey login**, not guaranteed face-only recognition.

A custom camera-based face matcher using MediaPipe/TF.js is not enabled in this release. Detection landmarks alone do not establish identity, and a browser-only face template is not a safe cross-device login credential. Do not store raw face images or embeddings in the existing `users` row or send them to Ollama. A separate threat model, vetted recognition/PAD models and licenses, encrypted biometric-template lifecycle, recovery flow, anti-replay/liveness evaluation, and explicit user consent are required before custom face matching can be considered.

## Local and production boundaries

- Local Ollama defaults to loopback only. When the API runs inside Docker, `127.0.0.1` refers to the API container, not the Windows host; configure a private, reachable Ollama endpoint using HTTPS or a trusted private network rather than exposing port `11434` publicly.
- For remote Ollama, use HTTPS and private network access; do not expose the model endpoint to the public internet.
- WebAuthn requires a secure context (HTTPS, with localhost permitted for development) and correct `WEBAUTHN_ORIGIN` / `WEBAUTHN_RP_ID`.
- The WebAuthn/passkey flow uses `user_webauthn_credentials`; its schema is defined in `sql/advanced_auth_features_migration.sql` and must be verified against the live database before applying. The separate TXT RAG MVP uses the guarded `sql/assistant_rag_schema_migration.sql`; neither migration is run automatically by the application.

## Current limitations and explicitly out-of-scope capabilities

- The current document-RAG implementation is a TXT-only MVP. PDF/DOCX parsing, OCR, re-indexing, document deletion, and vector ANN indexes are not implemented.
- RAG requires the guarded schema migration and pgvector to be provisioned. Until both tables and the extension are available, retrieval is marked unavailable; the assistant falls back to catalog-only answers and discloses that the knowledge base could not be reached.
- Document ingestion is limited to one embedding job at a time per Node.js process. This is a local process guard, not a distributed lock across multiple API replicas.
- Chat history remains scoped to the authenticated user and login session; it is not shared automatically across new sessions or devices.
- Personal grades, attendance, schedules, and enrollment details remain unavailable until a verified account-to-student relationship and row-level authorization are confirmed.
- Chatbot-triggered CRUD, SQL generation/execution, or administrative actions are not supported.
- Custom camera face recognition, biometric embeddings, and liveness/PAD are not implemented. MediaPipe detection alone is not identity verification.

## Document RAG (TXT MVP)

The guarded schema is in `sql/assistant_rag_schema_migration.sql`. It requires the database operator to install/enable pgvector first; the script deliberately does not run `CREATE EXTENSION` and derives the `users.id` type before creating the uploader foreign key. It stores chunk text and 768-dimensional vectors in PostgreSQL, not in the E2EE R2 bucket. Runtime defaults are centralized in `src/config/ai.js` (Ollama `http://127.0.0.1:11434`, chat model `qwen2.5:3b`, embedding model `nomic-embed-text`); environment overrides remain supported. Pull the embedding model locally with `ollama pull nomic-embed-text`. Admin-only endpoints are `GET /api/assistant/documents` and `POST /api/assistant/documents` (multipart field `document`, plus `title` and `visibility=all|student|admin`). Student-role accounts retrieve only `all` and `student` documents; admins can retrieve all scopes. Uploads are memory-buffered, decoded with fatal UTF-8 validation, reject malformed/binary/NUL content, normalize BOM and line endings, are limited to TXT/1 MB, and are indexed sequentially to protect low-memory Ollama. The UI exposes a knowledge-base panel only to admins. Do not run the schema script until pgvector availability, database backups, and the target schema have been reviewed.
- Personal grades, attendance, schedules, or enrollment details until a verified account-to-student foreign-key mapping and row-level authorization are confirmed.
- Chatbot-triggered CRUD, SQL generation/execution, or administrative actions.
- Custom camera face recognition, biometric embeddings, or liveness/PAD. MediaPipe detection alone is not identity verification.


## Chat experience: latest-turn editing, regeneration and feedback

- The assistant UI supports editing the latest user prompt and regenerating the latest completed answer. The API replaces only the latest persisted user/assistant pair in the Redis history for the authenticated user + session + conversation; older turns are retained.
- A failed or stopped stream is not treated as a persisted turn. Editing such a prompt submits a new turn instead of deleting the previous successful turn.
- Helpful / not-helpful feedback is stored in Redis under a key scoped to user, session, conversation and SHA-256 of the latest assistant answer. Feedback expires after 30 days and is accepted only when the supplied hash matches the latest persisted assistant answer. This is lightweight operational feedback, not a durable analytics/reporting system.
- Document upload currently supports UTF-8 plain-text `.txt` files only (1 MB). PDF and DOCX extraction are not enabled; do not rename those formats to `.txt`. Supporting them requires vetted parsers, content validation, page/paragraph metadata preservation, resource limits and dedicated tests before enabling uploads.
- RAG citations should use only returned document sources and page metadata. TXT documents have no page number; page-level citations will be available only for formats whose extractor reliably preserves page boundaries.
