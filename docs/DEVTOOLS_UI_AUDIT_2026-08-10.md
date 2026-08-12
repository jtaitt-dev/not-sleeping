# DevTools UI Audit — 2026-08-10

Reference: the user's existing signed-in Chrome session on Sleeper. Extension:
the installed unpacked Not Sleeping v0.8.10 build in the same browser, plus the
controlled production-bundle tests described below. Evidence is in
`artifacts/devtools-ui-audit-2026-08-10/`; sanitized automated captures are
attached to the Playwright report.

## 1. Every Sleeper page inspected

The Big Bucks predraft league page, its authenticated Players and Team pages,
and the NFL draft room were inspected in the existing signed-in Chrome window.
The responsive reference run targeted 320,
375, 390, 768, 1024, 1440, and 1920 px widths. A post-capture pixel-dimension
audit found that the authenticated Chrome window constrained several saved
images, so their filenames are treated as requested targets rather than proof
of exact output width. The exact observed dimensions are recorded in section
22 instead of overstating the reference evidence.

## 2. Every major component inspected

League rail, league header, league tabs, draft card, 64 px roster rows, starter,
bench, taxi and reserve sections, slot tiles, team list, chat, draft-room
header, team columns, pick cells, player filters, 52 px statistical player
rows, player search, queue, launcher,
extension shell, league selector, navigation, cards, tables, controls, player
rows, badges, alerts, skeletons, dialogs, popup, and options-page source were
inspected.

## 3. Desktop viewport states tested

Reference pages were inspected at desktop target widths and have exact 768 and
1024 px captures plus the 1675 px side-by-side context captures. The larger
responsive files were constrained by the authenticated Chrome window. The
production extension bundle now has exact automated Draft-, Players-, and
Team-workspace coverage at 768, 1024, 1440, and 1920 px, with sanitized
screenshots attached.

## 4. Mobile viewport states tested

Reference pages were inspected at 320, 375, and 390 px targets; exact output is
available for draft at all three targets and for predraft at 320 and 390 (the
predraft 375 target saved at 320). The production extension bundle now has
exact automated Draft-, Players-, and Team-workspace coverage at 320, 375, and
390 px. Sleeper forces a wide desktop canvas at mobile widths; Not Sleeping
intentionally reflows to remain usable.

## 5. Typography findings

Sleeper's authenticated Predraft page renders dense status metadata at 9 px,
team and description text at 10 px, selectors at 12 px, and primary content at
14 px. Its authenticated Draft Room renders position metadata at 10 px, pick
labels at 11 px, panel rows at 12 px, and player names/settings at 14 px; no
8 px or 9 px draft-room text was observed in the rendered sample. Sleeper uses
Inter/Lato-family dense text plus Poppins for much of the navigation and display
hierarchy, with legacy Muli still present in draft pick labels. The extension
bundles Fontsource Lato and Poppins under OFL-1.1 and now exposes measured 9,
10, 11, 12, and 14 px role tokens. Nine pixels is restricted to Predraft-style
non-actionable microcopy and the authenticated Players table's position
metadata; draft surfaces use 10 px or larger. The Players reference uses 12 px
bold names, 9 px position metadata, 11 px schedule context, and 12 px
statistical cells.
The authenticated Team reference uses 14 px regular-weight player names, 11 px
team/position/bye metadata, 10 px bold slot labels, and 12 px trailing values.

## 6. Spacing findings

Sleeper uses compact 4–16 px internal spacing, 40 px primary controls/tabs,
44 px draft-player rows, 52 px league statistical player rows, 32 px Players
search/filter controls, and 50 px draft cells. Shared spacing and geometry
tokens now replace the main hard-coded control dimensions. Team roster rows are
64 px with 8×16 px padding, 4 px vertical rhythm, 42×32 px rounded slot tiles,
and 32 px circular player thumbnails.

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
before secondary metrics. The authenticated Players page alternates transparent
and `#212635` 52 px rows, with a 32 px action cell, 12 px bold name, 9 px
position metadata, and 12 px statistic cells. The extension counterpart now
uses the same 52/32/12/9 density and zebra rhythm while retaining canonical
headshots. Its initials remain beneath each image until the verified URL loads,
so a slow or failed request cannot create an empty identity. The shared avatar,
badge, row-height, and fallback components satisfy that hierarchy without
guessed headshots. Draft Copilot
player names now wrap instead of using a clipping ellipsis, preserving the full
identity at every required width while leaving the position badge visible.
At 320 px, recommendation rows also wrap the complete name and keep position in
the visible team/position/tier metadata when the standalone badge collapses.
The authenticated Team page alternates transparent rows with a subtle red tint.
The extension now uses the same 64/42×32/32/14/11 roster anatomy and retains an
initials/team fallback beneath every canonical headshot.

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
the recommendation board, the Players toolbar/list, the Team roster, and the
on-clock AI switch at 320, 375, 390, 768,
1024, 1440, and 1920 px. The 390 px run also opens the progressive-disclosure
analysis before capture. The matrix additionally proves that each first
recommendation retains a visible position and that its player name is not
clipped; the 320 px runs attach focused Draft recommendation and Players
density captures.

## 13. Interaction-state findings

