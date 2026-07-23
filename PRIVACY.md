# Privacy

Not Sleeping has no developer-operated backend, analytics, advertising,
telemetry endpoint, account service, or remote executable-code loader. The
developer does not receive the user's OpenAI key.

Settings, watchlists, notes, imports, cached data, usage counts, demo state,
and redacted diagnostics remain in the user's browser profile. Sleeper
requests go directly to Sleeper's public read-only API. Optional public-data
requests go directly to the enabled source.

When a user invokes an OpenAI feature, the extension sends their key directly
to `api.openai.com` over HTTPS along with the minimum relevant prompt, player,
and league context. Responses API requests set `store: false`. Users should
review OpenAI's current API data controls because this project cannot make
guarantees about provider infrastructure.

Session-only key storage is the recommended default. Remembering a key is an
explicit opt-in and has ordinary client-side storage risk: a person, malicious
extension, or malware with sufficient local access may be able to extract it.
Credentials are excluded from messages, logs, exports, IndexedDB, and
diagnostics.

Not Sleeping is independent and is not affiliated with, endorsed by, or
sponsored by Sleeper, OpenAI, the NFL, or nflverse. See
[the detailed privacy notes](docs/PRIVACY.md) and [security policy](SECURITY.md).
