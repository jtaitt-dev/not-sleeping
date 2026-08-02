# Architecture

## Runtime surfaces

Not Sleeping is a WXT-built Chrome Manifest V3 extension:

- `background.ts` owns external requests, provider queues, live polling,
  cache maintenance, diagnostics, and all secret use.
- `content.ts` detects supported Sleeper routes and injects a small launcher.
  It has no API-key code path.
- `sidepanel/` provides the main React workspace.
- `popup/` reports public status and opens the side panel.
- `options/` is the trusted settings and credential-entry surface.
- `workers/import.worker.ts` isolates larger local import parsing.

React runs in strict mode. Zustand holds transient decision and demo state,
TanStack Query supplies request lifecycle policy, Dexie owns structured local
data, and Zod validates settings, provider responses, and runtime messages.

## Layering

```text
UI workspaces
    │
    ├── local deterministic services ── ranking / identity / trade / imports
    │
    └── versioned runtime protocol
                  │
             background worker
              ├── Sleeper provider ── public read-only HTTPS
              ├── OpenAI provider ─── optional BYOK HTTPS
              └── Dexie / Chrome storage
```

UI code does not call external providers directly. Provider response shapes are
validated before they reach product state. Errors become typed, safe
`AppError` objects with retry and recovery guidance.

## Live draft lifecycle

The side panel opens a runtime Port while it consumes live draft state.
The background controller polls active picks at a three-second cadence and
backs off when the panel disconnects, the document is hidden, the browser is
offline, or the draft is complete. Route updates come from history,
`popstate`, hash, Navigation API events when available, and a visible-page
fallback timer.

## Local-first analysis

The deterministic engine combines imported rank/tier/ADP/projection inputs
with league mode, scoring, roster need, positional scarcity, replacement
levels, age curves, NFL draft capital, injury risk, and estimated next-pick
availability. OpenAI research can adjust this baseline only within a bounded
range and never replaces the local source of truth.

## Build output

`pnpm build` creates WXT output and copies the production extension to `dist`.
Production source maps are rejected. `pnpm zip` creates a versioned archive
and SHA-256 checksum under `artifacts`.
