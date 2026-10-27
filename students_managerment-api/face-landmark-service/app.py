from __future__ import annotations

import hashlib
import hmac
import io
import os
from contextlib import asynccontextmanager
from threading import Lock
from typing import Any

import mediapipe as mp
import numpy as np
from fastapi import FastAPI, Header, HTTPException, Request
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 16_000_000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MODEL_PATH = os.environ.get(
    "FACE_LANDMARK_MODEL",
    os.path.join(os.path.dirname(__file__), "models", "face_landmarker.task"),
)
SERVICE_TOKEN = os.environ.get("FACE_LANDMARK_SERVICE_TOKEN", "")
MODEL_SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
landmarker: Any = None
inference_lock = Lock()


def _point(face: list, index: int, width: int, height: int) -> tuple[float, float]:
    if index >= len(face):
        raise ValueError("Face Landmarker returned an incomplete landmark mesh")
    item = face[index]
    x, y = float(item.x) * width, float(item.y) * height
    if not np.isfinite(x) or not np.isfinite(y):
        raise ValueError("Face Landmarker returned non-finite coordinates")
    return (min(max(x, 0.0), width - 1.0), min(max(y, 0.0), height - 1.0))


def _mean(points: list[tuple[float, float]]) -> tuple[float, float]:
    return (
        sum(point[0] for point in points) / len(points),
        sum(point[1] for point in points) / len(points),
    )


def extract_five_points(face: list, width: int, height: int) -> dict:
    # MediaPipe Face Mesh eye-corner and mouth-corner indices.
    eye_a = _mean([_point(face, 33, width, height), _point(face, 133, width, height)])
    eye_b = _mean([_point(face, 362, width, height), _point(face, 263, width, height)])
    mouth_a = _point(face, 61, width, height)
    mouth_b = _point(face, 291, width, height)
    eyes = sorted([eye_a, eye_b], key=lambda item: item[0])
    mouth = sorted([mouth_a, mouth_b], key=lambda item: item[0])
    nose = _point(face, 1, width, height)

    # Face oval points provide a conservative crop rectangle for PAD.
    oval = [_point(face, index, width, height) for index in (10, 152, 234, 454)]
    xs = [item[0] for item in oval]
    ys = [item[1] for item in oval]
    left, top, right, bottom = min(xs), min(ys), max(xs), max(ys)
    if right - left < 40 or bottom - top < 40:
        raise ValueError("Detected face region is too small")

    return {
        "five": [list(eyes[0]), list(eyes[1]), list(nose), list(mouth[0]), list(mouth[1])],
        "bbox": {"x": left, "y": top, "width": right - left, "height": bottom - top},
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    global landmarker
    if not SERVICE_TOKEN:
        raise RuntimeError("FACE_LANDMARK_SERVICE_TOKEN must be configured")
    if not os.path.isfile(MODEL_PATH):
        raise RuntimeError("Missing MediaPipe Face Landmarker task model")
    digest = hashlib.sha256()
    with open(MODEL_PATH, "rb") as model_file:
        for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
            digest.update(chunk)
    if not hmac.compare_digest(digest.hexdigest(), MODEL_SHA256):
        raise RuntimeError("MediaPipe Face Landmarker model SHA-256 mismatch")
    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_faces=2,
        min_face_detection_confidence=0.65,
        min_face_presence_confidence=0.65,
        min_tracking_confidence=0.65,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(options)
    yield
    if landmarker is not None:
        landmarker.close()
        landmarker = None


app = FastAPI(title="Student Manager Face Landmark Service", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get("/health")
async def health():
    return {"ok": landmarker is not None}


@app.post("/v1/landmarks")
async def landmarks(request: Request, authorization: str | None = Header(default=None)):
    expected = "Bearer " + SERVICE_TOKEN
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")

    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > MAX_BYTES:
                raise HTTPException(status_code=413, detail="Image too large")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid content length")

    chunks = []
    total_bytes = 0
    async for chunk in request.stream():
        total_bytes += len(chunk)
        if total_bytes > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Image too large")
        chunks.append(chunk)
    body = b"".join(chunks)
    if not body:
        raise HTTPException(status_code=400, detail="Empty image")

    try:
        with Image.open(io.BytesIO(body)) as source:
            if source.format not in ALLOWED_FORMATS or getattr(source, "n_frames", 1) != 1:
                raise HTTPException(status_code=415, detail="Unsupported image format")
            if not source.width or not source.height or source.width < 160 or source.height < 160:
                raise HTTPException(status_code=400, detail="Image dimensions are too small")
            if source.width * source.height > MAX_PIXELS:
                raise HTTPException(status_code=413, detail="Image dimensions exceed limit")
            image = ImageOps.exif_transpose(source).convert("RGB")
            image = ImageOps.contain(image, (1280, 1280), method=Image.Resampling.LANCZOS)
            if image.width < 160 or image.height < 160:
                raise HTTPException(status_code=400, detail="Image dimensions are too small after resize")
            rgb = np.asarray(image, dtype=np.uint8).copy()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid image")

    height, width = rgb.shape[:2]
    if landmarker is None:
        raise HTTPException(status_code=503, detail="Landmark model unavailable")

    try:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        def detect_serialized(image: mp.Image):
            with inference_lock:
                return landmarker.detect(image)
        result = await run_in_threadpool(detect_serialized, mp_image)
        faces = result.face_landmarks or []
        if len(faces) != 1:
            raise HTTPException(status_code=422, detail="Exactly one face must be visible")
        extracted = extract_five_points(faces[0], width, height)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="Face landmarks could not be extracted")

    return {"width": width, "height": height, **extracted}
