# Face Landmark model asset

This directory intentionally excludes the model binary from Git. Run from the API directory:

```bash
python face-landmark-service/download_model.py
```

The script downloads the versioned MediaPipe Face Landmarker float16 task bundle from Google's official storage endpoint and verifies SHA-256:

`64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`

Then start the optional sidecar:

```bash
docker compose --profile face-login up -d --build face-landmark
```

Set the same private `FACE_LANDMARK_SERVICE_TOKEN` in the backend and sidecar environment. The model directory is mounted read-only. Do not commit the downloaded `.task` file.
