#!/usr/bin/env python3
"""Evaluate precomputed consented Face pipeline scores without storing templates.

Recognition CSV: split,label,similarity (genuine|impostor)
PAD CSV: split,attack_type,live_score (bona_fide|print|replay|video)
Both CSVs require calibration and test partitions. Higher scores mean more genuine/live.
"""
import argparse
import csv
import json
import math
import sys
from pathlib import Path

SPLITS = {"calibration", "test"}
ATTACKS = {"bona_fide", "print", "replay", "video"}


def read_rows(path, required):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path}: missing columns: {', '.join(sorted(missing))}")
        rows = list(reader)
    if not rows:
        raise ValueError(f"{path}: no data rows")
    return rows


def number(value, context):
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{context}: expected numeric value") from exc
    if not math.isfinite(result):
        raise ValueError(f"{context}: value must be finite")
    return result


def validate_pair_identity(label, participant_a, participant_b, context):
    same_participant = participant_a.strip() == participant_b.strip()
    if label == "genuine" and not same_participant:
        raise ValueError(f"{context}: genuine pairs must contain the same participant")
    if label == "impostor" and same_participant:
        raise ValueError(f"{context}: impostor pairs must contain different participants")


def load_recognition(path):
    result = []
    for line, row in enumerate(read_rows(path, {"split", "label", "similarity", "participant_a", "participant_b", "session_a", "session_b", "device_a", "device_b"}), 2):
        split, label = row["split"].strip().lower(), row["label"].strip().lower()
        score = number(row["similarity"], f"{path}:{line}:similarity")
        if split not in SPLITS or label not in {"genuine", "impostor"}:
            raise ValueError(f"{path}:{line}: invalid split or label")
        for key in ("participant_a", "participant_b", "session_a", "session_b", "device_a", "device_b"):
            if not row[key].strip():
                raise ValueError(f"{path}:{line}: {key} must be a pseudonymous non-empty identifier")
        validate_pair_identity(label, row["participant_a"], row["participant_b"], f"{path}:{line}")
        if not -1 <= score <= 1:
            raise ValueError(f"{path}:{line}: cosine similarity must be in [-1,1]")
        result.append({"split": split, "genuine": label == "genuine", "score": score, **{key: row[key].strip() for key in ("participant_a", "participant_b", "session_a", "session_b", "device_a", "device_b")}})
    return result


def load_pad(path):
    result = []
    for line, row in enumerate(read_rows(path, {"split", "attack_type", "live_score", "participant_id", "session_id", "device_id"}), 2):
        split, attack = row["split"].strip().lower(), row["attack_type"].strip().lower()
        score = number(row["live_score"], f"{path}:{line}:live_score")
        if split not in SPLITS or attack not in ATTACKS:
            raise ValueError(f"{path}:{line}: invalid split or attack_type")
        for key in ("participant_id", "session_id", "device_id"):
            if not row[key].strip():
                raise ValueError(f"{path}:{line}: {key} must be a pseudonymous non-empty identifier")
        if not 0 <= score <= 1:
            raise ValueError(f"{path}:{line}: live_score must be in [0,1]")
        result.append({"split": split, "bona_fide": attack == "bona_fide",
                       "attack_type": attack, "score": score,
                       **{key: row[key].strip() for key in ("participant_id", "session_id", "device_id")}})
    return result


def validate_disjoint_splits(rows, identity_fields, label):
    """Reject participant/session/device overlap between calibration and test."""
    for field in identity_fields:
        calibration = set()
        test = set()
        for row in rows:
            values = row[field] if isinstance(row[field], tuple) else (row[field],)
            target = calibration if row["split"] == "calibration" else test
            target.update(value.strip() for value in values)
        overlap = calibration & test
        if overlap:
            raise ValueError(
                f"{label}: {field} leakage between calibration and test "
                f"({len(overlap)} overlapping identifiers)"
            )


def thresholds(rows):
    values = sorted({r["score"] for r in rows})
    if not values:
        raise ValueError("No scores available")
    return [values[0] - 1e-12] + values + [values[-1] + 1e-12]


def recognition_metrics(rows, threshold):
    genuine = [r for r in rows if r["genuine"]]
    impostor = [r for r in rows if not r["genuine"]]
    if not genuine or not impostor:
        raise ValueError("Recognition requires genuine and impostor pairs")
    frr = sum(r["score"] < threshold for r in genuine) / len(genuine)
    far = sum(r["score"] >= threshold for r in impostor) / len(impostor)
    return {"threshold": threshold, "genuine_pairs": len(genuine),
            "impostor_pairs": len(impostor), "FAR": far, "FRR": frr}


