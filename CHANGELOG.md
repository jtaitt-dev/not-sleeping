# Changelog

All notable changes follow Keep a Changelog conventions. This project uses
semantic versioning.

## [Unreleased]

### Added

- Universal multi-season league switcher with favorite/recent sorting, isolated per-league state, and atomic rapid switching.
- Today, Start & Sit/Best Ball, Matchup, Chopped Survival, Waiver, Trade, Dynasty, Rookie, Taxi, IDP, Auction, Mock Draft Lab, Research, and Deadline workspaces.
- Exact ordered-slot lineup optimizer, arbitrary scoring translation, deterministic weather, evidence provenance, configurable source policy, and opt-in local alerts.
- Full Sleeper matchup, transaction, bracket, traded-pick, league-draft, player, and trending coverage.
- Seeded smoke/exhaustive simulation harness and leakage-safe nflverse walk-forward backtests with generated reports.
- Manual per-league capability overrides, configurable freshness thresholds, source preferences, and persisted workspace/scroll state.

### Security

- Added prompt-injection rejection, source URL classification, cross-league epoch isolation, notification privacy defaults, and bounded uncited-AI effects.

## [0.1.0] - 2026-07-23

### Added

- WXT Chrome MV3 extension with side panel, popup, options, content script, and
  service worker.
- Live draft, player, team, dynasty, trade, watchlist, comparison, ranking,
  data, usage, settings, diagnostic, and project workspaces.
- Read-only Sleeper provider with Zod validation and TTL-aware caching.
- Optional OpenAI Responses API research with dynamic models, strict
  structured output, current web search, citations, rate controls, retries,
  deduplication, cancellation, and `store: false`.
- Session-only and explicitly remembered trusted key storage.
- Deterministic valuation, draft-mode detection, identity matching, rookie
  eligibility, trade evaluation, safe imports, and fifteen demo fixtures.
- Unit, provider, coverage, loaded-extension, axe, responsive, offline, and
  visual regression tests.
- Reproducible release ZIP and SHA-256 packaging.

[Unreleased]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jtaitt-dev/not-sleeping/releases/tag/v0.1.0
