# Advanced pregame feature integration (development)

The `pregame-features.mjs` module defines an ingestion boundary for QB efficiency (EPA/dropback and CPOE), team offensive and defensive EPA/play, injuries, wind and temperature, rest, and travel. Each row must have `game_id` and a genuine `kickoff_utc`; each feature snapshot must have `game_id`, `as_of_utc`, and optional numeric feature columns. The join selects the most recent snapshot **strictly before kickoff**, never a later one. Missing features remain blank.

This is **schema and leakage protection**, not an operational live-data integration. Historical game schedules currently include game date/time but not verified timezone-aware kickoff timestamps. Do not derive timestamps by guessing a timezone. Do not use postgame season aggregates, postgame injury status, closing lines of uncertain timestamp, or final game scores as features.

Next integration milestones:
1. Ingest nflverse weekly player and play-by-play sources with explicit availability dates, stable team/QB mappings, and week-cutoff aggregation.
2. Verify which EPA and CPOE columns exist by season and build rolling pregame features using only completed earlier games.
3. Add source-stamped official injury reports, weather forecasts, travel/rest, with missingness indicators and backfill availability checks.
4. Train gradient-boosted and regularized models only on prior seasons; freeze transformations and confidence thresholds on validation seasons, evaluate genuinely untouched later seasons.
5. Compare Brier, log loss, calibration, all-game accuracy, high-confidence coverage, and paper-betting return with vig.

Example invocation: `node phase10/pregame-features.mjs games-with-kickoff.csv snapshots.csv joined.csv`.
