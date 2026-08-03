# OpenAI Setup

Open **Settings → AI providers → OpenAI** and paste a dedicated OpenAI project key.
Session-only mode is selected by default and clears the key when the browser
session ends. The input is cleared after saving and only a masked key status is
shown.

Remembered mode stores the key in extension-local Chrome storage after an
explicit risk confirmation. Use it only on a trusted browser profile, set
project budgets and permissions, monitor usage, and rotate the key after any
suspected compromise.

Model choices are loaded from OpenAI's Models API. Global and per-feature
settings control model, reasoning effort, web search, timeout, token budget,
and optional consensus. Responses use the current Responses API with
`store: false` and strict structured output. Local ranking, imports,
watchlists, demo mode, and deterministic comparisons work without a key. See
[model behavior](MODELS.md) and [privacy](../PRIVACY.md).

Signing into ChatGPT is not API authorization and ChatGPT plan billing is
separate from API billing. See
[account limitations](ACCOUNT_LOGIN_LIMITATIONS.md).
