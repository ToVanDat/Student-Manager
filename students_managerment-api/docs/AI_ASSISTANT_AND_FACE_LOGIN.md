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

The first release grounds responses in read-only subject and semester catalogs. Admin prompts additionally receive aggregate counts only. No student PII, grades, or individual enrollment records are sent to the model. Student accounts are not yet linked to student rows through a verified foreign key, so personal grade/schedule lookup is intentionally unavailable to all chatbot users until that identity mapping and row-level authorization are audited and implemented.

Conversation history is stored in Redis, scoped to the authenticated user and current login session, with a one-hour TTL. It is not written to PostgreSQL and is removed automatically when the Redis key expires. Do not send passwords, access/refresh tokens, identity documents, or sensitive personal data to the assistant. Model output is untrusted text; it is not executed as SQL, HTML, or application commands.

## Face login decision

The repository already has WebAuthn/passkey registration and login. The server requires user verification during both registration and authentication and stores the credential public key, not the device's biometric data. On supported devices, the platform authenticator may verify the user with Windows Hello face recognition, Apple Face ID, fingerprint, or the device PIN.

This is the recommended first production path for a web application: the browser and operating system perform biometric verification and the application receives a signed WebAuthn assertion. The application cannot force the authenticator to use face specifically, and it never receives a face image or biometric template. The feature must therefore be described as **device biometric/passkey login**, not guaranteed face-only recognition.

A custom camera-based face matcher using MediaPipe/TF.js is not enabled in this release. Detection landmarks alone do not establish identity, and a browser-only face template is not a safe cross-device login credential. Do not store raw face images or embeddings in the existing `users` row or send them to Ollama. A separate threat model, vetted recognition/PAD models and licenses, encrypted biometric-template lifecycle, recovery flow, anti-replay/liveness evaluation, and explicit user consent are required before custom face matching can be considered.

## Local and production boundaries

- Local Ollama defaults to loopback only.
- For remote Ollama, use HTTPS and private network access; do not expose the model endpoint to the public internet.
- WebAuthn requires a secure context (HTTPS, with localhost permitted for development) and correct `WEBAUTHN_ORIGIN` / `WEBAUTHN_RP_ID`.
- No database migration is introduced by this feature.
