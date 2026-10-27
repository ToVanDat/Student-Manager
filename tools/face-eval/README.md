# Face model evaluation and local ONNX benchmark

## Candidate artifacts and pinned contracts

### Recognition: Qualcomm MobileFaceNet

- Model card: https://huggingface.co/qualcomm/MobileFaceNet
- Model card license: Apache-2.0.
- Pre-exported assets include ONNX float and ONNX w8a16, release path currently shown as `v0.65.0`.
- Input: 112x112 face image; output: 128-D embedding.
- Qualcomm page reports device-specific NPU performance, not browser WASM performance. Those numbers must not be projected onto a Windows PC with unknown CPU/GPU.
- The page describes training with ArcFace loss on MS-Celeb-1M. Treat training-data provenance/rights as a separate review item.
- The downloadable artifact is a ZIP. Extract the ONNX file locally. The benchmark calculates its SHA-256, but no expected Qualcomm ONNX digest is pinned in this repo yet.

### PAD: MiniFASNet-V2 ONNX candidate

- Model card: https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx
- Model card license: Apache-2.0.
- ONNX SHA-256 published by the model card: `d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b`.
- Size: 1,744,116 bytes.
- Input: `[1,3,80,80]`, float32, BGR, pixel/255, NCHW.
- Crop: 2.7x margin around detected face box; no alignment warp.
- Output: 3-class softmax `[live, print-attack, replay-attack]`. The class order must be verified against the exact artifact before using the score.
- Liveness score in the model card: `1 - (p[print] + p[replay])`.
- This is a single-image classifier, not a certified PAD system. Evaluate temporal attacks and broader attack instruments independently.

## Run locally on Windows

1. Download/extract the model artifacts from their model cards. Keep them outside Git and do not commit them.
2. Start a local static server from repository root, e.g.:

```bat
py -m http.server 8000
```

3. Open `http://localhost:8000/tools/face-eval/browser-benchmark.html`.
4. Select the model profile and local ONNX file. Run WASM first, then WebGPU only if available.
5. Save the JSON report. It contains model file hash, tensor metadata and latency, not biometric samples.

The browser page pins ONNX Runtime Web 1.22.0 via jsDelivr. Internet access is needed for this runtime script. It does not upload the selected ONNX file or tensor data.

## What the benchmark proves / does not prove

It checks whether ONNX Runtime Web can load the model, whether the graph input tensor has the expected fixed shape, output metadata, and warm inference latency (5 warm-up runs plus 30/50/100 measured runs). It computes SHA-256 in-browser and checks the published MiniFASNet ONNX digest.

It does NOT prove:
- exact pixel preprocessing, crop/align compatibility or numerical parity with upstream reference;
- embedding quality, FAR/FRR, EER, demographic robustness;
- PAD APCER/BPCER, replay resistance, mask resistance or ISO/IEC 30107-3 conformity;
- production security or trustworthiness of a browser camera/client.

Synthetic tensors are deliberately used here. Do not interpret the latency report as recognition/PAD accuracy.

## Next gate

After successful graph compatibility, implement a separate, reviewed preprocessing parity test using consented test images kept locally. Compare browser outputs with the upstream reference implementation and evaluate on subject/session/device-disjoint development and locked test sets. Only then select a recognition threshold and assess PAD by attack species. Do not create enrollment APIs or biometric database tables until those gates pass.
