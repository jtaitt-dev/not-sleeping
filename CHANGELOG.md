# Changelog

All notable changes follow Keep a Changelog conventions. This project uses
semantic versioning.

## [Unreleased]

## [0.7.0] - 2026-08-08

### Added

- One unified Not Sleeping build and release artifact with Advanced Research
  included behind a disabled-by-default acknowledgement and enablement gate.
- A second 21+ and jurisdiction gate, direct-route enforcement, cooldown,
  disable control, and persistent informational-use warning for Manual Odds
  Research.
- Unified-build and browser assertions covering one manifest, one artifact,
  default feature absence, direct-route locking, both opt-in layers, and no
  stake or operator-link controls.
- Universal multi-season league switcher with favorite/recent sorting, isolated per-league state, and atomic rapid switching.
- Today, Start & Sit/Best Ball, Matchup, Chopped Survival, Waiver, Trade, Dynasty, Rookie, Taxi, IDP, Auction, Mock Draft Lab, Research, and Deadline workspaces.
- Exact ordered-slot lineup optimizer, arbitrary scoring translation, deterministic weather, evidence provenance, configurable source policy, and opt-in local alerts.
- Full Sleeper matchup, transaction, bracket, traded-pick, league-draft, player, and trending coverage.
- Seeded smoke/exhaustive simulation harness and leakage-safe nflverse walk-forward backtests with generated reports.
- Manual per-league capability overrides, configurable freshness thresholds, source preferences, and persisted workspace/scroll state.

### Changed

- Refreshed the README and release media from the packaged v0.7.0 extension,
  including the current Luna, league mock, waiver, trade, rookie, and settings
  surfaces.

### Fixed

- Isolated the full-season trade builder from a legacy CSS class collision so
  both asset columns remain equal and player names no longer overlap.
- Gave rookie-board identity, opportunity, and strategy columns explicit
  responsive tracks so prospect details stay readable at side-panel widths.

### Security

- Classified the unified manual-odds artifact as limited-beta/sideload only;
  Chrome Web Store submission requires fresh policy and legal approval because
  packaged code remains reviewable even when runtime-gated.
- Added prompt-injection rejection, source URL classification, cross-league epoch isolation, notification privacy defaults, and bounded uncited-AI effects.

## [0.6.0] - 2026-08-05

### Changed

- A waiver row states one bid instead of six numbers. The spread becomes the track underneath it: the band runs conservative to aggressive with a tick at the expected winning bid, and roster fit and priority move into the footer sentence so exactly one figure in the row is bold.
- The evidence drawer is a bottom sheet split into what a source reported and what the model worked out. The two used to be interleaved with the distinction printed as a lowercase word beside the source chip, so a projection read exactly like a confirmed report.
- Settings has twelve sections, each naming one subject. Seven broad tabs were why "Advanced" had collected the cache controls, the diagnostic log level and the launcher position — none of them belonged there, they just had nowhere else to go.

### Fixed

- Screens reached through More no longer open with the back header stretched across empty space and the screen itself collapsed below it. The shell sized its rows by position, so adding the header shifted every row down one and handed the flexible row to the header rather than to the workspace. All 21 More-level destinations were affected.
- The league switcher opens fully inside the panel. It hung a 370px popover off a trigger sitting in the header's middle column, so at the panel's real width it ran past the left edge and clipped the search field and the Sync control.
- "Clear cache" clears the cache. The control was rendered without a handler and silently did nothing, although the service worker had implemented and handled `CLEAR_CACHE` all along.
- The visual baseline follows the settings nav rename instead of failing on CI while the rest of the browser suite passed, and no longer compares against a screenshot two versions stale — a whole settings restructure had stayed inside the diff tolerance unnoticed.

### Added

- A redacted diagnostics export on the settings page, wired to the `EXPORT_DIAGNOSTICS` message that previously had only one caller in the side panel.
- Tests covering the pieces that carry meaning on their own: the four FAAB bids never inverting across a 72-case sweep, the range bar's band and tick geometry including the degenerate all-equal case, every `EvidenceNature` landing on a deliberate side of the fact/estimate split, and a walk through all twelve settings sections.

## [0.5.0] - 2026-08-05

### Changed

- Adopted the Sleeper surface ladder. Depth now comes from stepped lightness rather than near-black fills plus white hairlines, which was the main reason the panel read as a different product.
- Raised every label to an 11px floor. 154 declarations sat below it — 12 at 7px, 54 at 8px, 53 at 9px and 35 at 10px — against only 16 at 11px.
- Replaced seven underline tabs with six filled pills (Today / Draft / Team / Players / Trade / More), dropping to five at 320px.
- Grouped More into five sections with search and per-entry descriptions, replacing one flat list of 21 destinations.
- Draft recommendations state Local, Research and Contextual separately instead of a single blended score.
- Tightened coverage thresholds to one point under the measured baseline.

### Added

- A collapsible "How this score was built" table listing every factor with its own note, so a recommendation can be audited rather than taken on trust. The research row is tinted and never rendered without the local figure beside it.
- Per-factor contributions on deterministic decisions, with a test pinning the parts to the whole.
- A back header on every screen reached through More, which keeps More lit in the nav, so no destination can strand you.
- An explicit risk callout before a key can be remembered on the device.

### Fixed

- Starter slots respect position eligibility. The list zipped a score-ordered roster against the slot array by index, so the top-scoring player was labelled QB whatever they played and a quarterback could land in a running-back slot.
- Start & Sit collapses unfilled slots into one collective state instead of repeating an identical empty row until it fills the panel.
- Trade rows use fixed outer tracks, so the player name no longer wraps under its own meta line.
- Position chips draw a lightened ink on a tint of their fill rather than the fill colour itself, which measured 2.68:1 across 310 nodes.

## [0.4.1] - 2026-08-05

### Fixed

- The Sleeper account connect control is now in the side panel's Settings workspace, where people look for it. It previously existed only on the extension options page in a separate tab, while the league empty state told users to "connect a Sleeper username in Settings" — the panel workspace that had no such control.

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

[Unreleased]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.3.0...v0.4.0
[0.1.0]: https://github.com/jtaitt-dev/not-sleeping/releases/tag/v0.1.0
