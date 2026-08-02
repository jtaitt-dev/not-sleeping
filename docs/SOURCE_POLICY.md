# Source and evidence policy

The default trust order is official Sleeper/league state, official NFL status, official team reports, official transactions, direct statements, established national reporters, local beat reporters, corroborated reputable outlets, public social posts, and unverified discussion. Popularity, verification badges, and follower counts do not establish truth.

Every normalized evidence item records its class, URL, publisher, author when available, publication/retrieval/event timestamps, player/team IDs, claim type and text, confidence, freshness, corroboration, contradictions, citation, expiry, raw-source hash, and whether it is fact, report, opinion, projection, or inference. Unsafe URLs and instruction-like prompt injection are rejected. Contradictions reduce confidence; uncited AI-only adjustments are capped.

Users can edit trusted and blocked domains, trusted reporters/social handles, muted reporters, and muted topics in Settings. Public social discovery is best-effort through compliant web search. The extension never logs into X, scrapes authenticated pages, bypasses access controls, or embeds an X token. Optional official X support is disabled by default and is not required for core operation.

OpenAI research uses the Responses API, strict structured output, `store: false`, complete returned source lists, safe clickable citations, and current `web_search`. Official-only passes send validated `filters.allowed_domains`; broad-news passes remain separately labeled. Page instructions are untrusted data. Research is cached and rate-limited and receives only minimized decision context.

Default public paths are Sleeper's read-only API, Open-Meteo, nflverse release assets, user imports, and the user's optional OpenAI key. nflverse is CC-BY-4.0 at the repository level; underlying data remains subject to its owners' terms.
