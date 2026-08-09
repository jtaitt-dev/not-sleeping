# Mock Draft

Mock Draft runs locally and never creates, joins, edits, or submits a Sleeper
room. Its setup is derived from the selected account, league, and draft: team
count, rounds, slot order when Sleeper provides one, roster slots, draft style,
player pool, scoring modes, position limits, keepers, and traded-pick ownership.
The UI always distinguishes original draft slot from current pick owner.

Manual entry is the default and records every team selection one pick at a
time—there is no implicit autopick. Each entry is rejected if the player is
already drafted, outside the verified rookie/veteran/IDP pool, already rostered
in a dynasty or rookie league, or blocked by a league position limit. After
every pick, invariants validate sequential order, snake/linear/3RR coordinates,
traded ownership, duplicate prevention, roster limits, and player-pool
isolation.

When Sleeper has not assigned draft order, the extension does not infer one. It
labels the uncertainty and asks for a local-only slot. Sessions are stored under
an account/league/draft key and restored only if their validated configuration
fingerprint and player pool still match.

The deterministic candidate engine remains the source of truth. An optional AI
overlay is off by default and cannot submit a selection. Pause/resume, undo,
redo, and a two-step local reset are supported. Existing seeded opponent
archetypes and explicit auto-complete remain available to simulation tooling,
not the default entry workflow.

`pnpm test:simulations` runs a smoke matrix; `pnpm
test:simulations:exhaustive` runs 5,000 complete seeded drafts and writes
JSON/Markdown reports.
