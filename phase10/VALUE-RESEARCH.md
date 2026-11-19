# Profitability lab and Ontario price-shopping research

Production stays on V2. Historical prices are a research proxy, not proof of tradeable odds or profit. The data dictionary supplies moneyline values without verified observation time or sportsbook identity.

- Build prior-season fitted V2 predictions for 2019–26 (ties excluded from fitting but retained as pushes in the price replay).
- Fit a constrained log-odds blend of V2 and no-vig market probability on strictly earlier-season records, then score 2023–24 and 2025–26. The fitted independent V2 weight was zero in every scored season.
- Evaluate a fixed 3% modeled-EV threshold with at most three singles per week, quarter Kelly capped at 1% per single, fixed virtual $1,000 reference bankroll. Report actual hypothetical payout/loss, turnover, ROI, flat-unit ROI, drawdown and weekly-block bootstrap uncertainty. Do not interpret holdout ROI as genuine historical execution.
- For the prospectively locked weekly Ontario trials, compare three-book prices (BetMGM, Betano, BetRivers). An execution quote must be fresh within five minutes with both sides available. The anchor uses no-vig reference odds from the other two books only. Require sufficient matched fixtures before capturing the slate, maximum three singles per strategy, no parlays because the price offered for a combined parlay is not available. The existing paper/parlay trial is unchanged.
- Lock weekly snapshots before kickoff, verify content digest, and preserve original prices, stakes and observations. Settlement reads independently reported final scores; never place actual bets. Separate strategies each use their own virtual bankroll and no real funds.
- Current fixed weight is fitted through 2025 for the 2026 season. Refit on a new completed season before a future season is eligible.
- On the existing three-hour schedule, request a fresh three-book quote only when a locked paper selection is within four hours of kickoff (reuse the slate-capture request if already made). Archive each eligible observation with a digest, timestamp and original trial digest. Use the latest qualifying observation per leg; never backfill after kickoff. Report coverage, lead time, locked decimal / later same-book decimal − 1, and locked decimal × later other-book no-vig probability − 1. These are **near-kickoff proxies**, not true closing odds or proof of profit. Missing quotes remain unavailable, and all original paper selections remain unchanged.
- Favourite/underdog audit: fixed, regularized symmetric market-logit slope and nonnegative V2 probability-disagreement alternatives are fit using earlier seasons only; candidate chosen on 2023–24 and evaluated on 2025–26. Require improvement over raw market in both Brier and log loss on both periods. Report bands by market favourite probability and simulated underdog vs favourite ROI. The historical input prices lack verified quote timestamps. The forward audit scores all pregame-locked V2 and three-book consensus probabilities (not just selected tickets), with ties excluded and no new wagers. No extra odds calls; share final-score requests with the settlement runner. Do not promote a failed challenger.

```sh
node phase10/evaluate-value-research.mjs /path/to/games.csv
node --test phase10/*.test.mjs
node phase10/run-value-paper-trial.mjs --capture
```

The historical replay and the pending prospective trial do not establish profitability. No production promotion until conservative forward validation supports the change.
