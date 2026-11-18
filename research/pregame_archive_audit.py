"""Fail-closed validation for independently archived NFL pregame prediction records.

This module does not prove independent publication; a trusted external timestamp
or immutable storage receipt is still required for prospective claims.
"""
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path


def parse_instant(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("timestamp is missing")
    try:
        instant = dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid ISO timestamp") from exc
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError("timezone offset is required")
    return instant.astimezone(dt.timezone.utc)


def validate_archive(path):
    """Return a deterministic audit; raise on any malformed or late prediction."""
    raw = Path(path).read_bytes()
    with Path(path).open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError("missing required archive columns")
        normalized = [name.strip().lower() for name in reader.fieldnames]
        if len(normalized) != len(set(normalized)):
            raise ValueError("duplicate column names after normalization")
        forbidden = {"home_score", "away_score", "home_points", "away_points", "winner", "home_win", "result", "final_score"}
        if forbidden.intersection(normalized):
            raise ValueError("outcome columns are prohibited in immutable pregame archives")
        if normalized != reader.fieldnames:
            raise ValueError("archive column names must be canonical lowercase without whitespace")
        required = {"game_id", "prediction_timestamp", "kickoff_timestamp", "home_win_probability"}
        if not required.issubset(normalized):
            raise ValueError("missing required archive columns")
        seen = set()
        count = 0
        for row in reader:
            if None in row or any(value is None for value in row.values()):
                raise ValueError("malformed CSV row")
            game_id = row["game_id"].strip()
            if not game_id or game_id in seen:
                raise ValueError("blank or duplicate game_id")
            seen.add(game_id)
            if parse_instant(row["prediction_timestamp"]) >= parse_instant(row["kickoff_timestamp"]):
                raise ValueError("prediction is not strictly before kickoff")
            try:
                probability = float(row["home_win_probability"])
            except (ValueError, TypeError) as exc:
                raise ValueError("invalid probability") from exc
            if not 0 <= probability <= 1:
                raise ValueError("probability outside [0,1]")
            count += 1
    if not count:
        raise ValueError("empty prediction archive")
    return {"games": count, "sha256": hashlib.sha256(raw).hexdigest(),
            "provenance": "self-reported timestamps only; not independent proof"}


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python research/pregame_archive_audit.py predictions.csv")
    print(json.dumps(validate_archive(sys.argv[1]), sort_keys=True))
