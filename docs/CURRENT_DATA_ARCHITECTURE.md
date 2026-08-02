# Current data architecture

The MV3 service worker is the provider boundary. It validates messages, obtains Sleeper state, retrieves Open-Meteo forecasts, reads optional nflverse release assets, and calls OpenAI only after user configuration. React workspaces never receive credentials. IndexedDB stores players, league catalogs, league-scoped workspaces, evidence, research, usage, and safe diagnostics.

`LeagueContext` is mandatory for league-dependent recommendations. Cache keys contain league ID, season, week, domain, and suffix. League switching uses an epoch and atomically commits matching context and snapshot, so delayed responses from an older league cannot appear below a newer header.

Provider paths:

- Sleeper: leagues, users, rosters, matchups, transactions, brackets, traded picks, drafts/picks, players, trending players, NFL state, and projections.
- nflverse: schedules, player weekly stats, weekly/season rosters, injuries/practice status, and depth charts from versioned GitHub releases.
- Open-Meteo: exact stadium coordinates and the forecast hour nearest kickoff; dome games receive no outdoor penalty.
- OpenAI: Responses API structured research with citation extraction and optional domain filters.
- Imports: schema-validated user projections/ranks with provenance and no executable content.

Freshness defaults range from three seconds for active draft picks to 24 hours for dynasty profiles. Each UI surface labels freshness; stale data is preserved for continuity but never called live.
