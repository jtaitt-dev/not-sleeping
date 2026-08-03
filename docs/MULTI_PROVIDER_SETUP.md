# Multi-provider setup

Open **Settings → AI providers** and select OpenAI or Anthropic. Paste the key
only in that trusted extension page. Session-only storage is recommended and is
the default. Remembered storage requires explicit confirmation.

Keys are stored under separate provider-specific names, restricted to trusted
extension contexts, and read only by the background worker. One provider's key
is never sent to the other provider. Keys are excluded from runtime messages,
logs, diagnostics, exports, prompts, and content scripts.

Use **Test connection** to call the selected provider's documented Models API.
Under **Models & limits**, refresh dynamic models, choose a preset, and set
per-feature provider/model/routing/effort controls. `OpenAI + Anthropic`
consensus requires both keys; it safely degrades when only one succeeds.

Local analysis works with no key. Daily request, input-token, output-token, and
estimated-cost ceilings are local guardrails, not provider billing statements.
Provider console budgets remain authoritative.

Official references: [OpenAI API documentation](https://developers.openai.com/api/docs/)
and [Anthropic API documentation](https://platform.claude.com/docs/en/api/overview).
