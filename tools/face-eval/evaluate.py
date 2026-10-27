#!/usr/bin/env python3
"""Evaluate precomputed face-match or PAD scores without loading biometric data.

Input CSVs contain scores only; never put face images, embeddings, names, or account IDs
in these files. This tool is an evaluation helper, not a production authentication gate.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import sys
from pathlib import Path


def read_rows(path: Path, task: str):
    score_column = "similarity" if task == "face" else "bona_fide_score"
    label_column = "label"
    rows = []
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or label_column not in reader.fieldnames or score_column not in reader.fieldnames:
            raise ValueError(f"CSV must contain columns: {label_column},{score_column}")
        for line, row in enumerate(reader, start=2):
            label = (row.get(label_column) or "").strip().lower()
            allowed = {"genuine", "impostor"} if task == "face" else {"bona_fide", "attack"}
            if label not in allowed:
                raise ValueError(f"Line {line}: label must be one of {', '.join(sorted(allowed))}")
            try:
                score = float(row[score_column])
            except (TypeError, ValueError):
                raise ValueError(f"Line {line}: invalid {score_column}") from None
            if not math.isfinite(score):
                raise ValueError(f"Line {line}: score must be finite")
            if task == "face" and not -1.000001 <= score <= 1.000001:
                raise ValueError(f"Line {line}: cosine similarity must be in [-1, 1]")
            if task == "pad" and not 0 <= score <= 1:
                raise ValueError(f"Line {line}: bona_fide_score must be in [0, 1]")
            rows.append((label, score))
    if not rows:
        raise ValueError("CSV contains no data rows")
    labels = {label for label, _ in rows}
    expected = {"genuine", "impostor"} if task == "face" else {"bona_fide", "attack"}
    if labels != expected:
        raise ValueError(f"Both classes are required: {', '.join(sorted(expected))}")
    return rows


def candidate_thresholds(scores):
    ordered = sorted(set(scores))
    if len(ordered) == 1:
        return ordered
    return [ordered[0] - 1e-9] + [(a + b) / 2 for a, b in zip(ordered, ordered[1:])] + [ordered[-1] + 1e-9]


def evaluate_face(rows):
    genuine = [s for label, s in rows if label == "genuine"]
    impostor = [s for label, s in rows if label == "impostor"]
    results = []
    for threshold in candidate_thresholds(genuine + impostor):
        far = sum(s >= threshold for s in impostor) / len(impostor)
        frr = sum(s < threshold for s in genuine) / len(genuine)
        results.append({"threshold": threshold, "FAR": far, "FRR": frr, "gap": abs(far - frr)})
    best = min(results, key=lambda item: (item["gap"], item["FAR"] + item["FRR"]))
    return {
        "task": "face_verification",
        "samples": {"genuine_pairs": len(genuine), "impostor_pairs": len(impostor)},
        "eer_operating_point_estimate": {k: best[k] for k in ("threshold", "FAR", "FRR")},
        "warning": "Pair-level estimate only. Report subject-disjoint train/dev/test splits and confidence intervals; do not use this threshold for production without independent validation.",
    }


def evaluate_pad(rows):
    bona = [s for label, s in rows if label == "bona_fide"]
    attacks = [s for label, s in rows if label == "attack"]
    results = []
    for threshold in candidate_thresholds(bona + attacks):
        apcer = sum(s >= threshold for s in attacks) / len(attacks)
        bpcer = sum(s < threshold for s in bona) / len(bona)
        results.append({"threshold": threshold, "APCER": apcer, "BPCER": bpcer, "ACER": (apcer + bpcer) / 2})
    best = min(results, key=lambda item: (item["ACER"], item["APCER"], item["BPCER"]))
    return {
        "task": "presentation_attack_detection",
        "samples": {"bona_fide": len(bona), "attacks": len(attacks)},
        "minimum_ACER_point_on_supplied_data": {k: best[k] for k in ("threshold", "APCER", "BPCER", "ACER")},
        "warning": "This is an exploratory threshold sweep, not an ISO/IEC 30107-3 evaluation or certification. Keep attack instruments, species, devices, sessions and subjects disjoint across splits.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task", choices=("face", "pad"), required=True)
    parser.add_argument("--csv", required=True, type=Path)
    args = parser.parse_args()
    try:
        rows = read_rows(args.csv, args.task)
        report = evaluate_face(rows) if args.task == "face" else evaluate_pad(rows)
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
