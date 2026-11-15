# Phase 10 — validation-first roadmap

This branch starts Phase 10 without modifying the deployed Phase 9 dashboard.

## Data contract
Each historical record must have: game_id, kickoff_utc, home_team, away_team, home_score, away_score, and optionally home_win_probability, prediction_created_utc, model_version. Predictions must be timestamped **before** kickoff. Games with missing fields, ties, or predictions created at/after kickoff are excluded with counts.

## Evaluation gates
1. Use a chronological holdout season not used to tune model parameters. No future results or closing lines may enter pregame features.
2. Report sample size, excluded counts, accuracy versus always-pick-home baseline, Brier score, log loss, and calibration bins.
3. Compare against a market baseline only when timestamped, jurisdiction-verified pregame odds are available; remove bookmaker vig before comparisons.
4. Segment performance by season, confidence, and data availability. Publish uncertainty intervals before describing any edge.
5. Never infer profitable betting from accuracy alone; simulated ROI requires actual timestamped executable prices and explicit stake assumptions.

## Planned integrations (not implemented yet)
- Verified starting quarterback status and timestamped availability
- Official injury reports with source and update time
- Stadium-specific forecast snapshots with kickoff timing
- Ontario-regulated sportsbook offers, checked against operator availability
- Automated ingestion, reproducible training, walk-forward tests, and calibration

## Safety
Research and paper betting only. No live wager placement. Never commit API credentials.
