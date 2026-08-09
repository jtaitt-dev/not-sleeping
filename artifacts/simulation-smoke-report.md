# Phase 2 simulation report

Generated: 2026-08-09T01:04:19.589Z

- Completed: 80 / 80
- Complete recommendation-engine replays: 80
- Invariant failures: 0
- Recommendation rank stability: 100.0%
- Roster completion: 100.0%
- Average recommendation latency: 0.900 ms
- P95 recommendation latency: 1.379 ms

## Required overlapping categories

- dynastyRookie: 8
- dynastyStartup: 8
- auction: 8
- idp: 9
- bestBall: 10
- keeper: 5
- oddTeamCount: 11
- tradedPicks: 4
- choppedRedraft: 1
- choppedFaab: 1
- choppedTrades: 1
- choppedBestBall: 1
- bestBallWaivers: 10
- dynasty32: 2
- largeIdp: 3
- auctionIdp: 2
- auctionDynasty: 0
- keeperAuction: 0
- supplemental: 1
- unknownInputs: 1
- midDraftChanges: 1

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
