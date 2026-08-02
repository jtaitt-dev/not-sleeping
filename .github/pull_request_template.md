## Outcome

Describe the user-visible or maintenance outcome.

## Security and privacy

List permission, provider, storage, message, import, or data-flow changes.

## Verification

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test:coverage`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] `pnpm test:visual`
- [ ] `pnpm test:simulations`
- [ ] `pnpm test:simulations:exhaustive` when league/draft capability behavior changes
- [ ] `pnpm test:backtest` when recommendation logic changes
- [ ] `pnpm audit:prod`
- [ ] Screenshots reviewed when UI changed

## Compatibility and model claims

- [ ] Unknown Sleeper settings/scoring/slots are retained and diagnosed
- [ ] New recommendations carry an explicit league context and read-only boundary
- [ ] Current-data claims include source and freshness behavior
- [ ] Validation limitations are documented without overstating real Sleeper or provider coverage
