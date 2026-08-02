# Architecture

Not Sleeping is a local-first WXT Manifest V3 Chrome extension with no
developer-operated backend. Its trusted service worker is the only surface
that performs provider requests or reads an OpenAI API key.

```text
Sleeper page
    ↓ sanitized, versioned runtime messages
Content script
    ↓ capability-checked runtime messages
MV3 service worker
    ├── Sleeper public read-only API
    ├── OpenAI Responses API with the user's key
    ├── optional nflverse schedules/stats/rosters/injuries/depth charts
    ├── Open-Meteo stadium forecasts
    ├── IndexedDB through Dexie
    └── trusted-context Chrome storage
    ↓
Side panel workspaces, popup, and options UI
```

React and strict TypeScript power the extension surfaces. Zustand owns
transient UI and demo state, TanStack Query owns request lifecycle policy, Zod
validates every external and runtime boundary, and pure services implement
mode detection, scoring, identity resolution, rankings, draft availability,
and trade calculations. An explicit `LeagueContext` and league-scoped cache key
are required by full-season recommendation services. Rapid switching uses an
epoch and atomically commits context plus matching snapshot. The side panel consumes cache-first data and remains
usable without OpenAI or a network connection.

The content script runs only on supported Sleeper origins, observes SPA
navigation, sends sanitized route context, and provides an optional launcher.
It does not scrape the draft board, read credentials, or expose privileged
methods. Sleeper integration is read-only and cannot submit picks or roster
actions.

The live draft and Mock Draft Lab share `rankDraftCandidates`; mock sessions
add deterministic opponent agents, draft-order state, keepers, trades, and
auction accounting. Historical validation and simulations run outside the
extension runtime and emit reviewable artifacts.

See [the detailed architecture](docs/ARCHITECTURE.md),
[data flow](docs/DATA_FLOW.md), [threat model](docs/THREAT_MODEL.md), and
[component inventory](docs/UI_COMPONENT_INVENTORY.md).
