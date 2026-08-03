# Draft copilot

The draft copilot reads the current Sleeper board and never submits a pick.
Candidate generation removes drafted, hidden, unavailable, and ineligible
players before scoring. The local model combines format, roster construction,
scarcity, replacement value, risk, strategy, and imported values.

Next-pick survival uses deterministic simulation from pick horizon, ADP, tier
pressure, positional demand, and optional opponent profiles. The card shows the
valid recommendation, confidence, short reasons, and survival estimate before
any provider call finishes.

AI can summarize context, identify bounded risks, and compare valid candidates.
It cannot re-add a drafted player or make a Sleeper action. Manual mock drafts
and real draft rooms use the same validity invariants.
