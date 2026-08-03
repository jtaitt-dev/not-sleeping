# AI architecture

Not Sleeping is deterministic-first. Sleeper state and local models produce a
valid decision immediately. AI is a cancellable, nonblocking overlay and never
owns player availability, lineup legality, roster rules, bid limits, or an
external action.

`AiProvider` is implemented by OpenAI and Anthropic. The registry resolves a
provider without exposing credentials outside the background worker. Provider
adapters share strict structured requests, usage metadata, warnings, model
capabilities, retries, timeouts, and cancellation.

The decision pipeline is:

1. Validate and normalize the current candidate set.
2. Exclude unavailable, ineligible, or already-selected options.
3. Compute a deterministic score, confidence, and state hash.
4. Return that baseline immediately.
5. Apply local request/token/cost guards.
6. Run one provider or optional OpenAI + Anthropic consensus asynchronously.
7. Reject stale responses and invalid provider-selected IDs.
8. Present the bounded overlay, sources, risks, and provider warnings.

The provider prompt receives a compact, sanitized context and the already-valid
candidate list. It never receives an API key, raw Chrome storage, or hidden
system data. OpenAI web search is opt-in for Research. Anthropic does not claim
native web search in this adapter; unsupported controls are disclosed.

See [Realtime Decision Engine](REALTIME_DECISION_ENGINE.md),
[Multi-provider Setup](MULTI_PROVIDER_SETUP.md), and
[AI Validation](AI_VALIDATION.md).
