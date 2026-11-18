"""Leakage-resistant season holdouts for NFL model development.

Produces split indices only. Fitting, feature construction and calibration must
happen inside each training fold; this module does not establish those guarantees.
"""
from collections import defaultdict


def season_holdouts(rows, *, min_train_seasons=2):
    """Yield (test_season, train_indices, test_indices) in chronological order.

    Rows require season (integer), game_id (unique), and kickoff_timestamp
    (timezone-aware ISO 8601). Every test season uses only prior seasons.
    No row may share a game_id or kickoff with an invalid timestamp.
    """
    from pregame_archive_audit import parse_instant

    if min_train_seasons < 1:
        raise ValueError("min_train_seasons must be positive")
    by_season = defaultdict(list)
    seen = set()
    for index, row in enumerate(rows):
        season = row["season"]
        if type(season) is not int:
            raise ValueError("season must be an integer")
        game_id = str(row["game_id"]).strip()
        if not game_id or game_id in seen:
            raise ValueError("blank or duplicate game_id")
        seen.add(game_id)
        kickoff = parse_instant(row["kickoff_timestamp"])
        by_season[season].append((index, kickoff))
    seasons = sorted(by_season)
    for season in seasons:
        dates = [d for _, d in by_season[season]]
        if not dates:
            continue
        for earlier in seasons:
            if earlier >= season:
                break
            if max(d for _, d in by_season[earlier]) >= min(dates):
                raise ValueError("season dates overlap or are out of chronological order")
    for offset in range(min_train_seasons, len(seasons)):
        test_season = seasons[offset]
        train = [i for season in seasons[:offset] for i, _ in by_season[season]]
        test = [i for i, _ in by_season[test_season]]
        if not train or not test:
            raise ValueError("empty train or test fold")
        yield test_season, train, test
