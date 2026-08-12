# Changelog

All notable changes follow Keep a Changelog conventions. This project uses
semantic versioning.

## [Unreleased]

## [0.8.11] - 2026-08-12

### Added

- The Leagues workspace now renders selected-league teams, canonical draft
  positions, standings, current-week public activity, and settings alongside
  the account league selector.
- A pure league-overview projector and connected-store tests verify draft
  selection, standings decimals and order, format-aware waiver labels, safe
  avatar URLs, semantic sections, and stale-snapshot rejection.
- A production-extension browser matrix verifies the selected League overview
  at 320, 375, 390, 768, 1024, 1440, and 1920 px, attaching sanitized captures
  and asserting measured geometry, typography, semantics, and containment.

### Changed

- League panels now use authenticated Sleeper dimensions: a centered 750 px
  desktop column, 92 px team rows, 60 px standings, 116+ px activity rows,
  72 px setting rows, 32/16 px team avatars, and 18/14/10/12 px type roles.
- League settings, team labels, records, decimal points, waiver values, and
  activity identities are derived from the selected snapshot rather than
  placeholder examples or internal IDs.
- League snapshot hydration includes add/drop player identities as well as
  current roster players so recent transaction rows remain intelligible.

### Fixed

- Switching leagues cannot render the previous league's overview while the
  destination snapshot is loading.
- FAAB leagues show remaining budget while rolling waivers show priority; a
  non-FAAB league is no longer mislabeled with a dollar balance.
- When multiple drafts exist, the league's canonical `draft_id` supplies draft
  positions instead of the first unrelated draft returned by the API.

## [0.8.10] - 2026-08-11

### Added

- A deterministic roster-section builder preserves the selected Sleeper
  league's starter order and separates bench, taxi, and reserve players without
  duplicate identities. Best Ball uses one ordered roster section.
- Connected-store regression coverage proves that Team renders the selected
  league roster rather than draft recommendation candidates.
- A Team-workspace browser matrix now verifies measured roster geometry,
  typography, list semantics, and viewport containment at 320, 375, 390, 768,
  1024, 1440, and 1920 px, with a sanitized 320 px capture.

### Changed

- `SleeperRosterSlot` now uses authenticated Sleeper Team density: 64 px rows,
  42×32 position tiles, 32 px resilient headshots, 14 px names, 11 px metadata,
  and 12 px trailing values.
- Team insights and the format badge are derived from the selected roster and
  league instead of placeholder scores, needs, depth, and team format.

### Fixed

- Team no longer presents ranked draft candidates as a connected league's
  current roster. The recommendation projection is retained only as an
  explicitly labeled demo fallback.
- Missing or repeated IDs cannot leak players between starter, bench, taxi, and
  reserve sections; unresolved profiles remain explicit instead of appearing
  as open roster spots.
- Configured empty bench, taxi, and reserve positions remain visible instead of
  disappearing from an underfilled roster.

## [0.8.9] - 2026-08-11

### Added

- A Players-workspace browser matrix now checks 320, 375, 390, 768, 1024,
  1440, and 1920 px for measured row/control typography and geometry,
  selected-state semantics, focus visibility, and unintended overflow.
- Canonical player images now render over an immediate initials fallback so
  slow or failed image requests never produce blank player identities.

### Changed

- The Players workspace now uses authenticated Sleeper table density: 52 px
  zebra rows, 32 px search/filter controls and avatars, 12 px player names,
  and 9 px team/position metadata.
- Player-result rows expose their selected state with `aria-pressed` and no
  longer display internal Sleeper IDs as identity metadata.

### Fixed

- Searching or filtering now clears a missing player or selects the first
  visible result instead of leaving stale details from a filtered-out player.

## [0.8.8] - 2026-08-11

### Added

- The seven-width Draft browser matrix now proves that every recommendation
  retains a visible position and that narrow player names are not clipped. A
  dedicated 320 px row capture records the rendered identity hierarchy.

### Fixed

- Recommendation metadata now includes the player's position, and remains
  visible at 320 px when the standalone badge collapses.
- Long recommendation player names wrap at 400 px and below instead of
  ellipsizing the identity to fit the compact row.

## [0.8.7] - 2026-08-11

### Added

- The seven-width Draft browser matrix now asserts computed font sizes for
  recommendation identities, metadata, filters, headings, and on-clock AI
  activity, with reviewed Windows and Linux visual baselines.

### Changed

- Shared typography tokens now distinguish 9 px Predraft microcopy, 10 px
  dense Draft metadata, 11 px labels, 12 px panel rows, and 14 px player names
  according to authenticated Sleeper measurements.

### Fixed

- Removed 8 px text from the Draft workspace and raised recommendation player
  names and secondary Draft/AI context to the measured Sleeper hierarchy.

## [0.8.6] - 2026-08-11

### Added

