# DevTools UI Audit — 2026-08-10

Reference: the user's existing signed-in Chrome session on Sleeper. Extension:
the installed unpacked Not Sleeping v0.8.6 build in the same browser, plus the
controlled production-bundle tests described below. Evidence is in
`artifacts/devtools-ui-audit-2026-08-10/`; sanitized automated captures are
attached to the Playwright report.

## 1. Every Sleeper page inspected

The Big Bucks predraft league page and the NFL draft room were inspected in the
existing signed-in Chrome window. The responsive reference run targeted 320,
375, 390, 768, 1024, 1440, and 1920 px widths. A post-capture pixel-dimension
audit found that the authenticated Chrome window constrained several saved
images, so their filenames are treated as requested targets rather than proof
of exact output width. The exact observed dimensions are recorded in section
22 instead of overstating the reference evidence.

## 2. Every major component inspected

League rail, league header, league tabs, draft card, team list, chat, draft-room
header, team columns, pick cells, player filters, player table, queue, launcher,
extension shell, league selector, navigation, cards, tables, controls, player
rows, badges, alerts, skeletons, dialogs, popup, and options-page source were
inspected.

## 3. Desktop viewport states tested

Reference pages were inspected at desktop target widths and have exact 768 and
1024 px captures plus the 1675 px side-by-side context captures. The larger
responsive files were constrained by the authenticated Chrome window. The
production extension bundle now has exact automated Draft-workspace coverage
at 768, 1024, 1440, and 1920 px, with one screenshot attached per width.

## 4. Mobile viewport states tested

Reference pages were inspected at 320, 375, and 390 px targets; exact output is
available for draft at all three targets and for predraft at 320 and 390 (the
predraft 375 target saved at 320). The production extension bundle now has
exact automated Draft-workspace coverage at 320, 375, and 390 px. Sleeper
forces a wide desktop canvas at mobile widths; Not Sleeping intentionally
reflows to remain usable.

## 5. Typography findings

Sleeper renders Lato for dense body/data text and Poppins for navigation and
display labels. The extension previously used Inter/Segoe UI fallbacks. It now
bundles Fontsource Lato and Poppins under OFL-1.1 and applies them through shared
tokens. Eleven pixels is the minimum label size.

## 6. Spacing findings

Sleeper uses compact 4–16 px internal spacing, 40 px controls/tabs, 44 px player
rows, and 50 px draft cells. Shared spacing and geometry tokens now replace the
main hard-coded control dimensions.

## 7. Color-system findings

The measured hierarchy is `#181c28`, `#212635`, `#293142`, `#2f394a`, and
`#333d50`, with draft-board `#030616` and selected teal `#00ceb8`. The extension
uses this ladder with contrast-adjusted semantic text and position colors.

## 8. Navigation findings

Sleeper uses 40 px selected tabs and dense league navigation. The extension uses
the same height and visual emphasis while preserving five always-reachable
primary destinations at 320 px and routing the rest through More.

## 9. Player-component findings

Player rows must keep identity, team, position, status, and rank/score scannable
before secondary metrics. The shared avatar, badge, row-height, and fallback
components satisfy that hierarchy without guessed headshots. Draft Copilot
player names now wrap instead of using a clipping ellipsis, preserving the full
identity at every required width while leaving the position badge visible.

## 10. Draft-board findings

Measured Sleeper cells are 132 × 50 px with 2 px gutters and a stronger current
pick. Not Sleeping preserves this geometry in board-oriented surfaces while its
side-panel recommendation list reflows for narrow widths.

## 11. Draft-pick findings

Sleeper's current pick uses a yellow fill and dark ink; completed cells are
position-colored and empty cells use `#212635`. Extension on-clock, selected,
completed, owned, and recent-pick states use distinct semantic tokens and
tabular numbers.

## 12. Responsive behavior findings

Sleeper's mobile screenshots are a scaled desktop canvas. Copying that behavior
would make a Chrome side panel unusable, so the extension progressively removes
secondary columns, changes grids to one column, and preserves every core draft
action. This is an intentional functional deviation. The current matrix proves
the exact document width, the absence of unintended horizontal overflow, and
the in-viewport position of primary navigation, draft context, Draft Copilot,
the recommendation board, and the on-clock AI switch at 320, 375, 390, 768,
1024, 1440, and 1920 px. The 390 px run also opens the progressive-disclosure
analysis before capture.

## 13. Interaction-state findings

Hover, active, selected, focus-visible, disabled, paused, on-clock, complete,
undo, redo, reset-confirmation, and league-switching states are represented.
Focus rings use the selected teal and never rely on color alone for identity.

## 14. Loading-state findings

League switching and player-pool loading show explicit destination-specific
states. Skeletons preserve layout. The previous league's completion state is
cleared before new data is requested.

## 15. Error-state findings

Runtime, provider, stale snapshot, saved-mock mismatch, and insufficient-player
pool errors remain local and actionable. Local deterministic features remain
available when optional AI fails.

## 16. Accessibility findings

The extension supplies semantic navigation, headings, tabs, tables, buttons,
accessible names, focus-visible outlines, reduced-motion support, and contrast
adjustments. Sleeper's sampled accessibility tree relies heavily on generic
groups, so semantic parity was not copied where it would reduce usability. The
responsive matrix locates the AI control by its switch role and accessible
`Turn AI on` name, and locates the activity stages as the `On-clock AI
activity` list.

## 17. Components created

