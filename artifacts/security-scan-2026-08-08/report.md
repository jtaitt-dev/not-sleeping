# Security Review: not-sleeping

## Scope

Complete source review of the Not Sleeping Manifest V3 extension, including its current working-tree changes and all security-sensitive runtime boundaries.

- Scan mode: repository
- Target kind: git_worktree
- Target ID: target_sha256_deb68ea8dc919a8cfdc6ef1463c9c7fd22bcecc10deaea64c7da15e7ceee7976
- Revision: 405c6755780abf40472415b065a88ccaf2025be4
- Snapshot digest: codex-security-snapshot/v1:sha256:402e828877c3a083ebd1113fe0e7fd4f60e302d6739e8d6b61116bb0822a9ed8
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Format, lint, typecheck, 329 unit/integration tests, 12 MV3 end-to-end tests, 2 visual tests, dependency audit, production build assertions, and a read-only live Sleeper audit of four leagues and 1,212 mock picks all passed.
- Artifacts reviewed: src/entrypoints/background.ts, src/entrypoints/content.ts, src/entrypoints/options/main.tsx, src/providers/sleeper/sleeper-provider.ts, src/providers/sleeper/read-only-boundary.ts, src/providers/openai/openai-provider.ts, src/providers/ai/anthropic/anthropic-provider.ts, src/services/context/live-draft-controller.ts, src/services/league/league-service.ts, src/services/messaging/protocol.ts, src/services/storage/key-vault.ts, src/services/security/url.ts, src/providers/evidence/evidence-adapters.ts, src/features/research/manual-odds-analysis.ts, wxt.config.ts, tests and e2e security regression coverage
- Scan context: The review focused on API-key handling, Sleeper read-only guarantees, extension permissions, storage, external networking, account and league isolation, tab-scoped live-draft state, and manual research gates.

Limitations and exclusions:
- Chrome exposes storage APIs to all trusted pages in the same extension origin; the implementation reduces exposure with session-only storage by default, explicit confirmation for remembered keys, trusted-context storage access levels, a strict extension CSP, and no remote code.
- After a user confirms an external citation hostname, subsequent DNS resolution and HTTP redirects are governed by Chrome; the extension strips fragments, rejects credentials and secret-like query parameters, blocks local/reserved literal addresses and non-HTTPS/non-443 URLs, and opens with noopener/noreferrer.
- Excluded node_modules/\*\*: Third-party dependency source was excluded from line-by-line review; resolved production dependencies were checked with pnpm audit.
- Excluded .output/\*\*: Generated WXT intermediates were excluded from source review; the resulting production manifest and archive contents were separately asserted.
- Excluded dist/\*\*: Generated unpacked extension output was excluded from line-by-line review; it was exercised by MV3 end-to-end and visual tests.
- Excluded artifacts/\*\*: Generated reports, screenshots, and release archives were treated as validation outputs rather than executable source.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 0 |
| Severity mix | none |
| Confidence mix | none |
| Coverage | complete |
| Validation mode | Central source validation plus automated unit, integration, headless MV3, visual, production-bundle, dependency, and read-only live-data verification. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Untrusted Sleeper page data, public API responses, user imports, research citations, AI outputs, and cross-tab/account state can reach a privileged MV3 extension that stores provider keys and renders decision support. Controls must prevent credential disclosure, write operations to Sleeper, confused-deputy messaging, cross-context state mixing, unsafe navigation, and unbounded payload processing.

### Assets

- OpenAI and Anthropic API keys
- Sleeper account, league, roster, and draft context
- Locally persisted preferences, league workspaces, and mock drafts
- Recommendation integrity and player/pick legality
- Extension permissions and trusted runtime capabilities

### Trust Boundaries

- Sleeper web page and content script to extension service worker
- Side panel and options pages to extension service worker
- Public Sleeper and weather APIs to extension parsing and storage
- AI providers and public research sources to rendered evidence
- One Chrome tab, Sleeper account, league, season, and draft to another
- User-controlled imports and URLs to local processing or browser navigation

### Attacker Capabilities

- Control text and shapes returned by external services within protocol limits
- Supply malformed, oversized, stale, or cross-identity API responses
- Cause rapid tab, account, or league switching and race conditions
- Supply hostile import fields, evidence URLs, or prompt-injection-shaped content
- Send runtime messages from an untrusted page or extension context

### Security Objectives

- Never issue a Sleeper write request or mutate a real roster, pick, waiver, trade, transaction, or league setting
- Keep keys out of messages, logs, diagnostics, URLs, rendered status, and non-trusted contexts
- Bind every live state and persisted workspace to its exact tab, account, league, season, and draft identities
- Reject oversized or identity-mismatched responses before use
- Require explicit optional host permissions and user confirmation for sensitive external capabilities
- Fail closed when legal player, source, or responsible-use context cannot be verified

### Assumptions

- Chrome itself and the installed extension package are trusted and uncompromised.
- The public Sleeper API remains read-only for the endpoints used by this extension.
- The user controls whether to remember a provider key and whether to open a confirmed external citation.

## Findings

### No findings

No reportable findings survived the canonical discovery, validation, and reportability gates.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Sleeper request boundary, response limits, and exact identity binding | External API integrity | No issue found | All Sleeper requests are allowlisted GETs; byte/shape limits and account, league, roster, draft, and season identity checks are enforced and live-audited. |
| Runtime sender validation and per-tab live-draft isolation | Confused deputy and cross-tab disclosure | No issue found | Content-script capabilities are allowlisted, side-panel ports are extension-origin checked, and draft state is keyed and broadcast by subscribed tab. |
| Account, league, season, workspace, active selection, and mock-draft storage isolation | Cross-account and cross-league state mixing | No issue found | Version 4 composite identities, injective storage keys, exact load validation, and stale-selection commit guards are covered by regression tests. |
| Provider-key lifecycle, permissions, redaction, and AI request handling | Credential disclosure and overprivilege | No issue found | Keys default to trusted session storage, status is masked through the worker, AI hosts are optional permissions, diagnostics redact credentials, and provider calls use bounded structured contracts. |
| Research source policy, citations, manual-odds legal pool, and external navigation | Unsafe external content and fail-open analysis | No issue found | Official/trusted allowlists, optional social opt-in, blocked-domain filtering, secret-bearing URL rejection, confirmation interstitials, and nonempty legal-player gates are enforced. |
| User imports, diagnostics, logging, and local alert outputs | Injection, formula execution, and sensitive-data leakage | No issue found | Size/depth/field limits, spreadsheet formula neutralization, credential detection, aliases, and redacted diagnostics are tested. |
| Manifest permissions, content security policy, packaged contents, and dependencies | Extension platform exposure and supply chain | No issue found | No activeTab/tabs permission, AI origins are optional, extension pages use strict self-only CSP, no source maps are packaged, and the production audit reports no known vulnerabilities. |
| Draft legality, roster feasibility, traded-pick ownership, and AI fallback behavior | Integrity of decision support | No issue found | Centralized position eligibility, bipartite roster feasibility, exact pick ownership, bounded AI overlays, and Luna-first fallback are covered by 5,000 simulations and 1,212 live-data mock picks. |
