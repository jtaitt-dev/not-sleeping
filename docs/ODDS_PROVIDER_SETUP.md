# Odds provider setup

There is no odds-provider network adapter or provider-key setting in this
release. Parlay Lab accepts current values manually entered by the user,
including values copied from a user import or licensed source. Selecting a
source type records provenance on the in-memory scenario; it does not contact
that provider. The extension does not scrape, infer, refresh, or invent markets,
and it does not retain the scenario after the page is closed.

Each usable entry requires the supplied market and line, current American price,
estimated probability and uncertainty, source name, book or consensus
identifier, and timestamp. An opposite-side price is optional and enables
de-vig and hold calculations. Prices older than 30 minutes or entries without
complete provenance stay in the **Prop Research Watchlist** and cannot become a
candidate.

Any future odds adapter must be explicitly configured, licensed for the user's
jurisdiction and use case, timestamp every value, preserve the original source,
handle stale/missing markets, avoid affiliate links, and pass a new privacy,
legal, security, and Core-bundle isolation review. It must never silently fall
back to model-generated odds.
