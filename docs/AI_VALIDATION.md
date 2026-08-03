# AI validation

`pnpm test:ai-evals` runs sanitized deterministic fixtures without credentials
and writes `artifacts/ai-eval-report.json` and `.md`. The gate checks legal
candidate preservation, deterministic state hashes, score bounds, confidence
bounds, and expected recommendations across draft, Start/Sit, waivers, trades,
rookie, taxi, IDP, auction, Chopped, and keeper scenarios.

Provider contract tests mock OpenAI and Anthropic. They verify key isolation,
headers, dynamic model parsing, strict structured output, effort/thinking
separation, usage, capability warnings, and invalid-recommendation fallback.
CI never uses user credentials.

Browser tests load Core from `dist/core`; bundle tests prove Labs-only code is
absent from Core. Performance uses warmed median and p95 reports. A manual live
provider smoke test is optional and must use the developer's own keys and
provider budgets; it is not a release prerequisite.
