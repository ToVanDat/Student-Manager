#!/usr/bin/env python3
"""Compare the production JavaScript PAD crop with MiniVision/OpenCV (<=1 intensity level)."""
import argparse
import base64
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np


CASES = [
    {"name": "center_portrait", "bbox": [100, 55, 72, 104]},
    {"name": "left_edge", "bbox": [0, 35, 54, 82]},
    {"name": "right_bottom_edge", "bbox": [260, 176, 60, 64]},
    {"name": "wide_face_box", "bbox": [28, 96, 190, 62]},
    {"name": "top_edge", "bbox": [115, 0, 66, 76]},
]


def javascript_crop(api_root, image, width, height, bbox):
    payload = {
        "image": base64.b64encode(image.tobytes()).decode("ascii"),
        "width": width,
        "height": height,
        "bbox": {"x": bbox[0], "y": bbox[1], "width": bbox[2], "height": bbox[3]},
    }
    js = r"""
const fs = require('node:fs');
const { cropPadRgb } = require('./service/faceAlignment.js');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const image = Buffer.from(input.image, 'base64');
const output = cropPadRgb(image, input.width, input.height, input.bbox, 2.7);
process.stdout.write(output.toString('base64'));
"""
    completed = subprocess.run(
        ["node", "-e", js],
        cwd=api_root,
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=True,
    )
    return np.frombuffer(base64.b64decode(completed.stdout), dtype=np.uint8).reshape(80, 80, 3)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream-root", required=True, type=Path)
    args = parser.parse_args()
    import sys
    sys.path.insert(0, str(args.upstream_root.resolve()))
    from src.generate_patches import CropImage

    api_root = Path(__file__).resolve().parents[2]
    height, width = 240, 320
    rng = np.random.default_rng(20261028)
    image = rng.integers(0, 256, size=(height, width, 3), dtype=np.uint8)
    results = []
    for case in CASES:
        bbox = case["bbox"]
        reference = CropImage().crop(
            org_img=image,
            bbox=bbox,
            scale=2.7,
            out_w=80,
            out_h=80,
            crop=True,
        )
        actual = javascript_crop(api_root, image, width, height, bbox)
        difference = np.abs(actual.astype(np.int16) - reference.astype(np.int16))
        max_difference = int(difference.max())
        mismatch_pixels = int(np.count_nonzero(np.any(actual != reference, axis=2)))
        results.append({
            "case": case["name"],
            "max_abs_difference": max_difference,
            "mismatched_pixels": mismatch_pixels,
            "total_pixels": 80 * 80,
        })
        # OpenCV INTER_LINEAR uses fixed-point interpolation coefficients;
        # the JavaScript implementation uses floating-point bilinear sampling.
        # A one-level uint8 rounding delta is acceptable; larger deltas indicate
        # a geometry or sampling regression and must fail the parity gate.
        if max_difference > 1:
            raise SystemExit(
                f"[crop-parity] {case['name']} differs from MiniVision/OpenCV: "
                f"max_abs_difference={max_difference}, mismatched_pixels={mismatch_pixels}"
            )

    print(json.dumps({
        "status": "PIXEL_PARITY_TOLERANCE_OK",
        "reference": "MiniVision CropImage._get_new_box + cv2.resize(INTER_LINEAR), max absolute uint8 delta <= 1",
        "cases": results,
        "limitations": [
            "Synthetic deterministic RGB buffers; no camera/device PAD accuracy claim.",
            "This validates crop geometry and resize bytes, not face detector bbox equivalence."
        ],
    }, indent=2))


if __name__ == "__main__":
    main()
