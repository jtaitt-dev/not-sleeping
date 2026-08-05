import type { ModelCapability } from "@/types/domain";

export function openAIModelCapability(id: string): ModelCapability {
  const current =
    id === "gpt-5.6" ||
    id.startsWith("gpt-5.6-sol") ||
    id.startsWith("gpt-5.6-terra") ||
    id.startsWith("gpt-5.6-luna");
  const gpt5 = id.startsWith("gpt-5");
  const reasoning = current || gpt5 || /^o\d/.test(id);
  return {
    id,
    provider: "openai",
    displayName: id,
    structuredOutput: current || gpt5 || id.startsWith("gpt-4o"),
    webSearch: current || gpt5,
    reasoning,
    streaming: true,
    thinking: false,
    reasoningEfforts: reasoning
      ? ["none", "low", "medium", "high", "xhigh", "max"]
      : [],
    thinkingModes: ["off"],
    priceClass: id.includes("luna")
      ? "low"
      : id.includes("sol")
        ? "high"
        : "standard",
  };
}

// Claude 4.5 and earlier take a fixed thinking budget. Adaptive thinking
// replaced it from 4.6 onward, and `budget_tokens` is rejected outright on
// 4.7 and later, so newer models must never be offered the budget mode.
const LEGACY_BUDGET_THINKING =
  /^claude-(?:2|instant|3|haiku-4-|(?:opus|sonnet)-4-[015](?:$|-))/;

// Effort arrived on Opus 4.5 (low/medium/high), gained `max` with the 4.6
// generation, and `xhigh` with 4.7. Sonnet 4.5 and Haiku 4.5 reject it.
const NO_EFFORT = /^claude-(?:2|instant|3|haiku-4-5|sonnet-4-5)/;
const LIMITED_EFFORT = /^claude-opus-4-5(?:$|-)/;
const NO_XHIGH_EFFORT = /^claude-(?:opus|sonnet)-4-6(?:$|-)/;

function anthropicThinkingModes(id: string): ModelCapability["thinkingModes"] {
  if (!id.startsWith("claude-")) return ["off"];
  return LEGACY_BUDGET_THINKING.test(id)
    ? ["off", "enabled"]
    : ["off", "adaptive"];
}

function anthropicReasoningEfforts(
  id: string,
): ModelCapability["reasoningEfforts"] {
  if (!id.startsWith("claude-") || NO_EFFORT.test(id)) return [];
  if (LIMITED_EFFORT.test(id)) return ["low", "medium", "high"];
  if (NO_XHIGH_EFFORT.test(id)) return ["low", "medium", "high", "max"];
  return ["low", "medium", "high", "xhigh", "max"];
}

export function anthropicModelCapability(id: string): ModelCapability {
  const claude = id.startsWith("claude-");
  const opus = id.includes("opus") || id.includes("fable");
  const haiku = id.includes("haiku");
  return {
    id,
    provider: "anthropic",
    displayName: id,
    structuredOutput: claude,
    webSearch: false,
    reasoning: claude,
    streaming: true,
    thinking: claude,
    reasoningEfforts: anthropicReasoningEfforts(id),
    thinkingModes: anthropicThinkingModes(id),
    priceClass: haiku ? "low" : opus ? "high" : "standard",
  };
}

export function supportsRequestedControls(
  capability: ModelCapability,
  input: {
    webSearch: boolean;
    reasoningEffort?: string;
    thinkingMode?: string;
  },
): string[] {
  const warnings: string[] = [];
  if (input.webSearch && capability.webSearch !== true) {
    warnings.push("This provider/model does not expose native web search.");
  }
  if (
    input.reasoningEffort &&
    !capability.reasoningEfforts?.includes(
      input.reasoningEffort as NonNullable<
        ModelCapability["reasoningEfforts"]
      >[number],
    )
  ) {
    warnings.push("The selected reasoning effort is not supported.");
  }
  if (
    input.thinkingMode &&
    !capability.thinkingModes?.includes(
      input.thinkingMode as NonNullable<
        ModelCapability["thinkingModes"]
      >[number],
    )
  ) {
    warnings.push("The selected thinking mode is not supported.");
  }
  return warnings;
}
