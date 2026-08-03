# Threat Model

## Overview

Not Sleeping is a local Chrome MV3 extension for fantasy-football decisions.
Its privileged runtime can access public Sleeper endpoints, optional OpenAI and
Anthropic endpoints, extension storage, IndexedDB, supported Sleeper pages, and the side
panel. It has no server, account database, payment path, remote-code loader, or
write-capable Sleeper integration.

Primary runtime code lives in `src/entrypoints`, `src/providers`, and
`src/services`. Build, tests, documentation, demo fixtures, and release tooling
are developer-controlled supporting surfaces.

## Threat Model, Trust Boundaries, and Assumptions

Trust boundaries:

1. **Sleeper page → content script.** Page DOM, routes, and injected page data
   are attacker-controlled. Only sanitized route context crosses the boundary.
2. **Content/UI → background.** Runtime messages are untrusted until protocol,
   size, age, sender ID, sender URL, host, and capability validation complete.
3. **Options → Chrome secret storage.** Key entry is trusted only in the
   options page. Session/local storage is restricted to trusted contexts.
4. **Background → Sleeper/OpenAI/Anthropic/nflverse.** HTTPS responses, model text, web
   sources, and public datasets are untrusted and Zod-validated.
5. **Files → import worker/storage.** User-selected CSV/JSON is untrusted and
   subject to type, signature, size, row, column, depth, field, and identity
   checks.
6. **Extension → external citation.** Only validated non-local HTTPS URLs
   without embedded credentials may open.
7. **Repository → release.** Dependencies, CI actions, lockfile changes, and
   packaging are developer-controlled supply-chain inputs.

Assumptions:

- The browser profile and operating-system account are trusted. Remembered
  keys are not protected from an attacker who controls the profile/device.
- Chrome correctly enforces extension origins, MV3 CSP, storage access levels,
  and host permissions.
- TLS and the selected providers' infrastructure are outside this repository.
- The user reviews current provider terms, local law, and budget controls.

## Attack Surface, Mitigations, and Attacker Stories

### Credential exfiltration

A malicious page or imported file may attempt to obtain an OpenAI or Anthropic key.
Mitigations include options-only direct writes, background-only reads,
trusted-context storage access, credential rejection in runtime messages,
redaction, no content-script key path, and CSP without remote code.

### Message capability escalation

A Sleeper page may forge messages to invoke privileged features. The protocol
uses a versioned Zod discriminated union, 64 KB limit, two-minute freshness
limit, extension sender ID, extension-page origin validation, supported-host
checks, and a small content-script capability allowlist.

### Prompt injection and malicious research sources

Web content can contain instructions to reveal secrets, alter rankings, or
execute actions. Research instructions explicitly treat source content as
data, forbid source instructions and secrets, require strict structured
output, bound research adjustments, validate citations against provider
annotations, and expose no execution/tool surface beyond current search.

### Provider/data poisoning

Sleeper, model, public dataset, and import data can be malformed or misleading.
Zod validation, typed normalization, source freshness, identity confidence,
unknown/conflict fields, stale-cache preservation, deterministic local
fallbacks, and explicit user overrides limit silent corruption.

Specific Phase 2 cases include fake reporter accounts, malicious social posts,
poisoned imported projections, compromised public datasets, stale injury data,
and false weather locations. Source class is independent of popularity; URLs,
timestamps, stadium coordinates, hashes, expiration, contradictions, and
bounded score impact are retained. Unknown inputs lower confidence.

### Cross-league state leakage

Delayed responses could pair one league header with another league's roster or
recommendation. League-dependent requests use explicit context and scoped keys.
The UI retains the old context/snapshot pair while switching and atomically
commits only the newest matching pair. A five-league out-of-order response test
guards this invariant.

### Notification and optional credential privacy

Lock-screen notifications can expose league information, and an optional X
credential could be stolen. Notifications require a user gesture, deduplicate,
respect quiet hours, and hide private text by default. Official X integration
is disabled and no X credential exists in the default package. If added, it
must use the same trusted-context BYOK boundary as the OpenAI key.

### Research-cost abuse

Automatic research could be triggered repeatedly by polling or poisoned news.
The request queue bounds concurrency/rate, deduplicates equivalent work,
supports cancellation, caches by decision context, and never refreshes every
player on every poll. Deterministic calculations do not call OpenAI.

### XSS, unsafe links, and remote code

React escapes product text. No `dangerouslySetInnerHTML`, `eval`, inline
executable scripts, remote scripts, or dynamic remote imports are used.
Citation opening validates HTTPS, blocks local hosts and embedded credentials,
and uses `noopener,noreferrer`.

### Denial of service and cost abuse

Large files, rapid navigation, repeated UI requests, or provider errors may
consume memory/API budget. Limits exist for files/messages, queue concurrency,
requests per minute, timeouts, active-request dedupe, cancellation, polling
lifecycle, retry attempts, and cache TTLs.

### Diagnostics/privacy leakage

Logs or support exports may expose identifiers or prompts. The structured
logger is bounded, production defaults to warnings, sensitive keys are
redacted recursively, IDs are aliased, URLs/prompts/raw responses/notes are
removed, and exports require an explicit user action.

### Supply chain

Malicious packages/actions could compromise builds. Dependencies are pinned,
pnpm build scripts are allowlisted, lockfile install is frozen in CI,
Dependabot and CodeQL are enabled, production audit is gated, output rejects
source maps, and release archives receive SHA-256 checksums.

### Sleeper metadata and news poisoning

Sleeper player metadata is schema-validated and used as an invalidation signal.
The extension does not invent a Sleeper news endpoint or treat `news_updated`
as article text. External claims retain source class, URL, timestamp,
contradictions, and bounded impact; instruction-like evidence is rejected.

### Provider disagreement and stale overlays

AI cannot change legality or reintroduce an excluded candidate. Outputs are
strictly parsed, adjustments are bounded, state hashes reject late responses,
and consensus disagreement retains the deterministic baseline. One provider's
credential is never used in another provider's request.

### Gambling feature exposure in Core

Core resolves the Labs module to a no-op stub at build time. CI scans the Core
bundle for Labs-only strings and packages Core and Labs separately. The Labs
workspace requires adult-age and jurisdiction acknowledgement, uses only manual
inputs, and has no stake, operator link, affiliate, or action path.

Out of scope: attacks requiring control of the user's OS/browser profile,
Chrome itself, TLS, or upstream provider infrastructure; fantasy strategy
disagreement without a security boundary failure; and provider availability.

## Severity Calibration (Critical, High, Medium, Low)

**Critical:** reliable remote key exfiltration or arbitrary code execution from
a supported web page/import without additional user compromise.

**High:** a content script can invoke a background secret-bearing operation;
untrusted remote content can bypass validation into script execution; a
release artifact contains a real credential.

**Medium:** cross-league identifier leakage in diagnostics, unsafe external URL
opening, meaningful unbounded API-cost amplification, or persistent poisoned
data that bypasses identity/format confirmation.

**Low:** bounded local denial of service, missing freshness labels,
non-sensitive verbose logging, or a UI-only authorization ambiguity without a
privileged sink.

Repository: github.com/jtaitt-dev/not-sleeping
Version: working tree for v0.3.0 Phase 3 build