- Browser coverage now renders the production Draft workspace at 320, 375,
  390, 768, 1024, 1440, and 1920 px, attaches a sanitized screenshot at every
  width, and verifies the on-clock AI controls, core regions, critical text,
  and horizontal-overflow boundary.

### Changed

- The DevTools UI audit now records the actual pixel dimensions of constrained
  authenticated Sleeper captures instead of treating requested filenames as
  exact-width evidence.

### Fixed

- Draft Copilot player names wrap instead of clipping or ellipsizing, and the
  on-clock AI activity sentence wraps below 480 px so the player identity and
  complete AI status remain readable at compact side-panel widths.

## [0.8.5] - 2026-08-11

### Added

- An on-clock Draft Copilot activity strip exposes board readiness, player
  context, Luna progress, current plain-language work, and a direct accessible
  AI on/off switch without leaving the Draft screen.
- Browser coverage verifies canonical player-photo URLs, on-clock AI state,
  the one-click off path, and the no-pick-submission boundary.

### Changed

- Release screenshots now isolate demo draft state from connected-league
  hydration and include sanitized AI-off, AI-working, and 320px on-clock views.

### Fixed

- Corrected the verified Sleeper IDs for all bundled active players, including
  current team metadata for Kenneth Walker, and made full/thumbnail headshots
  fall back to each other before initials.
- Player normalization now rejects an index record whose embedded Sleeper ID
  disagrees with its authoritative key, and arbitrary internal numeric IDs can
  no longer be treated as photo IDs.

## [0.8.4] - 2026-08-11

### Fixed

- Kept each Draft Copilot glance note inside its associated definition value,
  restoring valid definition-list semantics and clearing the serious axe
  accessibility violation in the browser test suite.

## [0.8.3] - 2026-08-11

### Added

- Shared Sleeper-compatible form, avatar, player-identity, roster-slot,
  section, draft-pick, modal, drawer, bottom-sheet, tooltip, and menu
  primitives, with component tests for labeling, progressive disclosure,
  focus, and Escape behavior.

### Changed

- Draft recommendations, recent picks, league search, player search, player
  details, projected starters, mock-draft controls, options fields, and
  evidence surfaces now compose the shared component system.
- Realtime intelligence is collapsed by default so the local recommendation,
  confidence, and state remain scannable without turning the draft surface into
  a separate AI dashboard.
- Draft Copilot now keeps recommendation, confidence, availability, position
  need, tier risk, and next-owned-pick context visible while multi-pick plans,
  rationale, opponent modeling, AI controls, alternatives, risk, and score
  factors expand only when requested.

### Fixed

- Restored compatibility aliases for legacy draft typography and tertiary text
  tokens so migrated and older route styles resolve to the same measured
  design system.
- Empty-state heading references are unique when multiple states render on the
  same screen, and skeleton rows expose an explicit loading status.
- Non-draft Sleeper routes now reconcile the selected league's authoritative
  board after hydration instead of leaving an unrelated demo league or format
  visible beside the real league header.

### Security

- The post-change authenticated audit completed all 1,224 configured picks in
  testt, Beers BB $50, NFL Last Man Standing, and Big Bucks with exact
  eligibility, ownership, pool, order, and duplicate validation after every
  selection. Sleeper access remained GET-only.

## [0.8.2] - 2026-08-10

### Added

- Bundled OFL-licensed Lato and Poppins font packages and shared geometry tokens
  for navigation, buttons, inputs, player rows, draft cells, icons, modals,
  drawers, and bottom sheets.
- A measured Sleeper DevTools UI audit, component inventory, workflow map, and
  all-league legality validation evidence.

### Changed

- Player-pool queries now apply selected-league roster eligibility,
  rookie/veteran mode, IDP mode, and unavailable-player exclusions before the
  result limit.
- Live draft loading can retrieve the complete eligible pool for large Best
  Ball and Chopped formats, and rankings use the selected league's live
  recommendations.
- Shared shell, tabs, controls, player rows, popup, and options surfaces now use
  the measured Sleeper type and geometry system.

### Fixed

- Prevented 12-team, 28-round Beers BB $50 mocks from reporting an insufficient
  pool after a valid 336-player requirement.
- Excluded already-rostered players from dynasty, rookie, and supplemental live
  draft candidate pools without removing the user's roster from need analysis.
- Removed duplicate Best Ball context labeling and clarified the disabled
  waiver subtitle.

### Security

- Sleeper requests remain centralized and GET-only. The authenticated audit
  completed 1,224 local draft-engine picks across all four current leagues with
  zero illegal or duplicate picks and no external writes.

## [0.8.1] - 2026-08-10

### Changed

- The selected league now scopes the Draft workspace and resolves its verified
  current-season board, while an open Sleeper live/mock draft takes priority
  only when its source league matches that selection.
