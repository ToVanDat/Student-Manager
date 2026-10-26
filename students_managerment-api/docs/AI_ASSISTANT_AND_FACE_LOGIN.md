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

The current release grounds responses in read-only subject, department, class, and semester catalog queries. It performs parameterized SQL lookups for explicitly named catalog terms. The first document-RAG slice now supports admin-only UTF-8 TXT upload (1 MB maximum), bounded chunking, `nomic-embed-text` embeddings, PostgreSQL/pgvector storage, role-filtered cosine-distance retrieval, and source metadata returned with streamed answers. PDF/DOCX parsing, OCR, re-indexing/deletion workflows, and vector ANN indexes are not implemented yet. Until the guarded schema migration is applied and pgvector is available, the assistant silently falls back to its existing catalog-only context. Admin prompts additionally receive aggregate counts only. No student PII, grades, or individual enrollment records are sent to the model. Student accounts are not yet linked to student rows through a verified foreign key, so personal grade/schedule lookup is intentionally unavailable to all chatbot users until that identity mapping and row-level authorization are audited and implemented.

Conversation history is stored in Redis, scoped to the authenticated user and current login session, with a 30-day TTL for the current implementation. It is not written to PostgreSQL and expires automatically. A new login session does not automatically share the previous session's conversation list. Ollama generation and the catalog-context load are limited to one in-flight request per Node.js process to protect low-memory local machines; this is not a distributed limit across multiple backend replicas. Do not send passwords, access/refresh tokens, identity documents, or sensitive personal data to the assistant. Model output is untrusted text; it is not executed as SQL, HTML, or application commands.

## Face login decision

The repository already has WebAuthn/passkey registration and login. The server requires user verification during both registration and authentication and stores the credential public key, not the device's biometric data. On supported devices, the platform authenticator may verify the user with Windows Hello face recognition, Apple Face ID, fingerprint, or the device PIN.

This is the recommended first production path for a web application: the browser and operating system perform biometric verification and the application receives a signed WebAuthn assertion. The application cannot force the authenticator to use face specifically, and it never receives a face image or biometric template. The feature must therefore be described as **device biometric/passkey login**, not guaranteed face-only recognition.

A custom camera-based face matcher using MediaPipe/TF.js is not enabled in this release. Detection landmarks alone do not establish identity, and a browser-only face template is not a safe cross-device login credential. Do not store raw face images or embeddings in the existing `users` row or send them to Ollama. A separate threat model, vetted recognition/PAD models and licenses, encrypted biometric-template lifecycle, recovery flow, anti-replay/liveness evaluation, and explicit user consent are required before custom face matching can be considered.

## Local and production boundaries

- Local Ollama defaults to loopback only. When the API runs inside Docker, `127.0.0.1` refers to the API container, not the Windows host; configure a private, reachable Ollama endpoint using HTTPS or a trusted private network rather than exposing port `11434` publicly.
- For remote Ollama, use HTTPS and private network access; do not expose the model endpoint to the public internet.
- WebAuthn requires a secure context (HTTPS, with localhost permitted for development) and correct `WEBAUTHN_ORIGIN` / `WEBAUTHN_RP_ID`.
- No database migration is introduced by this feature.

## Explicitly out of scope for this release

- End-to-end document RAG is not enabled yet: document upload/parsing, indexing orchestration, vector retrieval, citations, and re-indexing remain pending. A guarded pgvector schema draft and isolated text-chunking/Ollama-embedding helpers are groundwork only; no assistant RAG endpoints call them yet.

## Document RAG (TXT MVP)

The guarded schema is in `sql/assistant_rag_schema_migration.sql`. It requires the database operator to install/enable pgvector first; the script deliberately does not run `CREATE EXTENSION` and derives the `users.id` type before creating the uploader foreign key. It stores chunk text and 768-dimensional vectors in PostgreSQL, not in the E2EE R2 bucket. Runtime defaults are centralized in `src/config/ai.js` (Ollama `http://127.0.0.1:11434`, chat model `qwen2.5:3b`, embedding model `nomic-embed-text`); environment overrides remain supported. Pull the embedding model locally with `ollama pull nomic-embed-text`. Admin-only endpoints are `GET /api/assistant/documents` and `POST /api/assistant/documents` (multipart field `document`, plus `title` and `visibility=all|student|admin`). Student-role accounts retrieve only `all` and `student` documents; admins can retrieve all scopes. Uploads are memory-buffered, UTF-8 validated, limited to TXT/1 MB, and indexed sequentially to protect low-memory Ollama. The UI exposes a knowledge-base panel only to admins. Do not run the schema script until pgvector availability, database backups, and the target schema have been reviewed.
- Personal grades, attendance, schedules, or enrollment details until a verified account-to-student foreign-key mapping and row-level authorization are confirmed.
- Chatbot-triggered CRUD, SQL generation/execution, or administrative actions.
- Custom camera face recognition, biometric embeddings, or liveness/PAD. MediaPipe detection alone is not identity verification.
