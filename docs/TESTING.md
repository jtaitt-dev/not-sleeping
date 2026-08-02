# Testing

## Automated layers

- Vitest unit tests cover mode/scoring detection, valuation, identity, rookie
  eligibility, trade evaluation, imports, security helpers, navigation,
  runtime protocol, queues, and mocked providers.
- V8 coverage gates core deterministic logic at 85% statements, 80% branches,
  85% functions, and 85% lines.
- Playwright launches `dist` as a real MV3 extension and checks navigation,
  interactions, offline use, and 320px layout.
- axe checks loaded extension pages for serious and critical accessibility
  violations.
- Targeted screenshots cover the live draft and trusted key settings.
- CI also runs formatting, typed lint, strict typecheck, build, audit, and
  source-map checks.

## Local release gate

```bash
pnpm validate
pnpm test:visual
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
outage; completed drafts; and all fifteen demo fixtures.
