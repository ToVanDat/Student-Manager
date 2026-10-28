#!/usr/bin/env python3
"""Verify the pinned MiniFASNet ONNX output against upstream PyTorch.

This checks the exact ONNX artifact and upstream checkpoint on deterministic
synthetic BGR tensors. It determines whether ONNX returns raw logits or
softmax probabilities by numerical parity; it does not evaluate PAD accuracy.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

EXPECTED_ONNX_SHA256 = "d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b"
EXPECTED_CHECKPOINT_SHA256 = "a5eb02e1843f19b5386b953cc4c9f011c3f985d0ee2bb9819eea9a142099bec0"
ATOL = 1e-5
RTOL = 1e-4


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_softmax(values):
    import numpy as np
    shifted = values - np.max(values, axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=1, keepdims=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream-root", required=True, type=Path,
                        help="Local checkout of minivision-ai/Silent-Face-Anti-Spoofing")
    parser.add_argument("--checkpoint", required=True, type=Path,
                        help="2.7_80x80_MiniFASNetV2.pth")
    parser.add_argument("--onnx", required=True, type=Path,
                        help="Hash-pinned minifasnet-v2.onnx")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    for label, path in (("upstream root", args.upstream_root),
                        ("checkpoint", args.checkpoint), ("ONNX", args.onnx)):
        if not path.exists():
            raise SystemExit(f"[parity] missing {label}: {path}")

    onnx_hash = sha256(args.onnx)
    checkpoint_hash = sha256(args.checkpoint)
    if onnx_hash != EXPECTED_ONNX_SHA256:
        raise SystemExit(f"[parity] ONNX SHA-256 mismatch: {onnx_hash}")
    if checkpoint_hash != EXPECTED_CHECKPOINT_SHA256:
        raise SystemExit(f"[parity] checkpoint SHA-256 mismatch: {checkpoint_hash}")

    sys.path.insert(0, str(args.upstream_root.resolve()))
    import numpy as np
    import onnxruntime as ort
    import torch
    from src.model_lib.MiniFASNet import MiniFASNetV2
    from src.utility import get_kernel

    torch.set_num_threads(1)
    reference = MiniFASNetV2(conv6_kernel=get_kernel(80, 80)).cpu()
    state = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    if not isinstance(state, dict):
        raise SystemExit("[parity] checkpoint does not contain a state dict")
    if any(key.startswith("module.") for key in state):
        state = {key.removeprefix("module."): value for key, value in state.items()}
    reference.load_state_dict(state, strict=True)
    reference.eval()

    session = ort.InferenceSession(str(args.onnx), providers=["CPUExecutionProvider"])
    if len(session.get_inputs()) != 1 or len(session.get_outputs()) != 1:
        raise SystemExit("[parity] expected exactly one ONNX input and output")
    input_meta = session.get_inputs()[0]
    if input_meta.type != "tensor(float)":
        raise SystemExit(f"[parity] unexpected ONNX input type: {input_meta.type}")

    # MiniVision's actual inference path uses its custom ToTensor implementation.
    # Despite the transform docstring saying [0,1], functional.to_tensor returns
    # float() without dividing by 255 for NumPy/PIL uint8 input. test.py passes
    # the OpenCV uint8 crop directly, so the reference tensor range is [0,255].
    # Use varied deterministic tensors across the full reference input range.
    rng = np.random.default_rng(20261028)
    samples = {
        "zeros": np.zeros((1, 3, 80, 80), dtype=np.float32),
        "full_scale": np.full((1, 3, 80, 80), 255.0, dtype=np.float32),
        "uniform_0_255": (rng.random((1, 3, 80, 80), dtype=np.float32) * 255.0),
        "gradient_0_255": np.broadcast_to(
            np.linspace(0.0, 255.0, 80, dtype=np.float32)[None, None, None, :],
            (1, 3, 80, 80)
        ).copy()
    }

    raw_matches = True
    probability_matches = True
    max_raw_difference = 0.0
    max_probability_difference = 0.0
    for name, tensor in samples.items():
        with torch.inference_mode():
            logits = reference(torch.from_numpy(tensor)).cpu().numpy()
        onnx_output = session.run(
            [session.get_outputs()[0].name],
            {input_meta.name: tensor}
        )[0]
        if logits.shape != (1, 3) or onnx_output.shape != (1, 3):
            raise SystemExit(
                f"[parity] {name}: expected [1,3], got torch={logits.shape}, onnx={onnx_output.shape}"
            )
        probs = stable_softmax(logits)
        raw_diff = float(np.max(np.abs(onnx_output - logits)))
        prob_diff = float(np.max(np.abs(onnx_output - probs)))
        max_raw_difference = max(max_raw_difference, raw_diff)
        max_probability_difference = max(max_probability_difference, prob_diff)
        raw_matches = raw_matches and np.allclose(onnx_output, logits, atol=ATOL, rtol=RTOL)
        probability_matches = probability_matches and np.allclose(
            onnx_output, probs, atol=ATOL, rtol=RTOL
        )

    if raw_matches == probability_matches:
        raise SystemExit(
            "[parity] ambiguous or failed output contract: ONNX must match exactly one of "
            "upstream raw logits or upstream softmax probabilities"
        )
    output_semantics = "logits" if raw_matches else "probabilities"

    report = {
        "status": "PARITY_OK",
        "onnx_sha256": onnx_hash,
        "checkpoint_sha256": checkpoint_hash,
        "output_semantics": output_semantics,
        "input_contract": {
            "layout": "BGR-NCHW",
            "dtype": "float32",
            "range": [0.0, 255.0],
            "source": "MiniVision custom ToTensor implementation (functional.to_tensor does not divide by 255)"
        },
        "class_order_status": "UNRESOLVED",
        "class_order": None,
        "class_order_conflict": {
            "upstream_test_py": "argmax index 1 is labelled Real Face",
            "onnx_model_card": "describes output order as [live, print-attack, replay-attack]",
            "resolution": "Numerical parity resolves output transformation only, not semantic class labels. Keep PAD interpretation disabled until the semantic conflict is independently resolved."
        },
        "max_abs_difference_vs_logits": max_raw_difference,
        "max_abs_difference_vs_softmax": max_probability_difference,
        "atol": ATOL,
        "rtol": RTOL,
        "samples": list(samples),
        "limitations": [
            "Synthetic tensor parity only; not PAD accuracy or attack resistance.",
            "Parity does not establish semantic class labels; published upstream test code and ONNX model card conflict.",
            "The production preprocessing crop still requires pixel-level comparison against OpenCV on representative frames."
        ]
    }
    rendered = json.dumps(report, indent=2)
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
