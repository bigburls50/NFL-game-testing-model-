import unittest
from season_holdouts import season_holdouts


def game(year, suffix="a", kickoff=None):
    return {"season": year, "game_id": f"{year}-{suffix}",
            "kickoff_timestamp": kickoff or f"{year}-09-01T12:00:00Z"}


class SeasonHoldoutTests(unittest.TestCase):
    def test_past_only_expanding_folds(self):
        rows = [game(y) for y in (2022, 2023, 2024, 2025)]
        self.assertEqual(list(season_holdouts(rows)),
                         [(2024, [0, 1], [2]), (2025, [0, 1, 2], [3])])

    def test_unordered_input_still_chronological(self):
        rows = [game(y) for y in (2025, 2022, 2024, 2023)]
        self.assertEqual(list(season_holdouts(rows)),
                         [(2024, [1, 3], [2]), (2025, [1, 3, 2], [0])])

    def test_duplicate_games_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            list(season_holdouts([game(2022), game(2022)]))

    def test_overlapping_seasons_rejected(self):
        with self.assertRaisesRegex(ValueError, "overlap"):
            list(season_holdouts([game(2022, kickoff="2024-01-01T00:00:00Z"),
                                  game(2023), game(2024)]))

    def test_invalid_min_train_seasons_rejected(self):
        with self.assertRaises(ValueError):
            list(season_holdouts([game(2022)], min_train_seasons=0))

    def test_naive_kickoff_rejected(self):
        with self.assertRaises(ValueError):
            list(season_holdouts([game(2022, kickoff="2022-09-01T12:00:00")]))

    def test_no_holdout_without_history(self):
        self.assertEqual(list(season_holdouts([game(2024)])), [])


if __name__ == "__main__":
    unittest.main()
