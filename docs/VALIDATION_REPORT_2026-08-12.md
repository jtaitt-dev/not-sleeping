# Not Sleeping v0.8.11 validation report

Date: 2026-08-12

Release candidate: `0.8.11`

Branch validated: `codex/league-overview-parity-v0.8.11`

## Outcome

The selected-League overview release candidate passed the complete local
phase-three gate. The extension remains read-only and every automated Sleeper
request is required to use GET. The destructive authenticated live-draft test
remains opt-in and was skipped.

## Selected-League verification

- The view rejects snapshots whose outer or embedded league ID does not match
  the active context.
- Team identity, canonical draft position, standing order, score decimals,
  waiver state, current-week transactions, and settings come from the selected
  snapshot.
- Snapshot hydration includes add/drop player IDs so a recently dropped player
  can retain a resolved identity even after leaving every current roster.
- Teams, standings, and activity expose named list/listitem relationships;
  settings use native description-list semantics.
- The production extension passes at 320, 375, 390, 768, 1024, 1440, and
  1920 px with no accidental horizontal overflow. The matrix verifies the
  measured 750 px desktop cap, 92/60/116+/72 px rows, 32/16 px avatars, and
  18/14/10/12 px typography roles.

## Release gate

| Validation                   | Result                                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| `pnpm format:check`          | PASS                                                               |
| `pnpm lint`                  | PASS — zero warnings                                               |
| `pnpm typecheck`             | PASS                                                               |
| Unit/integration tests       | PASS — 56 files passed, 1 skipped; 403 passed, 2 skipped           |
| Coverage                     | 79.26% statements, 68.27% branches, 79.74% functions, 81.59% lines |
| `pnpm test:performance:ci`   | PASS — 3/3                                                         |
| `pnpm test:simulations`      | PASS — smoke invariants                                            |
| `pnpm test:ai-evals`         | PASS — 10/10                                                       |
| `pnpm build`                 | PASS — Chrome MV3 production bundle                                |
| `pnpm assert:unified-bundle` | PASS — 39 files                                                    |
| `pnpm test:e2e`              | PASS — 17 passed, destructive authenticated test skipped           |
| `pnpm test:visual`           | PASS — 2/2                                                         |
| `pnpm audit:prod`            | PASS — no known vulnerabilities                                    |
| `pnpm zip` twice             | PASS — identical bytes                                             |

## Release artifact

- ZIP: `artifacts/not-sleeping-0.8.11.zip`
- Size: 577,144 bytes
- SHA-256 file: `artifacts/not-sleeping-0.8.11.sha256`
- SHA-256:
  `8df3238dd2dbd9f28f45bba32e2d69bd2d9a5fc9a06298082fe28db504b19368`

The archive is a limited-beta/sideload package. It is not approved for Chrome
Web Store submission without a new policy and legal review.

## Interpretation limits

- Selected-League activity is explicitly week-scoped because the supported
  public Sleeper transaction endpoint is addressed by NFL week.
- The current 2026 Matchup route redirected to Predraft, and the archived route
  exposed no inspectable matchup content. No matchup measurements were
  fabricated from those states.
- Authenticated screenshots containing private league teams, chat, or browser
  context remain local and are not part of the public release.
