# Parlay Lab

Parlay Lab exists only in the separate Not Sleeping Labs sideload build. It is
an opt-in research calculator for current manual entries, user imports, or
licensed-source values supplied by the user. Each usable leg requires a market,
line, price, source, book or consensus identifier, timestamp, estimated
probability, and uncertainty. The calculator converts American prices,
de-vigs two-sided markets when the opposite price is available, reports market
hold, applies a visible conservative correlation penalty, and shows probability,
edge-range, uncertainty, freshness, and return-index math.

The default player pool is the selected Sleeper team's current legal starters
for the selected week. The user can optionally include bench players, opponent
starters, and players on the Not Sleeping watchlist. Sleeper injury or inactive
status and a changed legal lineup invalidate affected legs. Missing prices or
prices older than 30 minutes produce a **Prop Research Watchlist**, not a
constructed candidate. Eligible positive-value inputs may produce conservative,
balanced, and higher-variance 2–4-leg research candidates; otherwise the result
is exactly **No responsible parlay found**.

The feature does not fetch odds in this release, discover or invent markets,
link to operators, place an action, choose a monetary amount, claim guaranteed
positive expectation, or promise an outcome. Before the workspace is available,
the user must affirm they are 21 or older and acknowledge responsibility for
their jurisdiction. A 24-hour cooldown cannot be ended early from the screen,
and permanent disable is available. Only those safeguard preferences are
stored; supplied scenarios and sensitive history are not persisted.

Core replaces the Labs module at build resolution time. CI scans the Core
bundle for Labs-only strings and uploads separate Core and Labs artifacts.
