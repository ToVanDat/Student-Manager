#!/usr/bin/env python3
"""Download the pinned MediaPipe Face Landmarker task model and verify its digest."""
from __future__ import annotations

import hashlib
import os
import pathlib
import sys
import tempfile
import urllib.request

URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
EXPECTED_SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
DESTINATION = pathlib.Path(__file__).resolve().parent / "models" / "face_landmarker.task"


def main() -> int:
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    if DESTINATION.exists():
        digest = hashlib.sha256(DESTINATION.read_bytes()).hexdigest()
        if digest == EXPECTED_SHA256:
            print(f"OK: {DESTINATION} SHA-256 verified")
            return 0
        print("Existing model SHA-256 mismatch; refusing to overwrite it.", file=sys.stderr)
        return 1

    fd, temporary_name = tempfile.mkstemp(prefix="face-landmarker-", suffix=".task", dir=DESTINATION.parent)
    os.close(fd)
    temporary = pathlib.Path(temporary_name)
    try:
        request = urllib.request.Request(URL, headers={"User-Agent": "StudentManager-FaceModel-Setup/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
        digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
        if digest != EXPECTED_SHA256:
            raise RuntimeError(f"SHA-256 mismatch: expected {EXPECTED_SHA256}, got {digest}")
        temporary.replace(DESTINATION)
        print(f"Downloaded and verified: {DESTINATION}")
        return 0
    except Exception as error:
        temporary.unlink(missing_ok=True)
        print(f"Model download failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
