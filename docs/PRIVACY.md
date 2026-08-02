# Privacy

Not Sleeping has no analytics SDK, ad network, telemetry endpoint, account
service, or remote code loader.

## Data that stays local

Settings, watchlists, notes, imports, cached public data, usage counts, token
counts, demo state, and redacted diagnostics stay in the browser profile.
Uninstalling the extension removes extension-owned browser storage according
to Chrome behavior.

## Data sent to Sleeper

Requests contain only public identifiers needed for documented read-only
endpoints. No Sleeper password, session, or private token is requested.

## Data sent to OpenAI

Only after the user configures a key and requests/enables analysis, the
background sends the minimum player and league-format context needed for that
feature. Requests use the Responses API with `store: false`. Current research
may enable the `web_search` tool. The API key is transmitted only in the HTTPS
Authorization header to `api.openai.com`.

Review OpenAI's current API data controls and retention policy before enabling
the feature. `store: false` is a request-level control; it is not a promise
made by this project about provider infrastructure.

## Optional public data

nflverse enrichment is disabled by default. When enabled, the extension may
download a validated public roster release from GitHub. The data is treated as
untrusted, stored locally, and can be removed.

## Diagnostics

Diagnostic exports replace user/league/draft/roster identifiers, usernames,
URLs, prompts, raw responses, notes, credentials, and authorization-like
values. Users should still inspect any bundle before sharing it.
