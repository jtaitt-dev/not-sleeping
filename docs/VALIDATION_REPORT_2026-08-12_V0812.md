# Not Sleeping v0.8.12 validation report

Date: 2026-08-12

Release candidate: `0.8.12`

Branch validated: `codex/trade-center-parity-v0.8.12`

## Scope

This release replaces Trade Center's synthetic party and value baselines with
selected-league rosters, legal lineup projection, configured capacity,
projection provenance, and supported traded-pick ownership. It also migrates
Trade Center to the authenticated Sleeper Trade surface's compact geometry and
shared extension component system.

## Automated gate

`pnpm validate:phase3` passed as one serialized run:

- Prettier check, ESLint, and TypeScript: passed.
- Vitest: 58 files passed, 1 skipped; 410 tests passed, 2 skipped.
- Coverage: 79.48% statements, 68.58% branches, 80.41% functions, and
  81.78% lines.
- Performance budgets: 3 tests passed.
- Simulation smoke: 1 passed, 1 intentionally skipped.
- AI evaluations: 10/10 passed.
- Production Chrome MV3 build: passed; unified bundle assertion covered 39
  files.
- Chromium: 18 passed, 1 intentionally skipped. This includes the production
  Trade workflow at 320, 375, 390, 768, 1024, 1440, and 1920 px.
- Visual regression: 2 passed.
- Production dependency audit: no known vulnerabilities.

## Trade-specific proof

- Pure tests reject outer and embedded cross-user/cross-league state, verify
  projection provenance, reconstruct current/future pick ownership, preserve
  exact slots and `via` labels, and exclude spent picks after draft completion.
- Connected-store tests select assets from both real parties, prove the
  30→24 and 22→28 weekly legal-lineup changes in the fictional fixture, and
  prevent selection state from surviving a league switch.
- The production-bundle browser test verifies the 798 px desktop cap,
  112×88 px partner cards, 64+ px asset rows, responsive column behavior,
  semantic lists/buttons/pressed state, and zero accidental overflow at every
  required width.
- `docs/screenshots/trade-center.png` was regenerated from fictional fixture
  data. Authenticated screenshots remain local and are not published.

## Installed Chrome smoke

The production build was reloaded with
`scripts/reload-chrome-extension.ps1 -RefreshSleeperTabs $true` in the user's
already-open Chrome session. The signed-in Sleeper tab and launcher remained
available. The installed side panel rendered Trade Center for the selected
Beers league, real party asset lists, roster capacity, the `Select assets`
transition, and the `Open Trades in Sleeper` handoff. One current first-round
pick on each side was selected locally to exercise analysis. No offer was sent,
accepted, rejected, or otherwise written to Sleeper.

## Release artifact

- ZIP: `artifacts/not-sleeping-0.8.12.zip`
- Size: 580,809 bytes
- SHA-256 file: `artifacts/not-sleeping-0.8.12.sha256`
- SHA-256:
  `81d132dc7b926fe1384d68d1c4293f276c4c00b0fcb52c058cce960ef317e7d6`
- Reproducibility: two consecutive clean packaging runs produced the identical
  SHA-256 digest.

## Safety boundary

Sleeper network behavior remains GET-only in automated extension coverage.
Trade Center is analysis-only; the only mutation path is an explicit handoff
to Sleeper, where the user must review and submit an offer. No authenticated
league screenshot, session token, provider key, or private API material is
included in the repository or release artifact.
