# Contributing

Thank you for helping improve Not Sleeping.

## Development

Use Node 22 and pnpm 11. Fork the repository, create a focused branch, and run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm validate
```

Keep changes local-first, read-only with respect to Sleeper, and compatible
with Chrome MV3. Do not add remote code, analytics SDKs, secrets, copied player
headshots, or write-capable Sleeper behavior.

## Pull requests

Describe the user outcome, important security or privacy changes, and the
verification performed. Add or update tests for behavior changes. UI changes
should include a side-panel screenshot at a representative 320–600px width.

Dependencies must be pinned, justified, and reflected in `pnpm-lock.yaml`.
New permissions or host permissions require an architecture and threat-model
update.

## Reporting security issues

Do not open a public issue for a suspected vulnerability. Follow
[SECURITY.md](SECURITY.md).
