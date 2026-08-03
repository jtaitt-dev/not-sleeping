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

export function anthropicModelCapability(id: string): ModelCapability {
  const claude = id.startsWith("claude-");
  const opus = id.includes("opus");
  const haiku = id.includes("haiku");
  const adaptiveThinking =
    /claude-(?:opus|sonnet)-4-(?:6|5)/.test(id) ||
    /claude-(?:opus|sonnet)-4\.6/.test(id);
  return {
    id,
    provider: "anthropic",
    displayName: id,
    structuredOutput: claude,
    webSearch: false,
    reasoning: claude,
    streaming: true,
    thinking: claude,
    reasoningEfforts: opus
      ? ["low", "medium", "high", "xhigh", "max"]
      : ["low", "medium", "high"],
    thinkingModes: adaptiveThinking
      ? ["off", "enabled", "adaptive"]
      : ["off", "enabled"],
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
