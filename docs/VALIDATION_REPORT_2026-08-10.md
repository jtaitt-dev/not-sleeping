# Not Sleeping v0.8.2 validation report

Date: 2026-08-10

Release candidate: `0.8.2`

Branch validated: `main`

## Outcome

The premium Draft Copilot release candidate passed the complete local release
gate and authenticated Big Bucks QA. The packaged Chrome MV3 extension detected
the live Sleeper draft, its source league, rookie-only pool, linear order, 16
teams, three rounds, user-owned turns, and completion without a pasted draft ID
or manual extension refresh.

Not Sleeping remained read-only. The extension never submitted a Sleeper pick;
the authenticated manual selection described below was made in Sleeper's normal
draft UI.

## All-league isolation and legality audit

After reproducing a switch from a completed Big Bucks mock to Beers BB $50, the
draft scope was hardened at both the store and data-query boundaries. A league
switch now clears the previous board synchronously, rejects stale late
responses, rebuilds the eligible pool before applying its limit, and excludes
the selected league's already-rostered players where the draft format requires
it.

The authenticated read-only account audit completed every configured pick with
manual engine selections and zero invariant failures:

| League                | Teams | Rounds | Picks | Result                                     |
| --------------------- | ----: | -----: | ----: | ------------------------------------------ |
| testt                 |     8 |     15 |   120 | All legal                                  |
| Beers BB $50 # 3      |    12 |     28 |   336 | All legal                                  |
| NFL Last Man Standing |    18 |     40 |   720 | All legal                                  |
| Big Bucks             |    16 |      3 |    48 | Rookie-only, verified ownership, all legal |

Total: **1,224 legal, duplicate-free picks**. Sleeper access remained GET-only;
the audit made no pick, roster, league, or settings writes.

## Authenticated Big Bucks validation

Primary final QA draft: `1392596722437353472`

- Created from **Big Bucks → Mock Drafts → New Mock Draft** in the existing
  signed-in Chrome session.
- Sleeper settings observed: 2026 dynasty rookie, 1QB, 16 teams, three rounds,
  linear order.
- Not Sleeping followed the newly created draft automatically and exposed the
  correct owned turns at 1.10, 2.10, and 3.10.
- The user auto-pick switch was off in Sleeper.
- The authenticated on-clock capture was taken at 1.10.
- At 3.10, Draft Copilot recommended Dominic Zvada. He was still present in
  Sleeper's available-player list and was selected through Sleeper's normal UI.
  Sleeper recorded him as the user's legal pick 42.
- The draft completed at 48/48 picks. Not Sleeping transitioned to **Draft
  Complete**, reported **48 picks safely synced**, retained the final board, and
  marked Dominic Zvada as **You** in Recent Picks.
- The remaining unclaimed managers were controlled by Sleeper's mock-draft bots.
  The first two user turns expired under Sleeper's timer; this final live run is
  therefore not represented as 48 manual selections.

Earlier authenticated runs also completed drafts `1392170530634752000`,
`1392574345284448256`, and `1392576464506871808`. Manual Sleeper-UI selections
in those runs included Jordyn Tyson at 1.03 and Elijah Sarratt at 2.03. The
packaged deterministic E2E test separately enters all 48 picks manually so every
pick transition, legality rule, pool rule, ownership update, and completion state
is covered without relying on Sleeper timers.

Sanitized evidence:

- [Authenticated on-clock capture](../artifacts/big-bucks-on-clock.png)
- [Authenticated completed-draft capture](../artifacts/big-bucks-mock-detected.png)
- [Packaged premium on-clock state](screenshots/draft-premium-on-clock.png)
- [Packaged AI working state](screenshots/draft-premium-ai-working.png)
- [Packaged AI ready state](screenshots/draft-premium-ai-ready.png)

No username, user ID, unrelated browser content, chat content, provider key, or
manager display-name list is included in these release captures.

## Release gate

| Validation                         | Result                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`   | PASS — lockfile already current                                    |
| `pnpm format:check`                | PASS                                                               |
| `pnpm lint`                        | PASS — zero warnings                                               |
| `pnpm typecheck`                   | PASS                                                               |
| Unit/integration tests             | PASS — 51 files passed, 1 skipped; 376 tests passed, 2 skipped     |
| Coverage                           | 78.71% statements, 67.81% branches, 79.07% functions, 81.06% lines |
| `pnpm test:performance:ci`         | PASS — 3/3                                                         |
| `pnpm test:simulations`            | PASS — smoke invariants                                            |
| `pnpm test:simulations:exhaustive` | PASS — 5,000/5,000; zero invariant failures                        |
| AI contract coverage               | PASS — included in the full unit/integration suite                 |
| `pnpm test:ai-evals`               | PASS — 10/10                                                       |
| `pnpm test:backtest`               | PASS — 3/3                                                         |
| `pnpm build`                       | PASS — Chrome MV3 production bundle                                |
| `pnpm assert:unified-bundle`       | PASS — 28 files                                                    |
| `pnpm test:e2e`                    | PASS — 13 passed; authenticated opt-in test skipped by default     |
| `pnpm test:visual`                 | PASS — 2/2                                                         |
| `pnpm screenshots:phase2`          | PASS — 2/2 capture workflows                                       |
| Authenticated account audit        | PASS — live account/league read-only audit                         |
| `pnpm audit:prod`                  | PASS — no known vulnerabilities                                    |
| `pnpm zip`                         | PASS — two consecutive builds produced identical bytes             |

The E2E traffic audit separately identifies requests from the extension service
worker and the Sleeper page. Every extension-originated Sleeper request was GET;
any other method is a blocking test failure.

## Model and performance evidence

- [Draft Copilot timing instrumentation](../artifacts/draft-copilot-performance.md)
- [Performance benchmark report](../artifacts/performance-report.md)
- [5,000-scenario simulation report](../artifacts/simulation-report.md)
- [AI evaluation report](../artifacts/ai-eval-report.md)
- [Backtest report](../artifacts/backtest-report.md)

The Draft Copilot timing artifact is intentionally labeled as a deterministic
instrumentation-contract fixture. It verifies timing arithmetic, all required
milestones, and before/after-clock classification; it is not presented as a
production-provider latency benchmark. Runtime code records the same milestones
from real board, context/research, AI start, AI ready, and clock events.

## Release artifact

- ZIP: `artifacts/not-sleeping-0.8.2.zip`
- SHA-256 file: `artifacts/not-sleeping-0.8.2.sha256`
- SHA-256:
  `66be3b7735ce14c462c0ba189946802e37638efa62dc632829345c797bb58327`

The archive is a limited-beta/sideload package. It is not approved for Chrome
Web Store submission without a new policy and legal review.

## Remaining interpretation limits

- Live Sleeper mocks combine user-controlled turns with Sleeper-controlled
  unclaimed slots and enforced pick timers. Authenticated claims above identify
  exactly which selections were manually made.
- Player headshots use verified numeric Sleeper IDs. Current rookies without a
  resolvable image use the documented team/position or initials fallback instead
  of a guessed or mismatched photo.
- Availability is a seeded calibrated range, not a statement of another
  manager's exact intent. Backtests and simulations retain their documented
  proxy-data limitations.
