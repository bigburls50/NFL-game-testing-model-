import unittest
from validate_prospective_predictions import evaluate

BASE = {'game_id':'g1','prediction_utc':'2026-11-17T10:00:00Z','kickoff_utc':'2026-11-17T20:00:00Z','home_win_probability':'0.8','home_win':'1'}
class ValidationTests(unittest.TestCase):
    def test_metrics(self):
        result = evaluate([BASE])
        self.assertEqual(result['high_confidence_coverage'],1)
        self.assertAlmostEqual(result['brier_score'],.04)
        self.assertAlmostEqual(result['all_game_accuracy'],1)
    def test_duplicate(self):
        with self.assertRaises(ValueError): evaluate([BASE,BASE])
    def test_future_prediction(self):
        with self.assertRaises(ValueError): evaluate([{**BASE,'prediction_utc':BASE['kickoff_utc']}])
    def test_missing_timezone(self):
        with self.assertRaises(ValueError): evaluate([{**BASE,'prediction_utc':'2026-11-17T10:00:00'}])
    def test_invalid_probability(self):
        with self.assertRaises(ValueError): evaluate([{**BASE,'home_win_probability':'nan'}])
    def test_no_confident_picks(self):
        result=evaluate([{**BASE,'home_win_probability':'0.55'}])
        self.assertIsNone(result['high_confidence_accuracy'])
        self.assertEqual(result['high_confidence_coverage'],0)
if __name__=='__main__': unittest.main()
