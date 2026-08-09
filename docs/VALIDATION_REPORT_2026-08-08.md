# Not Sleeping v0.6.0 — Final Validation Report

Local validation date: 2026-08-08. Runtime: Node 24.14.0 on Windows x64.
The live Sleeper work was read-only and used the connected account
`lumbarlord`. The release artifact is
[`artifacts/not-sleeping-0.6.0.zip`](../artifacts/not-sleeping-0.6.0.zip).

## 1. Architecture summary

Not Sleeping is one Chrome Manifest V3 extension. A content script detects
supported Sleeper routes, a background service worker owns network, storage,
key, league, and live-draft boundaries, and a React side panel renders all
workspaces. Deterministic local engines own legality and baseline decisions;
optional AI providers may add only schema-bounded overlays.

## 2. Redesign

The product now uses one flat, Sleeper-compatible dark interface with compact
navigation, native-looking cards, consistent status badges, reduced decorative
effects, responsive 320px behavior, and one unified More menu. Draft completion
removes the entry pane and leaves validation plus the full pick history visible.

## 3. Components added or materially revised

The work added the league-derived manual mock workspace, injective mock storage,
central position eligibility, future-feasible draft recommendations, safe
external links, a real usage ledger, per-tab live-draft control, read-only
Sleeper enforcement, account-scoped league storage, and source-aware research.
The popup, options, side panel, workspace navigation, draft cards, player pool,
and security states were revised to use the same product language and tokens.

## 4. Issues found

Testing found infeasible late-round IDP rosters, cross-tab live context, account-
ambiguous catalog/workspace keys, stale league-selection commits, lossy mock
keys, unbounded external responses, missing response identity binding, research
preference bypasses, fail-open manual-player selection, secret-bearing citation
URLs, excessive manifest permissions, static usage samples, and two hardened-
behavior E2E fixtures that still expected the former global context.

## 5. Exact resolutions

The draft engine now uses partial bipartite slot matching before recommending a
pick. State is keyed by exact tab/account/league/season/draft identities.
Sleeper responses are byte-, shape-, collection-, and identity-bounded. Research
sources and player pools fail closed. AI hosts are optional permissions. URLs
are sanitized and confirmed. The E2E fixtures now address the real tab-scoped
storage key and assert that manual research stays locked without a legal pool.

## 6. Dead or duplicate code removed

The separate Core/Labs build flavor, virtual flavor module, duplicate build
scripts, Labs stubs, old parlay workspace, obsolete Labs E2E, and old risk docs
were removed. One product, manifest, build directory, archive, and gated
Advanced Research implementation remain.

## 7. Security

The sealed app-backed standard scan reports zero surviving findings across
eight reviewed surfaces after 12 candidates were remediated and centrally
validated. The report is
[`artifacts/security-scan-2026-08-08/report.md`](../artifacts/security-scan-2026-08-08/report.md).
The production dependency audit reports no known vulnerabilities, and the
packaged manifest contains neither `activeTab` nor `tabs`.

## 8. Performance

The standard lineup solver measured 2.233 ms median and 3.013 ms p95. The large
IDP solver measured 8.338 ms median and 9.877 ms p95. Both are far below their
100/150 ms and 300/450 ms median/p95 budgets. Across 5,000 simulations, average
recommendation latency was 0.693 ms, p95 1.092 ms, and maximum 3.754 ms.

## 9. Accessibility

The loaded extension has no serious or critical automated Axe violations in
the tested primary workspace. Keyboard-accessible controls, labels, status
roles, visible focus behavior, reduced-motion support, theme contrast, and the
320px minimum-width no-overflow assertion are included. The dedicated browser
checks passed.

## 10. Live connected leagues

| League                                       | Teams | Rounds | Picks validated | Pool          | Result    |
| -------------------------------------------- | ----: | -----: | --------------: | ------------- | --------- |
| testt                                        |     8 |     15 |             120 | All available | All legal |
| Winter is Coming II (Reloaded): IDP Bestball |    12 |     27 |             324 | All available | All legal |
| NFL Last Man Standing                        |    18 |     40 |             720 | All available | All legal |
| Big Bucks                                    |    16 |      3 |              48 | Rookies only  | All legal |

## 11. Formats validated

