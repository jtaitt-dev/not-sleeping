# Mock Draft Lab

Mock Draft Lab runs locally and never creates or submits a Sleeper room. It supports snake, linear, 3RR, auction, manual/custom, keepers, traded pick owners, rookie/veteran pools, Superflex, TE premium, IDP, Best Ball, seeded opponent archetypes, pause/resume, undo/redo, and auto-complete.

Opponent archetypes include ADP, best available, positional need, Zero/Hero RB, early/late QB, TE premium, Superflex QB hoarder, dynasty youth/contender/productive struggle, IDP early, homer, and random-within-tier. All are reproducible by seed.

The live ranking path and Mock Draft Lab call the same `rankDraftCandidates` engine. Live rankings retain additional explainable Phase 1 factors as a bounded layer. `pnpm test:simulations` runs a smoke matrix; `pnpm test:simulations:exhaustive` runs 5,000 complete seeded drafts and writes JSON/Markdown reports.
