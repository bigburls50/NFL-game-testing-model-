"""Timezone and predeclared confidence-boundary regression tests."""
import unittest
from validate_prospective_predictions import evaluate

BASE = dict(game_id='g1', prediction_utc='2026-11-17T15:00:00Z', kickoff_utc='2026-11-17T20:00:00Z', home_win_probability='0.75', home_win='1')

class ProspectiveEdgeCases(unittest.TestCase):
    def test_equivalent_timezone_kickoff_rejected(self):
        with self.assertRaises(ValueError):
            evaluate([{**BASE, 'prediction_utc': '2026-11-17T15:00:00-05:00'}])

    def test_timezone_offset_comparison_uses_instant(self):
        result = evaluate([{**BASE, 'prediction_utc': '2026-11-17T14:59:00-05:00'}])
        self.assertEqual(result['games'], 1)

    def test_confidence_threshold_inclusive(self):
        result = evaluate([BASE], threshold=0.75)
        self.assertEqual(result['high_confidence_games'], 1)

    def test_away_favourite_at_boundary(self):
        result = evaluate([{**BASE, 'home_win_probability': '0.25', 'home_win': '0'}])
        self.assertEqual(result['high_confidence_games'], 1)

    def test_below_threshold_not_selected(self):
        result = evaluate([{**BASE, 'home_win_probability': '0.7499'}])
        self.assertEqual(result['high_confidence_games'], 0)

    def test_empty_sample_rejected(self):
        with self.assertRaises(ValueError):
            evaluate([])

    def test_invalid_threshold_rejected(self):
        for threshold in (0.5, 1.0, float('nan')):
            with self.subTest(threshold=threshold), self.assertRaises(ValueError):
                evaluate([BASE], threshold=threshold)

if __name__ == '__main__':
    unittest.main()