Hover, active, selected, focus-visible, disabled, paused, on-clock, complete,
undo, redo, reset-confirmation, and league-switching states are represented.
Focus rings use the selected teal and never rely on color alone for identity.
The Sleeper Players reference exposes search through placeholder text but uses
generic, non-focusable `div` rows and showed no visible focus treatment in the
sampled input state. The extension deliberately improves those semantics:
result rows are buttons, selection is exposed with `aria-pressed`, and the
shared 2 px teal focus-visible ring remains keyboard-visible. Filtering moves
selection to a visible row or clears the detail pane. After the v0.8.9 reload,
the launcher was activated from the same authenticated
Sleeper draft-room tab without opening another browser or making a draft write.
Team roster sections are labeled lists with list-item rows; each slot tile has
an explicit accessible slot name. Occupied rows are informational and do not
pretend to expose the lineup-write actions that remain in Sleeper.

## 14. Loading-state findings

League switching and player-pool loading show explicit destination-specific
states. Skeletons preserve layout. The previous league's completion state is
cleared before new data is requested.

## 15. Error-state findings

Runtime, provider, stale snapshot, saved-mock mismatch, and insufficient-player
pool errors remain local and actionable. Local deterministic features remain
available when optional AI fails.
The installed v0.8.9 post-refresh console check recorded no extension warning
or error; the sole recent entry was Sleeper's own deprecated scrollbar-option
warning.

## 16. Accessibility findings

The extension supplies semantic navigation, headings, tabs, tables, buttons,
accessible names, focus-visible outlines, reduced-motion support, and contrast
adjustments. Sleeper's sampled accessibility tree relies heavily on generic
groups, so semantic parity was not copied where it would reduce usability. The
responsive matrix locates the AI control by its switch role and accessible
`Turn AI on` name, and locates the activity stages as the `On-clock AI
activity` list.
Team exposes Starter, Bench, Taxi Squad, and Reserve as separately named lists.
Configured empty special slots retain their list items and readable `Open`
state instead of disappearing from the accessibility tree.

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
player search, 52 px zebra player result/detail rows, projected starters, draft
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
The same matrix verifies the rendered role hierarchy: recommendation player
names are at least 14 px, draft metadata and on-clock AI activity are at least
10 px, and the relevant roles resolve to those minimums at every required
width. It also verifies full-name clipping and visible-position invariants for
the recommendation row at each width.
The Players verification independently covers the same seven widths and asserts
its 52 px rows, 32 px controls/avatars, 12 px names, 9 px metadata, selected
state, keyboard focus, empty-result clearing, and viewport containment.
The Team verification covers the same widths and asserts shared roster-row,
slot-tile, avatar, typography, section, and list semantics. The connected Team
workspace now reconstructs sections from the isolated selected-league snapshot
instead of draft recommendation candidates.

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
Sleeper's league Players page is a wide weekly-stat table with add/drop action
cells; the extension uses a narrow searchable identity list plus an
intelligence detail pane because it is read-only and runs in a side panel.
Sleeper's Team rows also expose two ownership/start-percentage columns and
lineup mutation controls. The extension deliberately keeps one narrow trailing
value column and never invents ownership percentages or duplicates mutation
controls.
No unresolved Draft-workspace overflow or critical-text clipping was observed
in either seven-width production-bundle matrix.

## 21. Technical reason for every remaining discrepancy

- Horizontal layout differs because a Chrome side panel is 320–600 px, not a
  1675 px application canvas.
- Chat is omitted because Not Sleeping is read-only and has no messaging scope.
- Weekly player-stat columns and add/drop actions are omitted from the Players
  list because the side panel prioritizes search and intelligence detail and
  has no roster-write scope.
- Sleeper ownership/start percentages are omitted from Team because they are
  not supplied by the documented public roster payload. Lineup buttons are
  omitted because the extension's integration is intentionally read-only.
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
and no unintended horizontal overflow exists. The companion tests `matches
measured Sleeper Players density at every audit width` verifies the same exact
widths for Players and attaches its sanitized 320 px density capture, while
`matches measured Sleeper Team roster anatomy at every audit width` asserts
64 px rows, 42×32 slot tiles, 32 px avatars, 14/11 px identity typography,
semantic list/listitem relationships, and viewport containment. The
installed route captures
record broader component consistency, and `implementation/24-beers-pool-fixed.png`
shows the corrected Beers BB $50 player pool with an enabled local-mock action.

The 2026-08-11 authenticated verification set was first captured against
v0.8.3 and was subsequently complemented by the installed v0.8.7 Draft
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
The reviewed v0.8.7 Windows and Linux Draft visual baselines record the measured
typography correction. Two consecutive local Windows runs and all three Linux
CI retries produced stable platform-specific images before those snapshots were
accepted. The post-update local visual suite passes both the Draft and
secure-options baselines.
The v0.8.8 browser report adds `draft-320-recommendation-position`, a sanitized
278×63 px element capture showing the full two-line player name and visible
`FA · QB` metadata without horizontal overflow.
The v0.8.9 browser report adds `players-320-density`, a sanitized full-viewport
capture of the compact Players toolbar, 52 px zebra identities, selected state,
and initials-under-image fallback. Its exact-width matrix passes at 320, 375,
390, 768, 1024, 1440, and 1920 px without audited-region overflow.
The v0.8.10 browser report adds `team-320-roster`, a sanitized full-viewport
capture of the explicitly labeled demo projection and measured roster anatomy.
The same seven-width matrix passes without audited-region overflow. Separate
connected-store coverage proves that a selected league renders its own starter,
bench, taxi, and reserve players and never the demo recommendation candidates.
