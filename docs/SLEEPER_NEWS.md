# Sleeper player news and metadata

Not Sleeping uses Sleeper's documented public, read-only `/v1/players/nfl`
player dataset. The dedicated player-context provider exposes team, status,
injury designation, `news_updated` when present, retrieval time, and a content
fingerprint.

The current public Sleeper documentation does not provide a complete documented
article/news-feed endpoint. Not Sleeping therefore does not invent one, call
private endpoints, intercept authenticated traffic, or label third-party news
as Sleeper-authored. `news_updated` is an invalidation signal, not article text.

When team, status, injury designation, or `news_updated` changes, cached player
research and evidence involving that player are invalidated. The next requested
analysis must refresh evidence. Source drawers distinguish Sleeper metadata
from external public evidence and show retrieval/freshness information.

Official reference: [Sleeper API documentation](https://docs.sleeper.com/).
