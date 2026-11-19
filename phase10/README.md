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

## Running the first validation checks

From the repository root, run:

```sh
node --check phase10/evaluate.mjs
node --test phase10/evaluate.test.mjs
node phase10/evaluate.mjs path/to/pregame-predictions.csv
```

The automated GitHub Actions workflow runs the syntax and test commands for Phase 10 changes. A passing software test **does not** establish predictive accuracy or profitable betting performance.

### CSV input schema

Required columns: `game_id,kickoff_utc,prediction_created_utc,home_team,away_team,home_score,away_score,home_win_probability`. Timestamps must include a timezone (prefer UTC with `Z`). The probability is a decimal strictly between 0 and 1. Each game should appear once. Never populate historical predictions using final scores or post-kickoff information.

### Interpretation

The current evaluator calculates in-sample metrics for the supplied records. It does **not** yet implement season-separated holdouts, walk-forward testing, uncertainty intervals, verified Ontario market pricing, or a live prediction data pipeline. Do not interpret its output as a validated edge.
