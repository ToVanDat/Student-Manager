# Face Login integration notes

## Scope of this foundation

Face Login is a separate application-managed biometric credential. It is not Passkey/WebAuthn and must not replace the existing Passkey UI or routes.

The supplied model bundle contains:
- MobileFaceNet ONNX graph: 387,359 bytes (SHA-256: `3ac0b9597efd5dc49c5397e5c21269f98cceb42e7193fcc1afbb0fa992c88e4e`)
- MobileFaceNet external weights: 3,947,008 bytes (SHA-256: `5164ee5cdd52328da0b1959913e23fd1866b1696b690fc4ad0bbc5cd32ae319c`)
- MobileFaceNet metadata: two inputs `img1`, `img2`, each `float32 [1,3,112,112]`, values [0,1]; output `embeddings float32 [2,128]`.
- MiniFASNet-V2 ONNX: 1,744,116 bytes (SHA-256: `d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b`).

MiniFASNet-V2 contract from the supplied model metadata: one `float32 [1,3,80,80]` BGR NCHW input scaled to `[0,1]`; output has three classes in the order `[live, print-attack, replay-attack]`. The existing evaluation notes use a face bounding-box crop expanded by 2.7x and do not use the MobileFaceNet landmark alignment warp. The PAD score is `1 - (p[print-attack] + p[replay-attack])`. This is a classifier score, not proof of liveness; threshold and attack resistance must be measured on representative print, screen replay, mask, lighting, camera, and genuine samples.

Important: MobileFaceNet is exported as a paired/two-image verification graph. The matching Qualcomm AI Hub source (`models/mobile_facenet/model.py` and `app.py`) confirms RGB NCHW inputs in `[0,1]`, then torchvision normalization with mean `[0.485, 0.456, 0.406]` and std `[0.229, 0.224, 0.225]`. The graph independently normalizes each image, horizontally flips each normalized image, runs the four-image batch through the shared backbone, sums original+flip features per image (TTA), and returns interleaved rows `[embedding(img1), embedding(img2)]` with shape `[2,128]`. The rows are not a similarity score; L2-normalize them before cosine comparison. Qualcomm's reference app aligns 5 points in the order left eye, right eye, nose, left mouth, right mouth to a 112x112 crop using `default_square=true`, `inner_padding_factor=0.25`, and no outer padding. The reference template is derived from the original MobileFaceNet points; MediaPipe landmark-to-five-point mapping must still be validated against reference examples before production. The Qualcomm evaluator expresses its default threshold as a cosine angle in degrees (74.18° in `model.py`), while this project's `FACE_MATCH_THRESHOLD` is a cosine similarity in `[-1,1]`; do not copy the numeric value across units, and do not treat a public benchmark threshold as a calibrated authentication threshold.

## Model artifact deployment and integrity

Do not commit model binaries to Git. Extract the supplied archive so the following files are side by side in `students_managerment-api/storage/face-models/`:

- `mobile_facenet.onnx`
- `mobile_facenet.data` (required external initializer data; do not rename)
- `minifasnet-v2.onnx`

The API ignores this local directory in Git. Verify the exact uploaded archive artifacts from the API directory with:

```cmd
npm run face:verify-models
```

To use another directory, set `FACE_MODEL_DIR` to its absolute path before running the command. The verifier checks SHA-256 against the uploaded bundle. A successful integrity check proves only that the files match that bundle; it does not prove model accuracy, correct preprocessing, inference compatibility, PAD effectiveness, or readiness for authentication.


## Reference implementation

The MobileFaceNet contract was cross-checked against Qualcomm's public AI Hub implementation: [model.py](https://github.com/qualcomm/ai-hub-models/blob/main/src/qai_hub_models/models/mobile_facenet/model.py), [app.py](https://github.com/qualcomm/ai-hub-models/blob/main/src/qai_hub_models/models/mobile_facenet/app.py), and [image_processing.py](https://github.com/qualcomm/ai-hub-models/blob/main/src/qai_hub_models/utils/image_processing.py). Keep the supplied ONNX graph and external weights together; use the source only to understand the model contract, not to assume the local exported artifact is validated for authentication.