The migration established shared font, icon, row, navigation, button, input,
draft-cell, modal, drawer, and bottom-sheet tokens. Canonical primitives now
include Button, IconButton, CompactTabs, SleeperField, SleeperInput,
SleeperSelect, SleeperSearch, SleeperModal, SleeperDrawer,
SleeperBottomSheet, SleeperTooltip, SleeperMenu, PlayerAvatar,
SleeperLeagueAvatar, SleeperTeamAvatar, SleeperPlayerIdentity,
SleeperRosterSlot, SleeperDraftPick, SleeperSection, Badge, MetricCluster,
EmptyState, InlineError, and SkeletonRow.

## 18. Components refactored

App shell navigation/actions, buttons, icon buttons, compact tabs, league and
player search, player result/detail rows, projected starters, draft
recommendations, recent picks, mock-draft controls, evidence sheets, popup
context/action, and options navigation/forms were moved to the measured shared
geometry. Global body/display typography was replaced with the measured font
split. Realtime intelligence now uses progressive disclosure instead of an
always-expanded dashboard card. Draft Copilot uses the same pattern: pick
essentials remain visible, while rationale, opponent modeling, AI controls,
alternatives, multi-pick planning, and score factors are secondary.
The responsive Draft verification was expanded from a single 320 px overflow
check to the complete required-width matrix. It also measures critical player
and AI-status text boxes so clipping regressions fail the browser suite.

## 19. Screens migrated

Shared tokens apply to every side-panel route, popup, and options/onboarding.
Shared structural primitives are directly used by Draft, Mock Draft, Players,
Team, league switching, full-season evidence, and options; the remaining routes
inherit the same canonical surface, type, state, badge, button, and navigation
system. Sanitized packaged captures cover Draft, Today, Team, Players, Trade,
More, Start/Sit, Waivers, Matchup, Chopped, Research, Deadlines, Dynasty,
Rankings, Compare, Watchlist, Rookie, Taxi, IDP, and Mock Draft.

## 20. Remaining visual discrepancies

Sleeper's desktop reference has more horizontal space, a full chat column, and
some legacy Muli text in the draft-room header. The extension uses responsive
side-panel cards, has no chat surface, and standardizes display text on Poppins.
No unresolved Draft-workspace overflow or critical-text clipping was observed
in the seven-width production-bundle matrix.

## 21. Technical reason for every remaining discrepancy

- Horizontal layout differs because a Chrome side panel is 320–600 px, not a
  1675 px application canvas.
- Chat is omitted because Not Sleeping is read-only and has no messaging scope.
- Legacy Muli is not bundled because the measured product-wide body/display
  split is Lato/Poppins and no Sleeper-owned font asset is redistributed.
- Mobile reflow differs because Sleeper's forced desktop shrink makes controls
  unreadable; the extension must preserve operability and accessibility.
- Semantic markup is stronger because copying generic accessibility groups
  would be a regression.

## 22. Screenshot-comparison results where available

`reference/01-sleeper-predraft-1675.png` and
`implementation/02-sleeper-predraft-with-extension.png` capture the same
predraft context. `reference/02-sleeper-draft-room-1675.png` and
`implementation/04-installed-draft-with-sleeper.png` capture the draft context.
The responsive reference filenames record every requested width, but a direct
pixel audit found the following actual output dimensions:

- Draft: 320×241, 375×283, 390×294, 768×900, 1024×900, 1195×900 for the
  1440 target, and 1195×900 for the 1920 target.
- Predraft: 320×230, 320×900 for the 375 target, 390×281, 768×553,
  1024×737, 1250×900 for the 1440 target, and 1440×900 for the 1920 target.

Those constrained files remain useful visual references but are not counted as
exact-width proof. Exact extension evidence now comes from the Playwright test
`renders the Draft workspace across every required audit width`, which attaches
sanitized 320×900, 375×900, 390×900, 768×900, 1024×900, 1440×900, and
1920×900 screenshots and is uploaded with the CI Playwright report. The matrix
also asserts that the on-clock AI switch/activity and recommendation board are
reachable, core regions stay inside the viewport, critical text is not clipped,
and no unintended horizontal overflow exists. The installed route captures
record broader component consistency, and `implementation/24-beers-pool-fixed.png`
shows the corrected Beers BB $50 player pool with an enabled local-mock action.

The 2026-08-11 authenticated verification set was first captured against
v0.8.3 and was subsequently complemented by the installed v0.8.6 Draft
captures and the exact production-bundle responsive matrix. The local
current-run set verifies selected-league binding for Beers BB $50, Big
Bucks, NFL Last Man Standing, and testt; a return from those leagues to Beers
without stale identity, format, or completion state; and both collapsed and
expanded Draft Copilot disclosure states. Those signed-in captures remain
ignored locally because the Chrome window contains private league, chat, and
browser context; they are intentionally not published or committed. Automated
focus/Escape/labeling tests, TypeScript, ESLint, the complete Vitest suite,
production packaging, and the GET-only live all-league audit provide the
complementary nonvisual evidence. Screenshot comparison supports the measured
layout findings but does not by itself establish full WCAG conformance.

Sanitized v0.8.6 captures are published in `docs/screenshots/` and shown in the
README. They record on-clock AI-off and AI-working states, the 320 px layout,
auction and rookie contexts, and the wider Draft workspace without Sleeper chat,
manager names, browser tabs, usernames, account IDs, or provider secrets.
