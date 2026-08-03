# Anthropic setup

Create a dedicated key in Anthropic Console, set an account budget, then add it
under **Settings → AI providers → Anthropic**. Prefer session-only storage.

The adapter uses documented `GET /v1/models` and `POST /v1/messages` requests
with `x-api-key` and `anthropic-version`. Structured output uses
`output_config.format`. Effort uses `output_config.effort`; thinking is a
separate `thinking` control. Unsupported model controls are omitted and shown
as warnings. HTTP 429 and 529 responses retry with bounded backoff while the
local decision stays usable.

The current adapter does not advertise Anthropic-native web search or native
citations. Research without a supplied evidence source must mark current facts
unknown and return no citations.

Remove the key from the same provider panel at any time.
