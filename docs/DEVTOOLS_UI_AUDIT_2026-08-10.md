# DevTools UI Audit — 2026-08-10

Reference: the user's existing signed-in Chrome session on Sleeper. Extension:
the installed unpacked Not Sleeping build in the same browser. Evidence is in
`artifacts/devtools-ui-audit-2026-08-10/`.

## 1. Every Sleeper page inspected

The Big Bucks predraft league page and the NFL draft room were inspected in the
existing signed-in Chrome window. Both were captured at 1675 px and at 320,
375, 390, 768, 1024, 1440, and 1920 px widths.

## 2. Every major component inspected

League rail, league header, league tabs, draft card, team list, chat, draft-room
header, team columns, pick cells, player filters, player table, queue, launcher,
extension shell, league selector, navigation, cards, tables, controls, player
rows, badges, alerts, skeletons, dialogs, popup, and options-page source were
inspected.

## 3. Desktop viewport states tested

Reference pages were captured at 768, 1024, 1440, 1675, and 1920 px widths.
Installed extension captures cover the Sleeper predraft and draft-room contexts
plus the side-panel route set.

## 4. Mobile viewport states tested

Reference pages were captured at 320, 375, and 390 px. Existing extension
acceptance captures cover 320 and 600 px. Sleeper forces a wide desktop canvas
at mobile widths; Not Sleeping intentionally reflows to remain usable.

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
components satisfy that hierarchy without guessed headshots.

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
action. This is an intentional functional deviation.

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
groups, so semantic parity was not copied where it would reduce usability.

## 17. Components created

The migration established shared font, icon, row, navigation, button, input,
draft-cell, modal, drawer, and bottom-sheet tokens. Existing reusable Button,
IconButton, CompactTabs, PlayerAvatar, Badge, MetricCluster, State, and Radix
overlay components remain the canonical primitives.

## 18. Components refactored

App shell navigation/actions, buttons, icon buttons, compact tabs, search
toolbars, player result rows, popup context/action, and options navigation/forms
were moved to the measured shared geometry. Global body/display typography was
replaced with the measured font split.

## 19. Screens migrated

Shared tokens apply to every side-panel route, popup, and options/onboarding.
Installed captures directly cover Draft, Today, Team, Players, Trade, More,
Start/Sit, Waivers, Matchup, Chopped, Research, Deadlines, Dynasty, Rankings,
Compare, Watchlist, Rookie, Taxi, IDP, and Mock Draft.

## 20. Remaining visual discrepancies

Sleeper's desktop reference has more horizontal space, a full chat column, and
some legacy Muli text in the draft-room header. The extension uses responsive
side-panel cards, has no chat surface, and standardizes display text on Poppins.

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
The responsive reference set records every required width. The installed route
captures record component consistency, and `implementation/24-beers-pool-fixed.png`
shows the corrected Beers BB $50 player pool with an enabled local-mock action.