- The Windows Chrome reload helper falls back to an exact accessibility-bound
  click when current Chrome omits `InvokePattern` from its Reload control.

### Fixed

- Cleared a previous league's live state as soon as switching begins and
  rejected stale draft refreshes, errors, and in-flight responses after the
  league or route identity changes.
- Removed the demo-fixture fallback from live loading, unavailable, and
  no-board states so Big Bucks picks or completion status cannot appear under
  Beers BB $50 or any other league.
- Rechecked the active Sleeper tab before falling back to the league's scheduled
  board, preserving the exact matching open mock after switching away and back.

### Security

- Cross-league draft identity is validated before state is committed. Sleeper
  access remains GET-only; the all-league audit simulated 1,224 legal picks
  locally without submitting a pick or changing a roster.

## [0.8.0] - 2026-08-10

### Added

- Premium Draft Copilot hierarchy with one dominant recommendation, compact
  legal board, recent picks, What-If, safe/upside alternatives, roster and
  board impact, and consecutive-pick optimization.
- Multi-signal real-league, league-mock, and standalone-mock detection with
  source-league separation, confidence evidence, and draft-scoped overrides.
- Central player-headshot resolution with verified Sleeper IDs, eager top-pick
  loading, lazy rows, preloading, 404 memoization, and defense/position/initial
  fallbacks.
- Auction budgets and bid ceilings, rookie-only filtering, live source-roster
  needs, completed-draft transition, seeded next-pick ranges, AI preparation
  milestones, and Draft Copilot latency/readiness instrumentation.
- Sanitized Big Bucks 16-team, three-round regression coverage and packaged
  screenshots for waiting, on-clock, AI off/working/ready, rookie, auction,
  320px, and 600px states.

### Changed

- Local calibrated recommendations now remain immediately authoritative while
  optional AI analysis runs automatically near the user's pick with compact
  provider, model, effort, progress, and ready/fallback state.
- Draft display scores retain meaningful separation; availability now uses
  draft order, owned/traded picks, turns, tiers, ADP, opponent needs, format,
  and seeded uncertainty ranges instead of repeated fallback percentages.
- League-derived mocks merge source-league traded picks when Sleeper's mock
  draft endpoint omits them, and roster needs include the user's real league
  roster without double-counting live draft selections.

### Fixed

- Normalized realtime candidate scarcity and risk at the producer boundary so
  score-scale values cannot violate the runtime `0..1` contract.
- Replaced duplicate Draft recommendation cards, manual AI-overlay actions,
  ambiguous AI state, oversized raw runtime/provider errors, player initials
  where verified images exist, broad score saturation, and stale AI results.
- Rookie recommendations now reject veterans; injured/IR players receive
  explicit high-risk treatment; mock ownership follows season-filtered source
  trades even when the active draft reports none.
- Release packaging now normalizes ZIP header and extra-field timestamps so
  identical extension contents produce an identical archive checksum.

### Security

- Sleeper integration remains read-only behind the centralized GET-only
  boundary. The extension never submits picks, bids, nominations, queues,
  trades, chats, slot claims, auto-pick changes, or settings mutations.
- Draft errors expose only safe diagnostic metadata, while provider keys remain
  restricted to trusted extension contexts and are excluded from runtime
  messages, logs, UI, and diagnostic exports.

## [0.7.1] - 2026-08-08

### Added

- Automatic signed-in Sleeper profile detection, stable user-ID resolution,
  and multi-season league synchronization from supported Sleeper pages.
- Tab-scoped account-detection notifications so an already-open side panel
  refreshes its league catalog without a manual reconnect.

### Changed

- Account setup guidance now explains automatic detection while retaining the
  public-username form as a manual fallback.
- The Windows Chrome reload helper locates Reload within the named extension's
  flattened accessibility card instead of selecting the first unpacked card.

### Fixed

- Split the account-scoped IndexedDB key migration into delete and recreate
  versions because IndexedDB cannot change a primary key in place.
- Ignore stale side-panel ports after an extension reload so they cannot fail a
  successful account sync.

### Security

- Detection accepts only a bounded visible username from Sleeper's signed-in
  navigation profile through the allowlisted, versioned content-script message;
  no Sleeper credential, cookie, session value, or generic page name is read.

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

[Unreleased]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.11...HEAD
[0.8.11]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.10...v0.8.11
[0.8.10]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.9...v0.8.10
[0.8.9]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.8...v0.8.9
[0.8.8]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.7...v0.8.8
[0.8.7]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.6...v0.8.7
[0.8.6]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.5...v0.8.6
[0.8.5]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.4...v0.8.5
[0.8.4]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.3...v0.8.4
[0.8.3]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/jtaitt-dev/not-sleeping/compare/v0.3.0...v0.4.0
[0.1.0]: https://github.com/jtaitt-dev/not-sleeping/releases/tag/v0.1.0
