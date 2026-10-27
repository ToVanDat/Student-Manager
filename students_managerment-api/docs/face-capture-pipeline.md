# Face Login multi-frame capture pipeline

## Current security state

The public enrollment and login verification endpoints remain fail-closed. The pipeline is not released by this change. Do not set either release flag until the real model bundle, PAD thresholds, frame-consistency threshold, liveness behavior, and false-accept/false-reject rates have been evaluated on representative data.

Required release gates:
- `FACE_AUTH_PIPELINE_ENABLED=true`
- `FACE_AUTH_PIPELINE_VALIDATED=true`
- `FACE_PAD_MIN_SCORE`: calibrated minimum MiniFASNet live score, strictly between 0 and 1
- `FACE_FRAME_CONSISTENCY_THRESHOLD`: calibrated minimum cosine similarity across frame embeddings
- `FACE_MATCH_THRESHOLD`: calibrated 1:1 identity threshold
- `FACE_TEMPLATE_ENCRYPTION_KEY` and `FACE_TEMPLATE_KEY_VERSION`
- `onnxruntime-node` installed and lockfile synchronized
- Verified model files in `FACE_MODEL_DIR` with the expected SHA-256 hashes

No default threshold is supplied. Never copy benchmark thresholds into production without evaluation on this exact model/preprocessing/camera population.

## Capture API

1. Start enrollment or login:
   - `POST /api/auth/face/enrollment/options`
   - `POST /api/auth/face/login/options`
2. The response includes `challengeId`, randomized `actions`, `livenessNonce`, and `livenessExpiresAt`.
3. Capture at least six sequential JPEG/PNG/WebP frames and send each as multipart:
   - enrollment: `POST /api/auth/face/enrollment/frame`
   - login: `POST /api/auth/face/login/frame`
   - fields: `challengeId`, `livenessNonce`, and one file field named `frame`
4. Complete:
   - `POST /api/auth/face/enrollment/verify`
   - `POST /api/auth/face/login/verify`

The API accepts at most 40 frames per challenge and 5 MB per frame. The server timestamps frames after trusted inference; client timestamps are never accepted. Redis stores the short-lived challenge and temporary per-frame signals/embeddings with a TTL. Raw image bytes are not persisted by the API or landmark sidecar.

## Server-side validation order

For every frame, Node calls the private MediaPipe sidecar, aligns the face, then runs MiniFASNet PAD and MobileFaceNet inference. The returned trusted signals are appended atomically to the Redis challenge state. Completion requires:
- challenge nonce and expiry are valid;
- frame timestamps are monotonic, gaps are bounded, and frame count is within limits;
- the randomized blink/smile sequence passes;
- every frame passes the calibrated PAD minimum;
- embeddings remain above the calibrated cross-frame consistency threshold;
- the normalized aggregate embedding passes the enrolled 1:1 match threshold for login.

Enrollment stores only the aggregate embedding, encrypted with AES-256-GCM. Login delegates successful verification to the existing session issuer. Browser-supplied embeddings, PAD scores, and timestamps are never accepted.

## Operational caveats

- The liveness blendshapes are behavioral signals, not a standalone anti-spoof guarantee.
- MiniFASNet's score is not proof of liveness; evaluate print, replay, mask, lighting, camera, and demographic variation.
- Redis is required. Losing the challenge state invalidates the capture.
- The API rate-limits challenge creation separately from frame uploads.
- The status endpoint reports availability only when both release flags are explicitly set, thresholds are valid, and the ONNX runtime can load the hash-verified models.
- This implementation does not set release flags, apply database migrations, or enable the UI automatically.
