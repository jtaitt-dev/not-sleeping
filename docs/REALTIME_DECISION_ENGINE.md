# Realtime decision engine

Every supported workspace uses the same lifecycle: local baseline, optional AI
overlay, state validation, then presentation. Draft, Start/Sit, Matchup,
Waiver/FAAB, Trades, Dynasty, Keeper, Rookie, Taxi, IDP, Auction, Best Ball,
Chopped, and Research all use feature-scoped routing.

The local engine rejects a candidate when `available` is false, `eligible` is
false, or `alreadySelected` is true. Scores are clamped to 0–100 and confidence
to 0–1. Draft decisions also run deterministic next-pick survival simulations.
The state hash excludes timestamps, so identical state is reproducible.

AI adjustments are schema-limited to ±8 score points and ±0.15 confidence. An
AI-selected ID must exist in the valid local ranking. In consensus mode, both
providers run independently. Agreement is shown; disagreement retains the
deterministic recommendation. A single-provider outage degrades gracefully.

Each new decision for the same feature and subject supersedes older state.
Responses whose hash no longer matches are marked stale. Provider errors never
remove the local decision.