The deterministic matrix covers 8, 9, 10, 12, 14, 16, and 32 teams; classic
and best ball; standard, half-PPR, PPR, TE premium, points-per-first-down,
return-yard, heavy-passing-penalty, and custom-bonus scoring; Superflex, 2QB,
offense, IDP, and mixed rosters; and six waiver families.

## 12. Draft types validated

Snake, linear, third-round reversal, auction, and manual/custom drafts are in
the exhaustive matrix. Live connected-league validation covered snake and
linear drafts, while focused fixtures cover auctions, supplemental cases,
unknown settings, manual commissioner picks, and mid-draft changes.

## 13. IDP validation

Granular DE, DT, EDGE, LB, ILB, OLB, CB, S, FS, and SS identities are retained
while Sleeper DL/LB/DB eligibility is honored. Large IDP, IDP-only, auction IDP,
and mixed offense/IDP scenarios passed. The 12-team, 27-round live IDP best-ball
mock completed all 324 picks legally.

## 14. Rookie, startup, redraft, and keeper validation

Rookie-only dynasty drafts, dynasty startups, redrafts, keeper costs, missing
keeper costs, keeper auctions, and veterans-only or all-available pools are
covered. Big Bucks supplied the live 16-team, three-round rookie-only proof.

## 15. Draft-order method

Big Bucks used its verified Sleeper draft order. The other connected leagues do
not expose a complete local-user slot in the current public predraft data, so
the local mock correctly requires a local slot before entry rather than
inventing ownership. Snake reversal, linear order, 3RR, custom, and auction
orders are deterministic and separately tested.

## 16. Traded picks

Big Bucks contained eight currently resolved traded-pick ownership records.
Every affected pick used its current owner in the 48-pick live audit. The engine
also validates duplicate, out-of-range, and custom ownership inputs and retains
original-versus-current ownership for display.

## 17. AI-disabled mock draft

The live four-league audit ran with local deterministic recommendations only.
All 1,212 picks completed with zero invariant failures, legal player IDs,
correct availability, roster feasibility, and isolated local persistence.

## 18. AI-enabled mock draft

The AI-enabled decision path was exercised with provider-neutral structured
provider doubles, invalid-player injection, consensus disagreement, unavailable
model fallback, token usage, and stale-state handling. The 10/10 AI eval suite
passed. No real provider key was read, printed, or copied, and no billable live
AI call was required for this release validation; live draft legality always
remains owned by the deterministic engine.

## 19. Dynasty rookie mock

The 16-team Big Bucks draft used the verified rookies-only pool for 48 legal
manual picks. The exhaustive matrix adds 250 dynasty rookie scenarios and
supplemental rookie/player-pool edge cases.

## 20. IDP mock

Winter is Coming II (Reloaded): IDP Bestball completed 324 manually entered
local picks. Large-roster feasibility was checked after every entry, preventing
the late-round composition failure found during the first live audit.

## 21. Mixed offense and IDP mock

Mixed eligibility, IDP flex, Superflex, ordinary flex, multi-position players,
unknown slots, exclusions, and locked starters are tested through the same
central matcher. Exhaustive mixed and large-IDP scenarios completed without an
illegal roster.

## 22. Luna before the first AI request

New settings resolve OpenAI `gpt-5.6-luna` as the routine-analysis default
before a provider request is created. Tests assert the requested model value,
not merely the displayed label.

## 23. Valid model preference preserved

When the selected provider still reports the stored model as available, that
exact provider/model choice is retained. Dynamic capability lookup determines
which effort, web-search, structured-output, and thinking controls are shown.

## 24. Invalid model fallback to Luna

If a stored model is removed or unavailable, model resolution checks the live
capability list before sending the request and falls back to OpenAI Luna. The
overlay discloses the fallback; if Luna is also unavailable, local analysis
continues and the AI layer reports a safe error.

## 25. Commands run

`pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test:coverage`, the gated live Sleeper audit,
`pnpm test:performance:ci`, `pnpm test:simulations:exhaustive`,
`pnpm test:backtest`, `pnpm test:ai-evals`, `pnpm build`,
`pnpm assert:unified-bundle`, `pnpm test:e2e`, `pnpm test:visual`,
`pnpm audit:prod`, and `pnpm zip` were executed.

## 26. Dependency installation

`pnpm install --frozen-lockfile` completed with the locked dependency graph and
WXT preparation. The project declares Node `>=22 <25` and pnpm `>=11 <12`; all
final validation used Node 24.14.0.

## 27. Lint

