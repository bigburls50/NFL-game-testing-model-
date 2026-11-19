# Player-role-weighted injury challenger

The V2 production probability is unchanged. This challenger is a prospective, no-money research model.

- Join Pro Football Reference snap counts to NFL GSIS player IDs using unambiguous one-to-one IDs from nflverse players. Do not match by name.
- Validate each team-game's snap totals and mapping coverage, and require exact game ID and opposing team.
- Estimate each injured non-QB player's role from the weighted share of offensive or defensive snaps over the previous six team games, retaining up to eight games to identify recent participants. Missing recent data, ambiguous identity or an absent history is unknown rather than zero. QB status remains separate.
- Fit an offset to historical V2 on 2019–22 using timestamped injury reports. Compare to V2 and the count-only injury model on the identical 561 games in 2023–24. This reuses the earlier injury holdout, not an untouched new test set. Snap usage measures playing time, not individual causal performance or replacement quality.
- The retrospective screen passed (90.3% injury-role coverage and lower Brier/log loss than both alternatives). The production gate remains closed because the 2025–26 injury source lacks per-player report timestamps.
- Each scheduled archive refresh fetches current and previous season snap counts and the ID mapping, records hashes, and produces a candidate only for V2-eligible games, where both teams have recognized game-status designations and at least 80% of reported non-QB injury roles can be estimated. No assumptions are made about missing teams, no snap data, or unissued game-status reports. Prior immutable snapshots are unchanged.
- The first snapshot includes one eligible injury-weighted candidate; future snapshots will capture more as game-status reports arrive. Fixed-horizon scoring compares all three models on the same final results only. This has no effect on the earlier frozen betting trial or the live dashboard.

## Reproduce

Download source CSVs using the URLs and SHA-256 values in `player-impact-validation.json`. Save snap counts as `snap-2016.csv` through `snap-2026.csv`, the player identity table as `players.csv`, and injury files as `injuries-2016.csv` through `injuries-2026.csv`.

```sh
node phase10/evaluate-player-impact.mjs /path/to/games.csv /path/to/snaps /path/to/injuries
node --test phase10/*.test.mjs
node phase10/generate-provisional-feed.mjs --archive
node phase10/score-pregame-observations.mjs
```
