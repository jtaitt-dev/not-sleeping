# Model validation

Validation has two distinct layers:

1. Deterministic simulations assert pick order, 3RR, uniqueness, ownership, pools, keepers, auction budgets, finite scores, seeded stability, roster completion, and performance across the compatibility matrix.
2. Leakage-safe walk-forward backtests use a recorded minimal nflverse fixture from 2023–2024. A week W recommendation uses only weeks before W; draft replay uses only prior seasons.

The current small engineering fixture produced 23 start/sit decisions with 52.2% directional accuracy and 4.38 PPR mean regret versus hindsight optimal. Waiver replay produced 14 triggers with 57.1% precision. These are not product accuracy claims: the sample is deliberately tiny, projection/market histories are incomplete, and hindsight optimality is unattainable. Draft validation labels its prior-season-points baseline explicitly because historical ADP is unavailable in the fixture.

Machine-readable results live in `artifacts/simulation-report.json` and `artifacts/backtest-report.json`. The release artifact records 5,000/5,000 completed scenarios, zero invariant failures, 100% seeded recommendation replay stability, and the required overlapping category counts. The checked-in timestamp identifies the exact run; CI regenerates smoke reports and the scheduled workflow regenerates exhaustive evidence.
