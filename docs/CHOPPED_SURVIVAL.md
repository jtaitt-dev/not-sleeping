# Chopped Survival

The Chopped Survival workspace models weekly elimination as a composable league capability. It never identifies a Chopped league from its name. It uses an explicit Sleeper setting when present or a per-league manual override when the commissioner rule is not represented by Sleeper.

The workspace shows every active roster, projected final range, probability of finishing last, survival probability, distance from the current safety line, remaining-player impact, injury exposure, and FAAB remaining. It excludes rosters carrying an explicit eliminated marker and watches completed drops attributable to those rosters.

Guidance changes between floor-first, balanced, and ceiling-required approaches. FAAB text weighs immediate survival risk against field budgets and modeled future release quality. Trade-disabled leagues receive waiver-only guidance. Chopped Best Ball combines the survival distribution with automatic legal-lineup, depth, ceiling, correlation, and resilience language; it does not show manual start/sit instructions.

Sleeper does not consistently expose commissioner-defined elimination markers or tiebreakers. When those values are absent, Not Sleeping labels the limitation, retains the raw settings in Diagnostics, and asks the user to confirm a local override. It never invents a tiebreak rule or submits a lineup, claim, trade, or roster move.

The model is documented in [Chopped model](models/CHOPPED_MODEL.md).
