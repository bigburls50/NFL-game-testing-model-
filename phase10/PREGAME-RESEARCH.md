# Pregame research: quarterback changes, injury reports and weather

Production remains the fitted Phase 10 V2 baseline. The following research outputs do not alter dashboard probabilities, stake sizing or the earlier frozen paper tests.

* QB offset: use a depth snapshot at least three hours before kickoff, select the newest whole team snapshot, reject ambiguity, and compare the projected QB's rolling, shrinkage-adjusted EPA/dropback against the prior completed-game starter. Fit one coefficient on 2025 and test 2026. Current-game identity and stats cannot enter features. The candidate failed the probability-error gate; a higher hit rate alone is not sufficient.
* Injury offset: fit a regularized offset using offensive, defensive, and prior-starter-QB status burdens on 2019–22; assess on 2023–24. The 2025–26 source has no individual modification timestamps. Older results are encouraging but no contemporary promotion is permitted.
* Prospectively archive observations of injury candidate statuses, exact timestamped depth snapshots and ESPN scoreboard weather/venue indicators every scheduled refresh. Undated injuries have a retrieval observation time, never a retroactively inferred official report timestamp. The scoreboard may omit wind, forecast issue time and temperature units; do not fabricate them or infer a retractable roof's state.
* Immutable observation files have a content SHA-256; the scoring process takes the latest observation between 3 and 24 hours before kickoff, independent of candidate availability and results. Forecasts withheld by the V2 gate remain withheld. Only paired non-tied final games count. No money or stake is recorded.

## Reproduce

Use the exact source URLs/checksums recorded in the two validation JSON files and download seasonal CSVs to local directories.

```sh
node phase10/evaluate-qb-change.mjs /path/to/games.csv /path/to/stats /path/to/depth
node phase10/evaluate-injury-impact.mjs /path/to/games.csv /path/to/injuries
node --test phase10/*.test.mjs
node phase10/generate-provisional-feed.mjs --archive
node phase10/score-pregame-observations.mjs
```

The research archive and score report are separate from the existing forward-paper test and the efficiency challenger slate. A missing research observation must not block a normal V2 feed refresh.
