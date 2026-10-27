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
- Enrollment must require an authenticated account and recent step-up authentication.
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
