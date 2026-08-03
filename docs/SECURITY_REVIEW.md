# Security Review — 2026-08-02

Scope: the complete 282-file Phase 3 working tree, including the Chrome MV3
entrypoints, provider-neutral BYOK boundaries, storage, runtime messaging,
imports, external evidence, league isolation, Core/Labs build separation,
Parlay Lab safeguards, dependencies, CI, packaging, and release automation.

## Result

A completed Codex Security standard scan recorded one high-confidence,
low-severity finding and no critical, high, or medium findings. The low finding
was fixed before release validation:

- External citation validation now rejects canonical localhost-style names,
  single-label/local hosts, non-public IPv4 and IPv6 literals, IPv4-mapped IPv6,
  and private destinations embedded in NAT64 or 6to4 forms.
- The original read-only probe now rejects all five private/link-local examples,
  returns `false` from the navigation helper, and records no `window.open` call.
- Public HTTPS DNS, IPv4, and IPv6 controls remain accepted.

The scan also reproduced a same-user AI budget-ledger race. Attack-path policy
classified it as reliability/cost-control hardening rather than an
attacker-reachable vulnerability because only trusted extension UI can start
decisions. It was fixed anyway: reserve, record, and snapshot operations are
now serialized, and concurrent Chrome-storage and memory-path tests prove that
requests and usage updates cannot be lost.

The review additionally confirmed:

- provider-specific, background-only key access and credential redaction
- sender, host, schema, size, age, capability, and credential rejection
- read-only Sleeper access and league/draft-scoped caches and state
- strict structured AI output, bounded adjustments, legal-ID reconciliation,
  stale-state rejection, and deterministic-first behavior
- React rendering without HTML injection or executable model/source content
- bounded queue, retry, timeout, cancellation, token, request, and cost controls
- import signature/size/shape limits and CSV formula protection
- independent Core and Labs builds with a passing Core exclusion assertion
- current, sourced, user-supplied Labs markets and no stake, operator,
  affiliate, scraping, or bet-placement path
- enforced 21+ and jurisdiction acknowledgement, non-bypassable 24-hour
  cooldown, permanent disable, and no scenario history
- no remote code, production source maps, unsafe shell construction, or known
  production dependency vulnerabilities

## Verification

The post-fix `pnpm validate:phase3` run passed:

- 25 test files: 201 passed, 1 skipped (202 total)
- coverage: 89.89% statements, 84.58% branches, 92.85% functions, 92.92% lines
- standard lineup: 1.892 ms median, 2.451 ms p95 over 50 measured iterations
- large IDP lineup: 8.102 ms median, 10.277 ms p95
- 80 deterministic simulation seeds with zero invariant failures
- AI evaluations: 10/10
- Core build: 24 files; Labs build: 29 files
- Core bundle exclusion: passed across 24 files and 6 Labs-only tokens
- Chromium E2E: 9/9, including a 150-pick manual mock with no duplicates
- visual baselines: 2/2
- production dependency audit: no known vulnerabilities

Commands:

```bash
pnpm exec vitest run tests/imports-security.test.ts tests/budget-guard.test.ts
pnpm typecheck
pnpm exec eslint src/services/security/url.ts src/services/intelligence/budget-guard.ts tests/imports-security.test.ts tests/budget-guard.test.ts --max-warnings 0
pnpm validate:phase3
```

## Review limitations

An earlier Deep Security Scan could not start discovery because the host failed
to spawn its coordinator process with `EPERM`; it reviewed no repository file
and was not treated as evidence. The completed standard scan used the supported
parent-review fallback and closed all 282 inventory rows.

Browser-control tooling could not attach to the already signed-in Chrome
session, so no live Sleeper account data or real provider credentials were
exercised. Product behavior was instead validated with the loaded-extension
Playwright suite, deterministic provider fixtures, and the complete manual mock
draft flow.

Automated checks do not prove absence of vulnerabilities. Re-run the threat
model when permissions, host access, key handling, provider tools, citation
behavior, import formats, Labs data sources, or release infrastructure change.
