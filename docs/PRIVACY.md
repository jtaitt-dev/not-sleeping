# Privacy

Not Sleeping has no analytics SDK, ad network, telemetry endpoint, account
service, or remote code loader.

## Data that stays local

Settings, watchlists, notes, imports, cached public data, usage counts, token
counts, demo state, Advanced Research gate preferences, and redacted
diagnostics stay in the browser profile. Manual-odds scenarios are not
persisted.
Uninstalling the extension removes extension-owned browser storage according
to Chrome behavior.

## Data sent to Sleeper

Requests contain only public identifiers needed for documented read-only
endpoints. No Sleeper password, session, or private token is requested.

## Data sent to AI providers

Only after the user configures a key and requests/enables analysis, the
background sends the minimum player and league-format context needed for that
feature. OpenAI requests use the Responses API with `store: false`; Anthropic
requests use its Messages API. Current research may enable supported provider
research tools. Each API key is transmitted only in the HTTPS authentication
header to its own provider endpoint.

Review the selected provider's current API data controls and retention policy
before enabling the feature. `store: false` is an OpenAI request-level control;
it is not a promise made by this project about provider infrastructure.

## Manual odds research

Advanced Research is hidden and locked by default and requires an explicit
informational-use acknowledgement plus enable flag. The Manual Odds Research
workspace separately requires 21+ and jurisdiction acknowledgements. It does
not fetch odds, contact operators, persist supplied scenarios, or expose stake,
affiliate, or action controls. Only acknowledgement, cooldown, and disable
preferences remain local.

## Optional public data

nflverse enrichment is disabled by default. When enabled, the extension may
download a validated public roster release from GitHub. The data is treated as
untrusted, stored locally, and can be removed.

## Diagnostics

Diagnostic exports replace user/league/draft/roster identifiers, usernames,
URLs, prompts, raw responses, notes, credentials, and authorization-like
values. Users should still inspect any bundle before sharing it.
