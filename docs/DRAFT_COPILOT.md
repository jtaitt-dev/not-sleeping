# Draft Copilot

Draft Copilot is the read-only decision surface beside a Sleeper NFL draft. It
observes Sleeper, calculates locally, and may add optional bounded AI context.
It never submits picks, queues players, changes auto-pick, claims slots, bids,
nominates, trades, or changes league settings.

## What it detects

On a supported Sleeper draft page, Not Sleeping resolves the active draft and
keeps source league and session type separate. Multiple signals distinguish a
real league draft, a league-derived mock, a standalone mock, and an uncertain
session. High-confidence cases follow automatically; only an ambiguous draft
shows the small persisted override.

When a source league exists, the Copilot derives:

- team count, rounds, snake/linear/third-round-reversal/auction style;
- redraft, keeper, dynasty startup, or dynasty rookie mode;
- Superflex/2QB, TE premium, Best Ball, IDP, taxi, bench, and scoring settings;
- current board, user roster/slot, owned selections, traded-pick ownership, and
  next owned pick;
- verified current player pool, including rookie-only eligibility.

Automatic account discovery reads only the bounded visible Sleeper username,
resolves the public user ID, and synchronizes available league seasons. Manual
username entry remains a fallback. No Sleeper cookie or credential is read.

## Decision hierarchy

The Draft tab has five areas:

1. Draft Context — identity, session kind, format, current pick, and ownership.
2. Draft Copilot — one dominant recommendation with roster, tier, scarcity,
   opponent-pressure, board-impact, availability, risk, and alternatives.
3. Recommendation Board — compact legal candidates with headshots, scores,
   availability ranges, watch/hide, and comparison details.
4. Recent Picks — current board movement without duplicating the recommendation.
5. What-If — isolated local simulation that never changes Sleeper.

The local board filters drafted, hidden, unavailable, duplicate, and ineligible
players before ranking. Display scores preserve differentiation and keep raw
value, calibrated local score, contextual adjustment, and bounded AI adjustment
separate. Next-pick availability is a seeded estimate with an uncertainty range,
not a promise about another manager's intent.

Consecutive owned selections produce a two-pick plan. Auctions replace snake
metrics with the current nomination, remaining budget, legal maximum, modeled
value, recommended ceiling, roster spots, and reserve required for minimum bids.
Completed drafts transition to a post-draft review state.

## Player identity

The centralized resolver prefers a trusted normalized image URL, then a current
public Sleeper player image for a verified Sleeper ID. It handles lazy/eager
loading, top-candidate preloading, failed-URL memoization, missing IDs, 404s,
rookies, veterans, IDP, and team defenses. Team/position styling and initials
are final fallbacks; copied player images are not packaged with the extension.

## AI behavior

AI is optional. The local recommendation is ready first and remains usable
during missing-key, permission, model, schema, rate-limit, timeout, provider,
and offline failures.

The in-card switch exposes provider, model, effort, and state. As an owned pick
approaches, preparation is automatic. Progress is driven by completed events,
not a timer:

- board synchronized;
- up to eight candidates scored and shortlisted;
- current Sleeper player metadata checked or explicitly unavailable;
- next-pick scenarios ready;
- bounded AI synthesis started;
- ready or local fallback.

AI receives only the already-valid shortlist and cannot reintroduce an illegal
candidate. A state hash prevents an older result from being shown as current
after the board, settings, evidence, or active draft changes. Provider output
may move the displayed contextual score only inside its schema-bounded range;
deterministic legality remains authoritative.

Normal Draft UI never displays raw provider bodies, Zod issues, JSON payloads,
stack traces, authorization details, or schema paths. The safe status includes
only a diagnostic code, provider/model when safe, retryability, timestamp, and
recommended action. Redacted technical detail stays in Diagnostics.

## Validation

Automated coverage includes session detection, source-league resolution,
traded picks, rookie filtering, score calibration, next-pick simulation, roster
context, AI states, error translation, image resolution/fallbacks, auction,
turn pairs, completed drafts, 320px rendering, accessibility, and a complete
48-pick manual-entry league-derived mock.

Authenticated QA used the signed-in Big Bucks league to create and complete
three 16-team, three-round Sleeper mocks. At least two selections were made
through Sleeper's normal player-row UI with auto-pick visibly off; the remaining
live board completion included Sleeper timeouts/auto-picks. A separate packaged
extension E2E enters all 48 picks manually and validates order, ownership,
eligibility, pool limits, and duplicates after every pick. See the
[2026-08-10 validation report](VALIDATION_REPORT_2026-08-10.md) for the exact
scope and limitations.
