# Face evaluation (offline)

This tool evaluates precomputed scores from consented, controlled test sessions. It does not read face images, store embeddings, execute ONNX models, infer MiniFASNet class order, or enable Face Login.

## Input formats

recognition_pairs.csv requires columns: split,label,similarity,participant_a,participant_b,session_a,session_b,device_a,device_b
- split: calibration or test
- label: genuine or impostor
- similarity: cosine similarity from the pinned embedding pipeline, in [-1,1]
- participant_a/participant_b: pseudonymous subject IDs for the two images
- session_a/session_b and device_a/device_b: pseudonymous capture-session and device IDs for the two images

pad_samples.csv requires columns: split,attack_type,live_score,participant_id,session_id,device_id
- split: calibration or test
- attack_type: bona_fide, print, replay, or video
- live_score: trusted PAD score in [0,1], where higher means more bona fide
- participant_id/session_id/device_id: pseudonymous identifiers; raw identity, file path, image, and embedding data are not accepted

## Run

From the API directory, run:

    python tools/face-eval/evaluate.py --recognition C:\face-test\recognition_pairs.csv --pad C:\face-test\pad_samples.csv --output C:\face-test\report.json

Keep CSV files outside Git. Do not put raw face images or embedding vectors in these files.

## Model parity gate

Before generating PAD CSV values, compare the exact ONNX file with the original MiniVision PyTorch checkpoint. The verifier checks both SHA-256 hashes, runs deterministic BGR tensors through PyTorch and ONNX Runtime, and determines whether the ONNX graph returns raw logits or softmax probabilities by numerical parity. It only accepts a unique match.

From the API directory (requires Python packages `torch`, `onnxruntime`, and `numpy`, plus a local upstream checkout and the exact checkpoint):

    python tools/face-eval/verify_minifasnet_parity.py --upstream-root C:\\face-test\\Silent-Face-Anti-Spoofing --checkpoint C:\\face-test\\2.7_80x80_MiniFASNetV2.pth --onnx storage\\face-models\\anti-spoofing\\minifasnet-v2.onnx --output C:\\face-test\\minifasnet-parity.json

A successful synthetic parity report is necessary but not sufficient: it does not measure PAD performance, validate the production crop pixel-for-pixel, or prove resistance to attacks. Classes 0 and 2 are both treated as attacks by the upstream reference; do not call them print/replay individually without separate evidence. The API remains fail-closed until the parity report is reviewed and the verified contract is explicitly promoted in code.

## Metrics

- Recognition threshold is selected on calibration data by minimizing the difference between FAR and FRR (empirical EER operating point). FAR/FRR are then reported on held-out test data.
- PAD threshold is selected on calibration data by minimizing ACER. Held-out test reports BPCER and APCER separately for print, replay, and video attacks, plus mean APCER and ACER. Per-rate 95% Wilson intervals are included; ACER interval is not estimated.
- The evaluator enforces disjoint participant, session, and device identifiers between calibration and test, including cross-role participant leakage in verification pairs. Split by participant/session/device, not by random frame or pair.
- This script reports point estimates and pointwise Wilson 95% intervals for BPCER/APCER. It does not estimate a confidence interval for ACER or adjust for multiple comparisons.
- Current MiniFASNet sources conflict: the hash-matched ONNX model card describes `[live, print, replay]`, while upstream MiniVision inference treats class index 1 as real. The API therefore refuses to interpret the three outputs until direct ONNX-vs-PyTorch parity resolves both class order and logits/probability semantics. Never infer a mapping from a variable name or a single score vector.
- Current inference property names do not independently prove the output class mapping.

Example scores in any tutorial are format examples, not measurements. This script does not select production thresholds or certify PAD.