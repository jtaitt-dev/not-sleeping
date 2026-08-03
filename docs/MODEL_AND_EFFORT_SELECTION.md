# Model and effort selection

Model IDs are fetched from each provider's documented Models API and cached for
one hour. Manual IDs remain available for newly released models. Unknown models
must not silently inherit guessed capabilities.

Presets:

- Economy lowers effort and caps output at 1,024 tokens.
- Balanced uses the configured defaults.
- Quality raises the output allowance and avoids `none` effort.
- Custom preserves every global and per-feature control.

OpenAI reasoning effort and Anthropic effort use the common `none`, `low`,
`medium`, `high`, `xhigh`, and `max` UI vocabulary where supported. Anthropic
thinking (`off`, `enabled`, `adaptive`) remains separate. A control absent from
a model capability record is omitted with a visible warning.

Consensus runs both providers independently and keeps the deterministic answer
when they disagree. It costs two requests and should be reserved for close or
high-impact decisions.
