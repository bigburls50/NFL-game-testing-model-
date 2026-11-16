# EPA multi-season evaluation review (2023–2025)

Source: GitHub Actions Phase 10 validation run 43903962846, job `multi-season-epa-evaluation`, commit `7b56f297addab55a8a7bbab2acc2172937823c89`. Results are retrospective exploratory comparisons, not a prospective betting study.

| Season | Games | Ensemble accuracy | EPA accuracy | EPA Brier | EPA log loss | EPA high-confidence correct/selected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2023 | 285 | 56.49% | 55.09% | 0.239579 | 0.671691 | 2/2 |
| 2024 | 285 | 64.91% | 66.67% | 0.218924 | 0.628552 | 11/12 |
| 2025 | 284 | 63.73% | 61.62% | 0.223109 | 0.636283 | 12/12 |
| Total | 854 | 61.71% | 61.12% | 0.227209 | 0.645519 | 25/26 |

Baseline ensemble Brier 0.227764 and log loss 0.646978. The fixed 0.75 high-confidence threshold selected 26/854 (3.04%) EPA picks, with 25 correct (96.15%). This is a small, selected retrospective sample, not evidence that 75% future accuracy is achieved. A 2025 12/12 result has Wilson 95% interval roughly 75.75%–100%, and prospective drift is not covered by this interval.

## Decision

**Do not promote EPA-enhanced predictions to production.** EPA reduces all-game accuracy by approximately 0.59 percentage points across the evaluated seasons, despite slight aggregate Brier/log-loss improvements. 2023 and 2025 regress versus baseline. Keep the existing deployed model unchanged.

## Required before reconsideration

1. Audit source timestamps, team mappings, season transitions, and whether every input was genuinely available before kickoff; prevent same-game or future leakage.
2. Separate model selection/training from evaluation using expanding-window, strictly chronological walk-forward splits. Freeze coefficients, feature engineering, and the 0.75 threshold before each held-out test.
3. Compare against Elo, always-home, and bookmaker-implied probability baselines where legally available; include Brier, log loss, accuracy, coverage, uncertainty intervals, and calibration curves.
4. Evaluate high-confidence performance over a much larger, prospectively collected sample and quantify uncertainty; do not optimize the threshold on the test seasons.
5. Add quarterback availability, injuries, rest and weather only with verified pregame as-of timestamps and missing-data handling.
6. Confirm Android PWA functionality separately; do not deploy unverified changes or enable wagering.

No new training, deployment, paid API use, or real-money betting is authorized by this review document.