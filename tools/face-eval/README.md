# Face model evaluation harness

This directory provides a dependency-free evaluator for **precomputed scores**. It deliberately does not download models, access a webcam, store face images, or perform inference.

## Privacy and data handling

- Use only consented evaluation data and follow the approved retention policy.
- Keep source photos/videos and identity mapping outside this repository.
- CSVs must contain numeric scores and coarse labels only; never include names, student IDs, account IDs, raw embeddings, image paths, or biometric samples.
- Keep the dataset and CSV files outside Git. Do not upload biometric samples to public issue trackers or CI artifacts.

## 1. Face verification

CSV columns:

```csv
label,similarity
genuine,0.73
genuine,0.68
impostor,0.19
impostor,0.34
```

- `label`: `genuine` or `impostor`.
- `similarity`: cosine similarity in [-1, 1], calculated from normalized embeddings.
- Each pair must be counted once. Keep identities subject-disjoint across enrollment, development and test partitions.

Run on Windows Command Prompt:

```bat
py tools\\face-eval\\evaluate.py --task face --csv C:\\private-face-eval\\face-pairs-test.csv
```

The evaluator sweeps thresholds and reports an approximate equal-error operating point (FAR/FRR). It does not select a production threshold.

## 2. Presentation Attack Detection (PAD)

CSV columns:

```csv
label,bona_fide_score
bona_fide,0.97
bona_fide,0.84
attack,0.12
attack,0.41
```

- `label`: `bona_fide` or `attack`.
- `bona_fide_score`: model score/probability for the bona-fide class in [0, 1].
- For multi-class models, convert the documented output to a bona-fide score using that model's own preprocessing/output contract; do not assume every model has the same class order.

Run:

```bat
py tools\\face-eval\\evaluate.py --task pad --csv C:\\private-face-eval\\pad-test.csv
```

Reports APCER, BPCER and ACER at the minimum-ACER threshold on the supplied CSV. Report APCER by attack instrument/species and BPCER by device/lighting as well; aggregate ACER can hide a dangerous weak attack category.

## Required evaluation protocol before model approval

1. Pin the exact repository revision, artifact URL, file SHA-256, model card, model license and preprocessing contract.
2. Review training-data provenance and restrictions separately from the code/model license.
3. Split by subject, capture session, device and attack instrument. Never randomly split adjacent frames from the same recording across train/test.
4. Keep a development split for threshold selection and a locked test split for final reporting.
5. Face verification: report genuine/impostor pair counts, FAR, FRR, ROC, EER estimate and confidence intervals. Test across lighting, pose, camera quality and representative demographic groups with consent.
6. PAD: report APCER by attack species, BPCER, ACER, attack instruments, print/display quality, replay, masks if in scope, lighting and camera devices. A small public sample/demo is not evidence of production security.
7. Benchmark browser CPU/WASM and optional WebGPU on the actual low-spec target machine and common phones. Record model load time, warm/cold inference p50/p95, peak memory, bundle/model size and failure rate.
8. Keep matching/PAD client-side prototype explicitly low assurance. Browser JavaScript and camera input can be manipulated; do not treat a browser-generated `live=true` as trusted proof.

## Candidate notes (not an approval)

- Qualcomm AI Hub MobileFaceNet is a reasonable recognition candidate to investigate: its model page states 112x112 input, 128-D output, approximately 4 MB FP32 and Apache-2.0 model license. It also states training with MS-Celeb-1M. Pin and inspect the exact downloadable ONNX asset and training-data rights before use; a license label alone is not a complete provenance review.
- MiniFASNet / Silent-Face-Anti-Spoofing ONNX exports are candidates for PAD experiments only. Verify the exact upstream weight provenance, license, preprocessing, class ordering and SHA-256. Third-party forks and conversion repos are not interchangeable.
- MediaPipe Face Landmarker can support detection/landmarks/alignment guidance; it is not an identity recognizer or a standalone PAD model.

No model weights, biometric data, runtime dependencies, API routes or database migrations are included in this evaluation scaffold.
