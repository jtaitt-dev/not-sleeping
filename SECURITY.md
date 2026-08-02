# Security Policy

## Supported versions

Security fixes are applied to the latest release and the default branch.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository:

`https://github.com/jtaitt-dev/not-sleeping/security/advisories/new`

Include the affected version, reproduction conditions, realistic impact, and
any suggested mitigation. Do not include real API keys, private league data,
or another person's identifiers. Please allow maintainers time to confirm and
coordinate a fix before public disclosure.

## Security invariants

- OpenAI credentials are entered only in the trusted options page.
- Credentials never appear in runtime messages, content scripts, logs,
  diagnostics, URLs, exports, source, or test fixtures.
- The background service worker is the only context that reads and uses a key.
- Session-only storage is the default. Remembered storage is explicit.
- Sleeper use is public and read-only.
- Remote code, `eval`, inline executable scripts, analytics SDKs, and
  unnecessary permissions are prohibited.
- External citations open only as validated HTTPS URLs without embedded
  credentials or local addresses.
- Model/web content is untrusted data and cannot change instructions, execute
  code, or gain extension capabilities.
- Social posts never become trusted because of follower counts or badges;
  contradictions, source class, timestamps, and expiry remain visible.
- League-dependent caches and responses carry an explicit league ID; UI state
  commits context and snapshot atomically to prevent cross-league leakage.
- Notification permission is optional and requested only from a user action.
  Private league details are excluded from lock-screen text by default.
- Imported projections and public datasets are size/schema validated, retain
  provenance, and cannot silently override unknown scoring categories.

Repository security guidance applies to all files below this root.
