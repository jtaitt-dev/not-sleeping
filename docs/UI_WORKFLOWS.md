# UI Workflows

## First run and account discovery

On a signed-in Sleeper page, Not Sleeping reads the visible profile username,
resolves the public account ID, and synchronizes every available NFL league.
Manual public-username entry remains available. Provider keys are optional and
default to session-only storage.

## League switching

Selecting a league enters a switching state immediately, clears the previous
draft, loads that league's snapshot and current-season draft, and commits the
result only if the request still matches the selected league. An open Sleeper
live/mock draft takes precedence only when its source league matches. Late
responses, errors, and completed boards from another league are ignored.

## Live and mock drafts

The live workspace follows the verified draft ID, format, settings, roster,
owned/traded picks, selected players, and legal eligible pool. Recommendations
update after every pick. The user performs all Sleeper actions.

The local manual mock derives teams, rounds, order, ownership, scoring, roster
slots, rookie/veteran/IDP pool, and unavailable players from the selected
league. Autosave keys include account, league, draft, and plan fingerprint, so
one league cannot restore another league's session.

## Research and season decisions

Players can be searched, watched, compared, or researched. Team, Dynasty,
Trade, Rankings, Start/Sit, Best Ball, Matchup, Chopped, Waivers, Auction, Data
Center, and Usage keep the selected league and source freshness visible.
Research shows sources, confidence, conflicts, and unknown facts separately
from deterministic local scores.

## Recovery

Loading states retain the previous safe layout without presenting stale league
identity as current. Provider errors stay localized; local recommendations
remain available. Settings can refresh league data, clear individual caches,
export redacted diagnostics, or reset extension-owned data after confirmation.