## Server ONNX runtime foundation

The API now contains an internal bounded image decoder at `students_managerment-api/service/faceImageDecoder.js` and an ONNX inference module at `students_managerment-api/service/faceInferenceService.js`. The decoder accepts JPEG/PNG/WebP buffers up to 5 MB, caps decoded input at 16 megapixels, applies EXIF orientation, converts to RGB, and resizes within 1280x1280. It does not perform face detection or alignment. The ONNX module:
- verifies SHA-256 for the three supplied model artifacts before loading sessions;
- loads MobileFaceNet and MiniFASNet through ONNX Runtime Node.js with CPU execution;
- checks the expected MobileFaceNet input/output names and single-input/single-output PAD graph;
- validates exact NCHW tensor sizes and pixel range;
- L2-normalizes the 128-D embedding and derives the PAD live score from the three class outputs.

The inference function is deliberately internal and accepts already aligned RGB 112x112 and PAD BGR 80x80 tensors. Those tensors must be produced by a trusted server-side detector/alignment stage. Do not add an HTTP route that accepts these tensors, landmarks, embeddings, or PAD scores from the browser.

Install the native runtime from the API directory using the stable package version verified against the official ONNX Runtime Node.js documentation:

```cmd
npm install --save-exact onnxruntime-node@1.30.0
```

This command must be run in the developer's actual API checkout so npm updates both `package.json` and `package-lock.json` consistently. Do not hand-edit the lockfile. ONNX Runtime Node.js requires Node 16 or newer and recommends Node 20; the published CPU binary supports Windows x64 and Linux x64. See [official Node binding docs](https://onnxruntime.ai/docs/get-started/with-javascript/node.html) and [package release](https://www.npmjs.com/package/onnxruntime-node).

The internal inference pipeline now includes bounded image decoding, a private MediaPipe landmark service, five-point alignment, PAD crop generation, and ONNX model execution. It is not yet invoked by public enrollment/login endpoints. The task asset and ONNX Runtime dependency must be installed locally, then the pipeline must pass reference-image, model-contract, PAD, and replay tests before authentication routes can be enabled. Until then, public verification endpoints remain fail-closed with `FACE_SERVER_INFERENCE_NOT_READY`.

## Private MediaPipe landmark service and Node preprocessing

The API now has a small internal MediaPipe Tasks service in `students_managerment-api/face-landmark-service/`. This is a deliberate runtime boundary: Google's Face Landmarker JavaScript guide targets web applications, while the documented Python Tasks API provides a server-side runtime. The Python service only returns server-computed coordinates; Node.js remains the application API, owns challenge/session state, performs crop/normalization, and runs the supplied ONNX recognition/PAD models. The small Python sidecar is intentional: it avoids relying on undocumented Node execution of the browser-targeted MediaPipe Tasks Vision package.

The private service:
- loads the versioned Face Landmarker float16 task bundle;
- accepts only JPEG, PNG, or WebP bytes up to 5 MB and 16 MP;
- applies EXIF orientation and resizes to the same 1280-pixel maximum as the Node decoder;
- requires exactly one detected face;
- derives eye centers from mesh indices 33/133 and 362/263, nose tip 1, mouth corners 61/291, and a face-oval crop box from 10/152/234/454;
- does not persist or log submitted image bytes.

The Node side uses `faceLandmarkClient.js`, `faceAlignment.js`, and `facePreprocessingService.js` to call the private service, validate the response, perform the five-point similarity warp to 112x112, and generate the 2.7x square PAD crop at 80x80. The five-point target coordinates are derived from the Qualcomm MobileFaceNet app's documented `default_square=true`, `inner_padding_factor=0.25`, and no outer padding configuration. The ONNX inference module now exposes an internal `inferFaceImage(imageBuffer)` entry point that invokes this pipeline.

### Download and run locally (Windows)

The MediaPipe task model is not committed. From PowerShell:

```powershell
cd .\students_managerment-api\face-landmark-service
.\download-model.ps1
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The downloader uses the versioned Google Storage URL and verifies SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`. The same checksum is checked again by the Python service at startup. The checksum is independently published for the same versioned asset in [this model mirror](https://github.com/shinshin86/mesh-avatar-studio) and [this converted-model card](https://huggingface.co/naklitechie/face-landmarks-onnx); Google does not publish a checksum on the task guide. The script deletes the downloaded file if it does not match.

Set a fresh shared secret in both processes. Generate one with Node.js:

```cmd
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
```

Run the landmark service in PowerShell (replace the placeholder with the generated secret):

```powershell
$env:FACE_LANDMARK_SERVICE_TOKEN = "REPLACE_WITH_RANDOM_SECRET"
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 3010 --no-access-log
```

Set these in the backend's actual local `.env` (do not commit secrets):

```dotenv
FACE_LANDMARK_SERVICE_URL=http://127.0.0.1:3010
FACE_LANDMARK_SERVICE_TOKEN=REPLACE_WITH_THE_SAME_RANDOM_SECRET
```

To build the container after downloading the verified model (run from the `face-landmark-service` directory):

```cmd
docker build -t student-manager-face-landmarks .
```

Do not publish the container port to the public host. Attach it only to the backend's private container network and configure the Node API to use that internal service address.

The service binds to loopback for local development and disables interactive API docs. For containers, put it on a private network with no public port mapping; only then may `FACE_LANDMARK_SERVICE_ALLOW_PRIVATE_HTTP=true` be set for an isolated private HTTP hop. Otherwise use HTTPS. The shared token is mandatory. The `/health` endpoint is intentionally a liveness probe and does not expose model paths or secrets.

### Important limitation

This service computes landmarks; it does not prove liveness. MiniFASNet's single-frame classification remains only a PAD signal. A production login must additionally enforce a server-issued, one-time randomized action challenge over multiple captured frames, bind every frame to the same unexpired challenge, reject replay/reused submissions, calibrate PAD and match thresholds against a representative validation set, and rate-limit failures. The public enrollment/login verify routes remain fail-closed until that complete protocol is implemented and tested.

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
- `completeLoginAfterTrustedInference` is an internal completion boundary: after a trusted inference caller supplies the verified live embedding, it checks the account-bound one-time challenge, compares the template, and delegates session/AT/RT creation to the existing `advancedAuthService.issueSession`. The public login verify route remains fail-closed until the trusted inference caller exists.
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

1. The matching Qualcomm source establishes RGB preprocessing, torchvision mean/std normalization, paired-input TTA, and the 112x112 five-point alignment template. The MediaPipe-to-five-point mapping and similarity warp are implemented, but still need reference-image validation and numerical parity checks before similarity calibration.
2. The supplied face-model ZIP does not include the MediaPipe Face Landmarker task asset. A separate private Python MediaPipe Tasks service is committed because Google's documented Tasks runtime for server-side Python is supported; the web JavaScript guide is for browser applications. The versioned task model is downloaded separately and checksum-verified.
3. The bounded Node image decoder, internal ONNX runner, private MediaPipe landmark service, five-point similarity alignment, and 2.7x PAD crop preprocessing are committed. The developer must download the versioned MediaPipe task asset with the PowerShell checksum verifier and install the pinned Python service requirements. The developer must also install and lock `onnxruntime-node@1.30.0` from the API checkout.
4. The current public enrollment/login verify endpoints deliberately consume the one-time challenge and return `FACE_SERVER_INFERENCE_NOT_READY`. This is fail-closed behavior, not a completed login implementation.
5. MiniFASNet-V2 must be evaluated against presentation attacks and a representative validation set. Its output is not a guarantee of liveness.
6. No production migration or live database operation is performed by these commits.

Run the Python landmark extraction unit tests from `students_managerment-api/face-landmark-service` after installing the service requirements:

```cmd
python -m unittest test_landmarks.py
```

Run the Node API tests from `students_managerment-api`:

```cmd
npm test
```

These commands are documented but have not yet been executed against the repository in this environment.

Run the AES helper tests from `students_managerment-api` with:

```cmd
node --test test/faceTemplateCrypto.test.js
```
