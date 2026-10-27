# Face evaluation (offline)

This tool evaluates precomputed scores from consented, controlled test sessions. It does not read face images, store embeddings, execute ONNX models, infer MiniFASNet class order, or enable Face Login.

## Input formats

recognition_pairs.csv requires columns: split,label,similarity
- split: calibration or test
- label: genuine or impostor
- similarity: cosine similarity from the pinned embedding pipeline, in [-1,1]

pad_samples.csv requires columns: split,attack_type,live_score
- split: calibration or test
- attack_type: bona_fide, print, replay, or video
- live_score: trusted PAD score in [0,1], where higher means more bona fide

## Run

From the API directory, run:

    python tools/face-eval/evaluate.py --recognition C:\face-test\recognition_pairs.csv --pad C:\face-test\pad_samples.csv --output C:\face-test\report.json

Keep CSV files outside Git. Do not put raw face images or embedding vectors in these files.

## Metrics

- Recognition threshold is selected on calibration data by minimizing the difference between FAR and FRR (empirical EER operating point). FAR/FRR are then reported on held-out test data.
- PAD threshold is selected on calibration data by minimizing ACER. Held-out test reports BPCER and APCER separately by attack type, plus mean APCER and ACER.
- Split by participant/session/device, not by random frame or pair, to prevent leakage from near-duplicate captures.
- This script reports point estimates only, not confidence intervals. Include sample counts and confidence intervals in the study report.
- Confirm MiniFASNet output class order against the original pinned metadata before deriving live_score. Never assume index 0 is bona fide.
- Current inference property names do not independently prove the output class mapping.

Example scores in any tutorial are format examples, not measurements. This script does not select production thresholds or certify PAD.