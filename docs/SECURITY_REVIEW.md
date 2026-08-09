# Security Review — 2026-08-08

Scope: the complete v0.6.0 working tree after the unified Chrome MV3 build,
league-derived manual mock drafts, per-tab live-draft context, account-scoped
storage, provider-key handling, and Advanced Research safeguards were completed.

## Result

The app-backed Codex Security standard scan reviewed eight security surfaces.
Twelve discovery candidates were centrally validated after remediation. No
reportable finding survived validation, attack-path analysis, and reportability
gates. Coverage is complete for the source scope.

The sealed report and canonical artifacts are preserved in
[`artifacts/security-scan-2026-08-08`](../artifacts/security-scan-2026-08-08/report.md).
The scan ID is `83a0dd7d-978b-46e5-92be-eed3a3bdfb0b`.

## Remediations validated

- Live Sleeper context is keyed by Chrome tab and sent only to the subscribed
  side-panel port for that tab.
- Catalogs, active selections, workspaces, and mock drafts are bound to
  exact account, league, season, and draft identities with injective keys.
- Stale rapid league selections cannot persist or replace the latest context.
- Sleeper responses have streaming byte caps, structural limits, record caps,
  and exact league, roster, draft, and season identity checks.
- Every Sleeper request crosses one allowlisted read-only boundary that permits
  only HTTPS `GET` requests to the public API.
- Research honors official/trusted/blocked/social source preferences in both
  the provider request and returned citation set.
- External links reject credentials, sensitive query names, credential-shaped
  values, fragments, non-public literal addresses, non-HTTPS URLs, and
  nonstandard ports; a hostname confirmation is required before navigation.
- Manual odds analysis remains locked until an adult acknowledgement,
  jurisdiction acknowledgement, selected league, and nonempty verified legal
  player pool all exist.
- OpenAI and Anthropic origins are optional host permissions. `activeTab` and
  `tabs` are absent from the production manifest.
- Provider-key status is masked through the service worker. Session-only
  storage remains the default; remembered storage requires confirmation.
- Usage screens use recorded events rather than static sample data.
- The production bundle assertion fails if permissions regress, AI hosts become
  mandatory, legacy flavor paths return, or source maps are shipped.

## Verification

All checks used Node 24.14.0:

- formatting, strict ESLint, and strict TypeScript: passed
- unit/integration: 40 files passed, 1 skipped; 329 tests passed, 2 skipped
- coverage: 77.97% statements, 66.49% branches, 79.19% functions, 80.31% lines
- read-only live Sleeper audit: four leagues, 1,212 picks, zero illegal picks
- exhaustive simulations: 5,000/5,000, zero invariant failures, 100% roster
  completion and recommendation-rank stability
- standard lineup: 2.233 ms median, 3.013 ms p95
- large IDP lineup: 8.338 ms median, 9.877 ms p95
- AI evaluations: 10/10
- Chromium MV3 end-to-end: 12/12
- visual baselines: 2/2
- production dependency audit: no known vulnerabilities
- unified build: 28 files, 1.28 MB, no production source maps

The release archive contains 32 entries, one root manifest, no source maps, and
no `core/` or `labs/` paths. It is 400,017 bytes. SHA-256:
`BE0A62E1E340609F4779BDF0442AD5C682E32D69E04CCE72BD6B3F7E13905962`.

## Platform limitations

Chrome does not offer a storage ACL between trusted pages belonging to the same
extension origin. Exposure is reduced through session-only storage by default,
trusted-context storage access levels, a strict self-only extension CSP, no
remote code, masked status responses, and explicit confirmation before a key is
remembered.

After a user confirms an external hostname, Chrome controls DNS resolution and
HTTP redirects. The extension therefore removes sensitive URL material, blocks
unsafe literal destinations, requires HTTPS on port 443, shows the hostname,
and opens with `noopener,noreferrer`.

The package contains manual-odds research and remains limited-beta/sideload
only until a fresh Chrome Web Store policy and legal review approves it.

## Browser evidence

Chrome control reused the already-open signed-in Sleeper tab at the Big Bucks
predraft route. No additional visible Chrome profile or window was launched.
Loaded-extension browser validation ran headlessly and supplied the side-panel,
options, offline, accessibility, minimum-width, route-propagation, and full
manual-draft evidence.

## Re-review triggers

Repeat this review whenever manifest permissions, provider-key storage,
runtime-message capabilities, external sources, import formats, Sleeper API
routes, account identity, manual-odds behavior, or release infrastructure
changes.
