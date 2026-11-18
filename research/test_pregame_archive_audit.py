import csv
import tempfile
import unittest
from pathlib import Path

from pregame_archive_audit import validate_archive


class ArchiveAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "predictions.csv"

    def write(self, rows):
        with self.path.open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["game_id", "prediction_timestamp", "kickoff_timestamp", "home_win_probability"])
            writer.writerows(rows)

    def test_valid_archive_and_hash(self):
        self.write([["a", "2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z", "0.75"]])
        report = validate_archive(self.path)
        self.assertEqual(report["games"], 1)
        self.assertEqual(len(report["sha256"]), 64)

    def test_kickoff_boundary_rejected(self):
        self.write([["a", "2026-09-01T13:00:00Z", "2026-09-01T13:00:00Z", "0.5"]])
        with self.assertRaises(ValueError):
            validate_archive(self.path)

    def test_offset_equivalence_rejected(self):
        self.write([["a", "2026-09-01T09:00:00-04:00", "2026-09-01T13:00:00Z", "0.5"]])
        with self.assertRaises(ValueError):
            validate_archive(self.path)

    def test_duplicate_game_rejected(self):
        self.write([["a", "2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z", "0.5"]] * 2)
        with self.assertRaises(ValueError):
            validate_archive(self.path)

    def test_missing_timezone_rejected(self):
        self.write([["a", "2026-09-01T12:00:00", "2026-09-01T13:00:00Z", "0.5"]])
        with self.assertRaises(ValueError):
            validate_archive(self.path)

    def test_outcome_columns_rejected_even_when_blank(self):
        for column in ("home_score", "winner", "RESULT", "final_score"):
            with self.subTest(column=column):
                with self.path.open("w", newline="") as handle:
                    writer = csv.writer(handle)
                    writer.writerow(["game_id", "prediction_timestamp", "kickoff_timestamp", "home_win_probability", column])
                    writer.writerow(["a", "2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z", "0.5", ""])
                with self.assertRaisesRegex(ValueError, "outcome columns"):
                    validate_archive(self.path)

    def test_nonfinite_probability_rejected(self):
        for p in ("nan", "inf", "-0.1", "1.1"):
            with self.subTest(p=p):
                self.write([["a", "2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z", p]])
                with self.assertRaises(ValueError):
                    validate_archive(self.path)


if __name__ == "__main__":
    unittest.main()
