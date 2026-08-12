# Trade Center

Trade Center accepts multiple assets from the selected Sleeper league and
reports production, dynasty, contender, and rebuild value; legal starter
change; depth; roster-space legality; fairness gap; and negotiation conditions.
Superflex, two-QB, TE premium, IDP, scoring, league size, strategy, and
positional scarcity remain explicit inputs.

## Data and projection provenance

- Parties, player ownership, reserve/taxi state, roster capacity, team names,
  and supported traded picks come from the isolated selected-league snapshot.
- Weekly production uses the league scoring engine when a complete stat line is
  available, imported projection points when only a direct projection is
  available, and a labeled local search-rank proxy as the final fallback.
- The visible coverage line counts all three sources. A proxy is never presented
  as a completed market transaction or an authoritative projection.
- Cross-league and cross-user snapshots are rejected before a trade is shown.

## Lineup and capacity analysis

Before/after totals come from the legal lineup optimizer using the league's
actual roster positions. The calculation accounts for flex, superflex, IDP,
injury, IR, and taxi eligibility. Depth and remaining roster spots are computed
from the active, bench, configured IR, and configured taxi capacity; a negative
value is shown as cuts required rather than hidden.

## Draft-pick ownership

The view reconstructs each roster's default picks for three seasons, then
applies Sleeper's traded-pick ownership records. Current-season picks show exact
slots when the documented draft order or `slot_to_roster_id` mapping makes them
known, and acquired picks include a `via Team Name` label. Once the current
draft is complete, already-spent current-season picks are excluded and the
future inventory begins with the following season.

## Read-only boundary

Asset selection and analysis are local. Not Sleeping never sends, accepts, or
rejects a trade and never changes a roster. `Open Trades in Sleeper` is an
explicit safe handoff to the authenticated Sleeper workflow; the user remains
responsible for reviewing and submitting any offer there.

## Verification

Pure tests cover identity isolation, projection provenance, exact/current pick
ownership, and completed-draft behavior. Connected-store tests cover real
lineup deltas and league switching. The packaged Chrome extension selects a
player on each side and verifies geometry, semantics, selection state, and no
unintended overflow at 320, 375, 390, 768, 1024, 1440, and 1920 px using only
fictional fixture data.