Strict ESLint completed with zero errors and zero warnings.

## 28. Type checking

`tsc --noEmit` completed successfully under the strict project configuration.

## 29. Unit tests

Forty test files passed and one live-gated file was skipped in the ordinary
coverage run. The aggregate was 329 passed and 2 skipped out of 331 tests.
Coverage was 77.97% statements, 66.49% branches, 79.19% functions, and 80.31%
lines.

## 30. Integration tests

Provider parsing, null Sleeper shapes, read-only boundaries, runtime protocols,
five-league race isolation, tab-scoped broadcasts, account keys, import safety,
model selection, usage behavior, mock recovery, and the real public Sleeper
account audit all passed.

## 31. End-to-end tests

All 12 loaded-MV3 Chromium tests passed: navigation, every standard route,
More grouping, settings, provider-neutral configuration, draft interactions, a
full 48-pick manual mock, offline behavior, accessibility, 320px layout,
Advanced Research gates, and live Sleeper route/error propagation. Both visual
baselines passed.

## 32. Production build

The WXT/Vite production build completed in one unified `dist` directory with 28
files and a total reported size of 1.28 MB. It contains no source maps or
obsolete flavor tokens.

## 33. Browser-extension package

The release ZIP is 400,017 bytes with 32 entries, one root `manifest.json`, no
source maps, and no `core/` or `labs/` paths. SHA-256:
`BE0A62E1E340609F4779BDF0442AD5C682E32D69E04CCE72BD6B3F7E13905962`.

## 34. Manual browser validation

Chrome control reused the already-open, signed-in Sleeper tab at
`https://sleeper.com/leagues/1316601957959340032/predraft` and confirmed the
Sleeper page remained available. No additional visible Chrome browser, profile,
or window was launched. Native Chrome side-panel UI is not exposed through the
browser-control surface, so loaded-extension headless tests supplied direct
side-panel evidence.

## 35. Known limitations

The native side panel cannot be directly inspected through this Chrome-control
surface. Predictive fantasy accuracy is not proven by legality tests. The
historical backtest fixture is intentionally small and lacks historical ADP.
Chrome controls DNS and redirects after confirmed external navigation. Chrome
also has no per-page storage ACL inside one trusted extension origin. The
manual-odds package still requires policy/legal review before store submission.

## 36. Reason for each limitation

The first is an automation-platform boundary; headless MV3 tests compensate.
The second requires future out-of-sample seasons, not code invariants. The third
comes from recorded fixture availability and is labeled in the report. The
fourth and fifth are Chrome platform behaviors mitigated by URL validation,
confirmation, CSP, trusted contexts, and session-only keys. The last is a
distribution-policy decision, not a technical bypass.

## 37. Placeholder and TODO audit

The source audit found no `TODO`, `FIXME`, “coming soon,” or “not implemented”
markers in shipped logic. HTML `placeholder` attributes are intentional form
prompts, not incomplete implementations. No demo value is substituted for a
failed live request.

## 38. No real picks made

No request to make, submit, queue, or confirm a real Sleeper draft pick exists.
All entered picks were kept in isolated local mock state.

## 39. No rosters modified

No real roster add, drop, starter, bench, reserve, taxi, or injured-reserve
state was changed.

## 40. No transactions performed

No transaction was created, accepted, canceled, or modified. Transaction data
was read only when needed for availability analysis.

## 41. No waiver actions performed

No waiver claim or free-agent move was submitted. Waiver and FAAB outputs are
recommendations only.

## 42. No trades performed

No trade was proposed, accepted, rejected, or canceled. Trade analysis remains
local decision support.

## 43. No league settings modified

No Sleeper scoring, roster, draft, waiver, keeper, taxi, commissioner, or league
setting was written. Manual overrides are local extension preferences only.

## 44. Mock isolation

Mock records use injective account/league/draft/fingerprint keys, validate exact
identity on restore, and never call a Sleeper write endpoint. Account catalogs,
active selections, workspaces, and live contexts are separately scoped and
stale requests cannot commit over a newer selection.

## 45. Factual-data verification

League names, team counts, rounds, draft styles, rookie-pool status, draft
order, and traded-pick ownership in the live report came from current Sleeper
public API responses and were schema- and identity-validated. The extension
labels projections, heuristics, confidence, backtest proxies, and AI overlays as
analysis rather than fact. Missing or contradictory inputs fail closed instead
of being invented.
