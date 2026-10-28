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


if __name__ == "__main__":
    unittest.main()
