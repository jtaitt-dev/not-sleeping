# UI Component Inventory

## Shared shell

- `AppShell`: theme root, active workspace, responsive navigation, subscreen
  header, and bottom connectivity status.
- `LeagueHeader` and `LeagueSwitcher`: account-scoped league identity, sync
  state, active draft context, and stale-response-safe league switching.
- `Button` and `IconButton`: primary, secondary, ghost, danger, compact,
  disabled, hover, and focus states.
- `CompactTabs`: horizontally scrollable semantic tabs using the shared 40 px
  navigation height.

## Draft and player primitives

- `PlayerAvatar`, position/status/tier badges, player rows, score displays, and
  score breakdowns.
- `SleeperRosterSlot` composes a measured slot tile, resilient 32 px avatar,
  identity metadata, and trailing value into the shared 64 px roster row.
- `buildTeamRosterSections` preserves selected-league starter order and
  separates bench, taxi, and reserve players without duplicates; Best Ball
  uses one ordered roster section.
- `buildLeagueOverview` rejects cross-league snapshots and projects team
  identity, canonical draft slots, standings, waiver state, public activity,
  and settings into one presentation-safe selected-league model.
- Draft context, Draft Copilot, recommendation board, recent picks, What-If,
  current-pick status, roster need, position-run alerts, and auction budget
  panels.
- League-derived manual mock workspace with exact order, ownership, roster
  eligibility, player-pool, duplicate, pause, undo, redo, reset, autosave, and
  completion checks.

## Feedback and overlays

- Skeleton rows preserve the destination layout while data loads.
- Empty states explain the missing prerequisite and the next valid action.
- Inline errors stay local and retain cached/local functionality.
- Radix-backed dialogs, confirmation alerts, dropdowns, and tooltips supply
  focus management, escape behavior, and semantic names.

## Surfaces migrated

The shared tokens and primitives are used by Today, League, Draft, Mock Draft,
Team, Players, Trade, Start/Sit, Waivers, Matchup, Chopped, Research,
Deadlines, Dynasty, Rankings, Compare, Watchlist, Rookie, Taxi, IDP, Auction,
Data Center, Usage, Settings, Diagnostics, About, popup, and options/onboarding.

Each route may compose domain-specific cards, tables, charts, or filters, but
may not define a second typography, color, control-height, radius, or icon
system.
