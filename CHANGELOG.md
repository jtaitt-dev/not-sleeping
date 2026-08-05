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

## [0.4.0] - 2026-08-05

### Fixed

- Sleeper league payloads containing `null` containers no longer fail validation. Sleeper sends an explicit `null` rather than omitting empty maps, lists, and unset flags, and `.default()`/`.optional()` only fire on `undefined`. Because the provider parses strictly, a single null failed `getRosters()` and `getTransactions()`, which failed `GET_LEAGUE_SNAPSHOT` and every workspace built on it.
- Anthropic requests no longer send the removed `budget_tokens` parameter to models that reject it. Model IDs are fetched live, so any current selection fell through to the legacy branch and either returned HTTP 400 or silently dropped thinking.
- A Sleeper account can now be connected from the settings page. `RESOLVE_USER` is the only thing that can populate the user ID gating the league catalog, and nothing in the UI called it, so the catalog stayed empty and every workspace fell back to demo data.
- League sync derives its season list and week from Sleeper's live NFL state instead of a hardcoded week 1 and the calendar year, which is the wrong season during the offseason.
- The options page opens in a tab as configured; the WXT entrypoint previously discarded the setting and opened a popup.
- Decision pipeline job and scope tracking is bounded rather than growing for the lifetime of the service worker.
- Line endings are normalized, so a Windows clone no longer fails formatting checks on every file.

### Added

- League sync requests every season the protocol allows, so the switcher lists all leagues across seasons rather than the last three.

### Changed

- Coverage measures the whole logic layer instead of six hand-picked files.
- The extension version has a single source of truth in `package.json`.

### Removed

- The unused `GET_RECOMMENDATIONS` runtime message, which echoed its own input and had no callers.

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

[Unreleased]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.3.0...v0.4.0
[0.1.0]: https://github.com/jtaitt-dev/not-sleeping/releases/tag/v0.1.0
