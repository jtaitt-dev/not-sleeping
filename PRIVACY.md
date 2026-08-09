# Privacy

Not Sleeping has no developer-operated backend, analytics, advertising,
telemetry endpoint, account service, or remote executable-code loader. The
developer does not receive the user's OpenAI or Anthropic key.

Settings, watchlists, notes, imports, cached data, usage counts, demo state,
per-league workspace state, source preferences, alert rules, and redacted diagnostics remain in the user's browser profile. Sleeper
requests go directly to Sleeper's public read-only API. Optional public-data
requests go directly to the enabled source.

When a user invokes an AI feature, the extension sends the selected provider's
key directly to `api.openai.com` or `api.anthropic.com` over HTTPS along with
the minimum relevant prompt, player, and league context. OpenAI Responses API
requests set `store: false`. Users should review the selected provider's
current data controls because this project cannot make guarantees about
provider infrastructure.

Session-only key storage is the recommended default. Remembering a key is an
explicit opt-in and has ordinary client-side storage risk: a person, malicious
extension, or malware with sufficient local access may be able to extract it.
Credentials are excluded from messages, logs, exports, IndexedDB, and
diagnostics.

Optional browser notifications require a separate user gesture. Quiet hours,
deduplication, per-league rules, and privacy-safe generic text are local.
Private league details are included only after an explicit per-league opt-in.
The browser must be running; alerts are not guaranteed remote infrastructure.

The selected AI provider receives only minimized structured decision context,
never an entire league history when a smaller input is sufficient. Public
social coverage is best-effort and does not involve logging into X or scraping
authenticated pages.

Advanced Research is disabled by default. Its global acknowledgement timestamp
and enable flag, plus Manual Odds Research cooldown/disable preferences, remain
local. User-supplied scenarios are held in memory and are not persisted. The
feature does not contact an odds provider or operator.

Not Sleeping is independent and is not affiliated with, endorsed by, or
sponsored by Sleeper, OpenAI, Anthropic, the NFL, or nflverse. See
[the detailed privacy notes](docs/PRIVACY.md) and [security policy](SECURITY.md).
