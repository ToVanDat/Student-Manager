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
- Verified model files and `recognition/metadata.json` in `FACE_MODEL_DIR` with the expected SHA-256 hashes. The supplied archive layout is supported (`recognition/mobile_facenet.onnx`, `recognition/mobile_facenet.data`, `anti-spoofing/minifasnet-v2.onnx`); the extra top-level `face-models/` directory created when extracting into the model directory is also supported.

Install and lock the native runtime from the API directory before model smoke testing:

```bat
npm install --save-exact onnxruntime-node@1.30.0
npm ci
npm run face:verify-models
npm run face:runtime-smoke
npm run face:smoke -- C:\\face-test\\consented-test.jpg
```

Use a consented local test image. The smoke command runs the actual server-side MediaPipe + ONNX pipeline and prints only model metadata, PAD scores, and output-contract status; it does not print or save the face embedding. `face:runtime-smoke` executes both ONNX graphs with synthetic zero tensors and validates the output contracts; it does not validate preprocessing or accuracy. `face:smoke` then exercises the actual MediaPipe + ONNX path with a consented image. Neither command calibrates thresholds or certifies PAD. `face:runtime-smoke` validates graph output shapes and the runtime output contract; `face:smoke` still requires the actual local model bundle and must not be treated as threshold calibration or security certification.

Extract the supplied archive under `students_managerment-api/storage/` (or set `FACE_MODEL_DIR` to the directory containing the extracted `face-models/` folder). The resolver supports the archive's nested `recognition/` and `anti-spoofing/` layout.

No default threshold is supplied. Never copy benchmark thresholds into production without evaluation on this exact model/preprocessing/camera population.

## Preprocessing verification state

- **MiniFASNet:** reference input is BGR, NCHW, 80x80, float32 in [0,255], with a 2.7x expanded face box and no landmark alignment warp. The CI reference check `verify_pad_crop_parity.py` reports `PIXEL_PARITY_TOLERANCE_OK` against MiniVision `CropImage._get_new_box` + OpenCV `INTER_LINEAR`, with maximum absolute uint8 delta <= 1 across its deterministic fixtures. This validates crop geometry and resize bytes for those fixtures, not equivalence of the upstream and production face-detector bounding boxes on representative camera frames.
- **MiniFASNet outputs:** CI has verified exact hash-pinned ONNX/PyTorch output parity (`PARITY_OK`; maximum absolute logit difference 8.08e-06 with atol 1e-5 and rtol 1e-4). The output contract is raw logits, BGR-NCHW float32 in [0,255]. Verified class order is index 0 = attack, index 1 = bona fide, index 2 = attack, based on upstream `test.py`, `AntiSpoofPredict`, and the converter that exports `model.forward()` without class reordering. The ONNX model-card order `[live, print, replay]` conflicts with the verified upstream runtime; retain this discrepancy in the audit. This parity result does not establish PAD accuracy or distinguish print from replay.
- **MobileFaceNet:** the Qualcomm reference specifies RGB NCHW 112x112 in [0,1], applies ImageNet normalization inside the model, and performs horizontal-flip test-time augmentation. The current five-point alignment implementation and image decode/resize path have not yet passed pixel-level parity against Qualcomm's `warp_and_crop_face` reference. Do not calibrate a recognition threshold until that parity is measured on identical inputs.
- **Artifact availability:** the model binaries and `recognition/metadata.json` are gitignored local artifacts. A repository hash pin is not proof that the user's local files exist or match; `npm run face:verify-models` must pass on the actual Windows machine.

## Capture API

1. Start enrollment or login:
   - `POST /api/auth/face/enrollment/options`
   - `POST /api/auth/face/login/options`
2. The response includes `challengeId`, randomized `actions`, `livenessNonce`, and `livenessExpiresAt`. Login challenge creation first checks the release flags, authenticated landmark sidecar, and ONNX model runtime; it does not issue a challenge while the pipeline is unavailable.
3. Capture at least six sequential JPEG/PNG/WebP frames and send each as multipart:
   - enrollment: `POST /api/auth/face/enrollment/frame`
   - login: `POST /api/auth/face/login/frame`
   - fields: `challengeId`, `livenessNonce`, and one file field named `frame`
4. Complete:
   - `POST /api/auth/face/enrollment/verify`
   - `POST /api/auth/face/login/verify`

The settings page now requests password reauthentication before enrollment and captures camera frames only after an explicit user action. The login page uses a dedicated camera dialog and sends the same multipart frame sequence. Both flows display the randomized blink/smile order and stop camera tracks when the capture ends or is cancelled.

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
- CI has verified the pinned MiniFASNet ONNX graph against the upstream PyTorch checkpoint and established raw-logit semantics and class index 1 as bona fide. The model-card class order remains inconsistent with this verified upstream runtime contract; the inference implementation must follow the pinned parity evidence, not the model-card label. This does not certify PAD accuracy, print/replay separation, or resistance to unseen attacks.
- Redis is required. Losing the challenge state invalidates the capture.
- The API rate-limits challenge creation separately from frame uploads.
- The status endpoint reports availability only when both release flags are explicitly set, thresholds and AES key are valid, the authenticated MediaPipe sidecar health probe succeeds, and ONNX Runtime can load the hash-verified models.
- This implementation does not set release flags or apply database migrations. The UI is wired to the API, but enrollment and login controls remain unavailable until the server status reports both pipeline release gates as ready.