def calibrate_recognition(rows):
    candidates = [recognition_metrics(rows, t) for t in thresholds(rows)]
    best = min(candidates, key=lambda m: (
        abs(m["FAR"] - m["FRR"]), (m["FAR"] + m["FRR"]) / 2, m["threshold"]))
    return best["threshold"], {**best, "EER_estimate": (best["FAR"] + best["FRR"]) / 2}


def wilson_interval(errors, total, z=1.959963984540054):
    """Two-sided 95% Wilson score interval for a binomial error rate."""
    if not isinstance(total, int) or total <= 0:
        raise ValueError("Confidence interval requires a positive integer sample count")
    if not isinstance(errors, int) or errors < 0 or errors > total:
        raise ValueError("Confidence interval errors must be an integer within the sample count")
    rate = errors / total
    denominator = 1 + z * z / total
    center = (rate + z * z / (2 * total)) / denominator
    margin = z * math.sqrt((rate * (1 - rate) / total) +
                           (z * z / (4 * total * total))) / denominator
    # Preserve exact binomial boundaries instead of leaking floating-point
    # round-off (for example, 3e-18) into a mathematically zero lower bound.
    lower = 0.0 if errors == 0 else max(0.0, center - margin)
    upper = 1.0 if errors == total else min(1.0, center + margin)
    return [lower, upper]


def pad_metrics(rows, threshold):
    bona = [r for r in rows if r["bona_fide"]]
    attacks = [r for r in rows if not r["bona_fide"]]
    if not bona or not attacks:
        raise ValueError("PAD requires bona_fide and attack samples")
    bpcer_errors = sum(r["score"] < threshold for r in bona)
    bpcer = bpcer_errors / len(bona)
    by_type = {}
    for attack in sorted({r["attack_type"] for r in attacks}):
        group = [r for r in attacks if r["attack_type"] == attack]
        errors = sum(r["score"] >= threshold for r in group)
        by_type[attack] = {
            "samples": len(group),
            "APCER": errors / len(group),
            "APCER_CI95": wilson_interval(errors, len(group))
        }
    mean_apcer = sum(v["APCER"] for v in by_type.values()) / len(by_type)
    return {"threshold": threshold, "bona_fide_samples": len(bona),
            "attack_samples": len(attacks), "BPCER": bpcer,
            "BPCER_CI95": wilson_interval(bpcer_errors, len(bona)),
            "APCER_by_attack": by_type, "mean_APCER": mean_apcer,
            "ACER": (mean_apcer + bpcer) / 2,
            "note": "Wilson 95% intervals are per-rate pointwise intervals; ACER interval is not estimated."}


def calibrate_pad(rows):
    candidates = [pad_metrics(rows, t) for t in thresholds(rows)]
    best = min(candidates, key=lambda m: (m["ACER"], m["BPCER"], m["threshold"]))
    return best["threshold"], best


def validate_attack_coverage(rows, split_name):
    required = ATTACKS - {"bona_fide"}
    observed = {row["attack_type"] for row in rows if not row["bona_fide"]}
    missing = required - observed
    if missing:
        raise ValueError(
            f"PAD {split_name} partition is missing attack categories: "
            f"{', '.join(sorted(missing))}"
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recognition", required=True, type=Path)
    parser.add_argument("--pad", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    rec = load_recognition(args.recognition)
    pad = load_pad(args.pad)
    for row in rec:
        row["participant_a"] = (row["participant_a"], row["participant_b"])
        row["session_a"] = (row["session_a"], row["session_b"])
        row["device_a"] = (row["device_a"], row["device_b"])
    validate_disjoint_splits(rec, ("participant_a", "session_a", "device_a"), "Recognition")
    validate_disjoint_splits(pad, ("participant_id", "session_id", "device_id"), "PAD")
    rc = [r for r in rec if r["split"] == "calibration"]
    rt = [r for r in rec if r["split"] == "test"]
    pc = [r for r in pad if r["split"] == "calibration"]
    pt = [r for r in pad if r["split"] == "test"]
    if not all((rc, rt, pc, pt)):
        raise ValueError("Both CSVs need non-empty calibration and test partitions")
    for split_name, split_rows in (("calibration", pc), ("test", pt)):
        validate_attack_coverage(split_rows, split_name)

    rec_t, rec_cal = calibrate_recognition(rc)
    pad_t, pad_cal = calibrate_pad(pc)
    report = {
        "warning": "Research-only point estimates; not a production/security certification.",
        "recognition": {"calibration": rec_cal,
                        "held_out_test": recognition_metrics(rt, rec_t)},
        "pad": {"calibration": pad_cal, "held_out_test": pad_metrics(pt, pad_t)},
        "counts": {"recognition_calibration": len(rc), "recognition_test": len(rt),
                   "pad_calibration": len(pc), "pad_test": len(pt)}
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as exc:
        print(f"[face-eval] ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
