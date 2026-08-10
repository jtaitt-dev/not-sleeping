# Testing

## Automated layers

- Vitest unit tests cover mode/scoring detection, valuation, identity, rookie
  eligibility, detailed offense/IDP slot eligibility, real-league mock-plan
  derivation, traded-pick ownership, manual-pick invariants, restart recovery,
  the GET-only Sleeper boundary, trade evaluation, imports, security helpers,
  navigation, runtime protocol, queues, and mocked providers.
- V8 coverage gates the complete service/provider/schema logic layer at 76%
  statements, 64% branches, 76% functions, and 78% lines. UI is covered by
  the loaded-extension browser suite.
- Playwright launches `dist` as a real MV3 extension and checks navigation,
  interactions, offline use, 320px layout, the two-stage Advanced Research
  gate, truthful Draft Copilot AI states, verified headshots, and a complete
  48-pick manual-entry mock without implicit autopicks.
- axe checks loaded extension pages for serious and critical accessibility
  violations.
- Targeted screenshots cover waiting, on-clock, AI off/working/ready, rookie,
  auction, 320px, 600px, and trusted-key states from the packaged extension.
- CI also runs formatting, typed lint, strict typecheck, build, audit, and
  source-map checks.

## Local release gate

```bash
pnpm validate:phase3
pnpm zip
```

Update visual baselines only after reviewing the new pixels:

```bash
pnpm exec playwright test --project=visual --update-snapshots
pnpm test:visual
```

## Manual matrix

Before a release, check Chrome side-panel widths 320, 360, 420, 480, and 600;
dark, light, system, and high contrast themes; reduced motion; keyboard-only
navigation; offline mode; no-key mode; invalid key; quota/rate limits; Sleeper
outage; completed drafts; and all seventeen demo fixtures.

Authenticated Big Bucks validation is complementary rather than a replacement
for deterministic E2E. Live validation must record which picks were made
manually, which were Sleeper auto-picks/timeouts, the draft IDs, and whether the
extension-originated Sleeper boundary remained GET-only. Never describe a live
board as fully manual unless every Sleeper selection was entered that way.
