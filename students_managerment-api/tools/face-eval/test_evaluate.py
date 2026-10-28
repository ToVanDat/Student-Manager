import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("evaluate.py")
SPEC = importlib.util.spec_from_file_location("face_evaluate", SCRIPT)
EVALUATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EVALUATOR)


class SplitIsolationTests(unittest.TestCase):
    def test_recognition_pair_checks_both_participant_roles(self):
        rows = [
            {"split": "calibration", "participant_a": ("person-1", "person-2")},
            {"split": "test", "participant_a": ("person-3", "person-1")},
        ]
        with self.assertRaisesRegex(ValueError, "participant_a leakage"):
            EVALUATOR.validate_disjoint_splits(rows, ("participant_a",), "Recognition")

    def test_disjoint_participants_sessions_and_devices_pass(self):
        rows = [
            {"split": "calibration", "participant": "p-1", "session": "s-1", "device": "d-1"},
            {"split": "test", "participant": "p-2", "session": "s-2", "device": "d-2"},
        ]
        EVALUATOR.validate_disjoint_splits(
            rows, ("participant", "session", "device"), "PAD"
        )

    def test_session_leakage_is_rejected(self):
        rows = [
            {"split": "calibration", "session": "session-shared"},
            {"split": "test", "session": "session-shared"},
        ]
        with self.assertRaisesRegex(ValueError, "session leakage"):
            EVALUATOR.validate_disjoint_splits(rows, ("session",), "PAD")

    def test_wilson_interval_contains_point_estimate(self):
        interval = EVALUATOR.wilson_interval(5, 100)
        self.assertLessEqual(interval[0], 0.05)
        self.assertGreaterEqual(interval[1], 0.05)

    def test_wilson_interval_handles_zero_observed_errors(self):
        lower, upper = EVALUATOR.wilson_interval(0, 100)
        self.assertEqual(lower, 0.0)
        self.assertGreater(upper, 0.0)

    def test_pad_attack_coverage_rejects_missing_attack_type(self):
        rows = [
            {"bona_fide": True, "attack_type": "bona_fide"},
            {"bona_fide": False, "attack_type": "print"},
            {"bona_fide": False, "attack_type": "replay"},
        ]
        with self.assertRaisesRegex(ValueError, "video"):
            EVALUATOR.validate_attack_coverage(rows, "test")

    def test_pad_attack_coverage_accepts_all_attack_types(self):
        rows = [
            {"bona_fide": True, "attack_type": "bona_fide"},
            {"bona_fide": False, "attack_type": "print"},
            {"bona_fide": False, "attack_type": "replay"},
            {"bona_fide": False, "attack_type": "video"},
        ]
        EVALUATOR.validate_attack_coverage(rows, "calibration")


if __name__ == "__main__":
    unittest.main()
