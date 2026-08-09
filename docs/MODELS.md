# Models and OpenAI Behavior

OpenAI features are optional. Local rankings and all Sleeper data remain
available without a key.

## Selection

The options page can load compatible model IDs dynamically from `GET /v1/models`.
Manual model IDs allow new compatible models without an extension release.
The initial defaults are:

- Routine structured analysis: `gpt-5.6-luna`
- Deeper current research: `gpt-5.6-sol`

Capability checks determine structured-output, web-search, and reasoning
support. A valid existing user preference is preserved when the provider still
reports it. An invalid or removed OpenAI model falls back to Luna before a
request is sent; if neither the chosen model nor Luna is available, the local
deterministic result remains usable and the provider request is not attempted.
The active model and routing state are visible on every intelligence card.

## Responses API contract

- Direct `fetch` to `https://api.openai.com/v1/responses`
- `store: false`
- strict JSON Schema in `text.format`
- `web_search` only for current-fact research
- `web_search_call.action.sources` included when research uses search
- API-reported input/output/total token counts recorded locally
- no speculative cost calculation

The system instruction treats web content as untrusted data. It forbids
following source instructions, revealing secrets, executing code, or
fabricating citations. Source URLs must be present in provider annotations and
pass external HTTPS validation.

## Reliability controls

The background queue defaults to one concurrent request and four requests per
minute, with hard ceilings of two and twelve. Identical active or queued work
is deduplicated. Requests use `AbortController`, configurable timeout, bounded
exponential backoff with jitter, and `Retry-After` support.

Authentication, quota, permission, unsupported-model, malformed request, and
validation failures are not blindly retried. A formatting-only schema failure
gets one repair attempt.

Official references:

- https://developers.openai.com/api/docs/guides/responses
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/models
