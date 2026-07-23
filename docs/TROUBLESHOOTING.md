# Troubleshooting

## The side panel does not open

Confirm Chrome 116+, reload the unpacked extension, and refresh the Sleeper tab.
The in-page launcher appears only on supported HTTPS Sleeper origins.

## Sleeper data is stale

Not Sleeping preserves usable cached data during outages. Open Diagnostics,
confirm connectivity, then refresh context or clear the relevant cache.
Sleeper requests are intentionally rate limited.

## OpenAI research is unavailable

Local analysis still works. In Settings, confirm that a key is configured,
test the connection, refresh model IDs, and review the typed error:

- invalid key: replace the dedicated project key
- insufficient quota: review the OpenAI project budget/limits
- permission or unsupported model: choose a compatible model
- rate limit: wait for the local queue and reduce limits
- offline/provider outage: continue with cached/local features

## An import is rejected

Use CSV or JSON under 5 MB, keep rows scalar and below limits, provide a player
ID or name, and review the reported row/column. Archives and executable
signatures are deliberately rejected.

## Reporting a problem

Export redacted diagnostics, inspect the file, and attach only what you are
comfortable sharing. Never post an API key or private league information.
Security problems follow `SECURITY.md`.
