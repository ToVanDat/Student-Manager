import unittest
from types import SimpleNamespace

from app import extract_five_points, extract_liveness_signals


class LandmarkExtractionTests(unittest.TestCase):
    def test_extracts_five_points_and_face_oval_bbox(self):
        face = [SimpleNamespace(x=0.5, y=0.5) for _ in range(478)]
        coordinates = {
            10: (0.5, 0.2), 152: (0.5, 0.85), 234: (0.25, 0.5), 454: (0.75, 0.5),
            33: (0.35, 0.4), 133: (0.4, 0.4), 362: (0.6, 0.4), 263: (0.65, 0.4),
            1: (0.5, 0.55), 61: (0.4, 0.65), 291: (0.6, 0.65),
        }
        for index, (x, y) in coordinates.items():
            face[index] = SimpleNamespace(x=x, y=y)

        result = extract_five_points(face, 100, 100)
        self.assertEqual(len(result['five']), 5)
        self.assertAlmostEqual(result['five'][0][0], 37.5)
        self.assertAlmostEqual(result['five'][1][0], 62.5)
        self.assertEqual(result['bbox'], {'x': 25.0, 'y': 20.0, 'width': 50.0, 'height': 65.0})

    def test_rejects_incomplete_mesh(self):
        with self.assertRaises(ValueError):
            extract_five_points([], 100, 100)


    def test_extracts_required_liveness_blendshapes(self):
        names = {
            "eyeBlinkLeft": 0.1,
            "eyeBlinkRight": 0.2,
            "mouthSmileLeft": 0.3,
            "mouthSmileRight": 0.4,
            "jawOpen": 0.05,
        }
        categories = [SimpleNamespace(category_name=name, score=score) for name, score in names.items()]
        result = extract_liveness_signals([categories])
        self.assertEqual(result, names)

    def test_rejects_missing_or_invalid_liveness_scores(self):
        with self.assertRaises(ValueError):
            extract_liveness_signals([])
        categories = [SimpleNamespace(category_name="eyeBlinkLeft", score=1.5)]
        with self.assertRaises(ValueError):
            extract_liveness_signals([categories])


if __name__ == '__main__':
    unittest.main()
