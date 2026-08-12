# Not Sleeping v0.8.13 validation report

Date: 2026-08-12

Release candidate: `0.8.13`

Branch validated: `codex/sleeper-route-league-binding-v0.8.13`

## Scope

This release binds every connected side panel to the league visible in its
authenticated Sleeper tab, removes unsupported fixed decisions and evidence
from Today, normalizes Sleeper player status labels case-insensitively, and
adds visible launcher failure feedback.

## Automated gate

`pnpm validate:phase3` passed as one serialized run:

- Prettier check, ESLint, and TypeScript: passed.
- Vitest: 59 files passed, 1 skipped; 418 tests passed, 2 skipped.
- Coverage: 79.48% statements, 68.65% branches, 80.41% functions, and
  81.79% lines.
- Performance budgets: 3 tests passed.
- Simulation smoke: 1 passed, 1 intentionally skipped.
- AI evaluations: 10/10 passed.
- Production Chrome MV3 build: passed; unified bundle assertion covered 39
  files.
- Chromium: 18 passed, 1 intentionally skipped. This includes the complete
  manual league-derived mock, exact-width Draft/Players/Team/League/Trade
  matrices, route propagation, GET-only network audit, accessibility, and
  player-photo/on-clock controls.
- Visual regression: 2 passed.
- Production dependency audit: no known vulnerabilities.

The packaged-extension screenshot workflow also passed after asserting that
Today renders exactly three fixture-backed cards, has no weather, research, or
taxi placeholder, labels provenance as `Local check` or `Sleeper`, and no
longer displays the former invented point range.

## Route and Today proof

- The live-draft controller sends `SLEEPER_CONTEXT_UPDATE` only to ports bound
  to the matching Sleeper tab, both on subscription and on every later route
  change.
- Store coverage selects the visible route league only when it belongs to the
  detected account catalog. Already-selected, missing, and unknown league IDs
  are ignored.
- Account detection re-subscribes after league hydration, closing the race
  where a route update could arrive before the catalog existed.
- Today pure tests reject unsupported fixed cards, verify direct public-API
  endpoint citations, require actual pending waiver transactions, and suppress
  manual lineup guidance for a healthy best-ball roster.
- `docs/screenshots/today-decisions.png` and
  `docs/screenshots/evidence-drawer.png` were generated from fictional data.

## Installed Chrome smoke

The production build was reloaded with
`scripts/reload-chrome-extension.ps1 -RefreshSleeperTabs $true` in the user's
already-open Chrome session. The existing authenticated Sleeper tab remained
on the Big Bucks league route, refreshed successfully, and exposed the current
Not Sleeping launcher. The launcher completed its runtime open request without
entering the new error/retry state.

Chrome's side-panel document was not exposed through the current Windows UI
Automation/Chrome debug bridge after the open promise resolved, so this report
does not claim a new visual capture of the installed Big Bucks header. The
route-selection behavior is instead proven at controller, connected-store,
production-bundle, and content/background protocol layers. This automation
visibility limitation is recorded in the DevTools audit rather than hidden.

## Release artifact

- ZIP: `artifacts/not-sleeping-0.8.13.zip`
- Size: 581,710 bytes
- SHA-256 file: `artifacts/not-sleeping-0.8.13.sha256`
- SHA-256:
  `b1c0b3bd240655008257554eeee40df59d1fd2fe6daaef7b6eea22bc85585603`
- Reproducibility: two consecutive packaging runs produced the identical
  SHA-256 digest.

## Safety boundary

Sleeper network behavior remains GET-only in automated extension coverage.
No pick, lineup, waiver, trade, or settings mutation was sent to Sleeper. No
authenticated league screenshot, chat, browser tab, session token, provider
key, or private API material is included in the repository or release artifact.
