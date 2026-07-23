# Security Review — 2026-07-23

Scope: production extension source, manifest, provider boundaries, storage,
runtime protocol, imports, external URLs, diagnostics, dependencies, build,
and release automation.

## Result

No known critical, high, or medium findings remain open in the reviewed
working tree. The review confirmed:

- options-only credential entry and background-only key use
- session-only default and trusted-context access levels
- no credential-bearing runtime message variants
- sender, host, schema, size, age, and credential rejection
- read-only Sleeper endpoints
- Responses API `store: false`, strict schemas, and current web-search shape
- bounded queue, retry, timeout, cancellation, and research adjustment
- React text rendering without HTML injection sinks
- validated external HTTPS links
- import signature/size/shape limits and CSV formula protection
- recursive diagnostic redaction and bounded production logging
- no remote code or production source maps
- pinned dependencies, allowlisted install scripts, CodeQL, Dependabot, audit,
  visual, axe, and loaded-extension tests

## Review commands

```bash
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm test:e2e
pnpm audit:prod
```

Automated checks do not prove absence of vulnerabilities. Re-run the threat
model when permissions, host access, key handling, provider tools, import
formats, or release infrastructure change.
