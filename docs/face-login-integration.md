# Face Login integration notes

## Scope of this foundation

Face Login is a separate application-managed biometric credential. It is not Passkey/WebAuthn and must not replace the existing Passkey UI or routes.

The supplied model bundle contains:
- MobileFaceNet ONNX graph: 387,359 bytes (SHA-256: `3ac0b9597efd5dc49c5397e5c21269f98cceb42e7193fcc1afbb0fa992c88e4e`)
- MobileFaceNet external weights: 3,947,008 bytes (SHA-256: `5164ee5cdd52328da0b1959913e23fd1866b1696b690fc4ad0bbc5cd32ae319c`)
- MobileFaceNet metadata: two inputs `img1`, `img2`, each `float32 [1,3,112,112]`, values [0,1]; output `embeddings float32 [2,128]`.
- MiniFASNet-V2 ONNX: 1,744,116 bytes (SHA-256: `d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b`).

Important: MobileFaceNet is exported as a paired/two-image graph, not a single-image embedding graph. Its metadata does not fully specify RGB/BGR ordering, face alignment, landmark template, or similarity calibration. Do not infer these values from the tensor shape. Validate the exact preprocessing and output semantics with the model reference implementation and known test vectors before enabling enrollment or login.

## Data protection

- `user_face_credentials` stores only an encrypted embedding envelope, never camera frames.
- Encrypt the template using AES-256-GCM with a random 12-byte nonce and a 16-byte authentication tag.
- The encryption key must be a server-side secret, independent of JWT secrets and database credentials. Keep a key version for rotation.
- Disable/delete credentials through an authenticated operation; never expose ciphertext or key material in API responses.
- Enrollment requires an authenticated account and a one-time, purpose-bound recent step-up token (`face-enroll`) from the existing Passkey re-authentication flow. The enrollment endpoint consumes that token before issuing a challenge.
- Login challenges must be short-lived, account-bound, one-time, and rate-limited.

## Critical security gate

A browser-supplied embedding or MiniFASNet PAD score is untrusted input. A modified client can bypass MediaPipe, MobileFaceNet, and MiniFASNet and submit fabricated values. Therefore, client-only inference plus server-side comparison is not an acceptable production authentication boundary.

Before enabling Face Login for real accounts, add a server-verifiable PAD/inference path (or another independently verifiable trusted mechanism), calibrate thresholds against a representative evaluation dataset, test replay/presentation attacks, and document the residual risk. Do not mark the feature production-ready based only on a successful ONNX inference.

## Expected runtime pipeline

1. MediaPipe Tasks Vision: detect face and landmarks.
2. Align/crop using a validated landmark template.
3. MobileFaceNet: create and compare 128-D embeddings using the exact paired graph contract.
4. MiniFASNet-V2: PAD as an additional signal, not a guarantee against spoofing.
5. Express: issue one-time challenge, verify all server-trusted evidence, then reuse the existing session issuance and refresh-cookie flow.
6. PostgreSQL: persist encrypted credential metadata only.

The existing `/api/auth/biometric-login/*` endpoints currently alias Passkey/WebAuthn. Keep that behavior distinct until a dedicated Face Login API has been implemented and reviewed.

## Backend foundation now present

- Dedicated routes under `/api/auth/face/*`; these are distinct from the legacy `/biometric-login/*` Passkey aliases.
- Redis-backed 180-second challenges use atomic GET-and-DEL consumption.
- Face endpoints have an isolated Redis-backed rate-limit namespace.
- `faceTemplateCrypto.js` uses AES-256-GCM, a random 12-byte nonce, a 16-byte tag, and account/model/version-bound AAD.
- The keyring supports `FACE_TEMPLATE_ENCRYPTION_KEYS` as a JSON object keyed by key version, with `FACE_TEMPLATE_KEY_VERSION` selecting the active key. For a single initial key, `FACE_TEMPLATE_ENCRYPTION_KEY` is accepted for the active version.
- `faceAuthService.storeVerifiedTemplate` and `compareVerifiedTemplate` are internal service functions. They must only be called after trusted server-side inference; no public route accepts a browser-supplied embedding.
- Face Login settings show the credential status and provide a disable action. Enrollment remains disabled in the UI until trusted server inference is deployed.

## Local server configuration

Generate a random 32-byte key in Windows Command Prompt (run from the API directory):

```cmd
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"
```

Put the generated value in the real local API `.env` file (never commit it):

```dotenv
FACE_TEMPLATE_KEY_VERSION=1
FACE_TEMPLATE_ENCRYPTION_KEY=<generated-base64-value>
FACE_MATCH_THRESHOLD=<calibrated-value>
```

Do not invent a match threshold. Calibrate it with genuine/impostor pairs for the exact model build and expected camera population. For key rotation, configure `FACE_TEMPLATE_ENCRYPTION_KEYS` as a JSON object containing every still-needed historical key version and the new active version; retain old keys until all templates have been re-encrypted. Keep this key independent from JWT, OAuth, database, and R2 secrets.

## Remaining production blockers

1. The supplied MobileFaceNet graph has two image inputs (`img1`, `img2`) and a two-row embedding output. The model bundle does not establish the intended pairing contract, reference alignment template, or color normalization sufficiently to ship a correct inference pipeline.
2. The bundle does not include the MediaPipe Face Landmarker task asset. MediaPipe Tasks Vision and ONNX Runtime Web have not yet been committed as frontend dependencies because the existing package-lock must be regenerated consistently when the model pipeline is added.
3. The server does not yet have a trusted ONNX inference runtime and model deployment path. Browser inference alone is not trusted for authentication.
4. The current public enrollment/login verify endpoints deliberately consume the one-time challenge and return `FACE_SERVER_INFERENCE_NOT_READY`. This is fail-closed behavior, not a completed login implementation.
5. MiniFASNet-V2 must be evaluated against presentation attacks and a representative validation set. Its output is not a guarantee of liveness.
6. No production migration or live database operation is performed by these commits.

Run the AES helper tests from `students_managerment-api` with:

```cmd
node --test test/faceTemplateCrypto.test.js
```
