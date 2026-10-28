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

## Metrics

- Recognition threshold is selected on calibration data by minimizing the difference between FAR and FRR (empirical EER operating point). FAR/FRR are then reported on held-out test data.
- PAD threshold is selected on calibration data by minimizing ACER. Held-out test reports BPCER and APCER separately by attack type, plus mean APCER and ACER.
- The evaluator enforces disjoint participant, session, and device identifiers between calibration and test, including cross-role participant leakage in verification pairs. Split by participant/session/device, not by random frame or pair.
- This script reports point estimates only, not confidence intervals. Include sample counts and confidence intervals in the study report.
- Confirm MiniFASNet output class order against the original pinned metadata before deriving live_score. Never assume index 0 is bona fide.
- Current inference property names do not independently prove the output class mapping.

Example scores in any tutorial are format examples, not measurements. This script does not select production thresholds or certify PAD.