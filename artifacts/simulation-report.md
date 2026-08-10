# Phase 2 simulation report

Generated: 2026-08-10T17:32:56.926Z

- Completed: 5,000 / 5,000
- Complete recommendation-engine replays: 5,000
- Invariant failures: 0
- Recommendation rank stability: 100.0%
- Roster completion: 100.0%
- Average recommendation latency: 0.555 ms
- P95 recommendation latency: 0.905 ms

## Required overlapping categories

- dynastyRookie: 250
- dynastyStartup: 250
- auction: 200
- idp: 200
- bestBall: 200
- keeper: 100
- oddTeamCount: 714
- tradedPicks: 282
- choppedRedraft: 63
- choppedFaab: 63
- choppedTrades: 63
- choppedBestBall: 63
- bestBallWaivers: 209
- dynasty32: 72
- largeIdp: 57
- auctionIdp: 50
- auctionDynasty: 50
- keeperAuction: 50
- supplemental: 72
- unknownInputs: 72
- midDraftChanges: 72

## Matrix

- leagueTypes: dynasty, keeper, redraft
- draftStyles: auction, linear, manual_custom, snake, third_round_reversal
- lineupTypes: best_ball, classic
- waiverTypes: custom_daily, disabled, faab, free_agents, reverse_standings, rolling
- teamCounts: 8, 9, 10, 12, 14, 16, 32
- scoringFamilies: custom_bonuses, half_ppr, heavy_passing_penalties, points_per_first_down, ppr, return_yards, standard, te_premium
- playerPools: all_available, rookies_only, veterans_only

## Notes

Availability calibration is labeled proxy-only until historical pre-pick market snapshots are available. Cache hit rate is not instrumented in the isolated engine harness. No accuracy claim is derived from these simulations.
