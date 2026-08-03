import type { AiFeature, AiFeatureConfig, AppSettings } from "@/types/domain";

export function resolveFeatureConfig(
  settings: AppSettings,
  feature: AiFeature,
): AiFeatureConfig {
  const configured =
    settings.aiFeatureOverrides[feature] ?? settings.aiDefaults;
  if (settings.aiPreset === "custom") return { ...configured };
  if (settings.aiPreset === "economy") {
    return {
      ...configured,
      reasoningEffort: "low",
      thinkingMode: "off",
      maxOutputTokens: Math.min(configured.maxOutputTokens, 1_024),
      webSearch: feature === "research" && configured.webSearch,
    };
  }
  if (settings.aiPreset === "quality") {
    return {
      ...configured,
      routingMode: configured.routingMode === "off" ? "off" : "quality",
      reasoningEffort:
        configured.reasoningEffort === "none"
          ? "high"
          : configured.reasoningEffort,
      maxOutputTokens: Math.max(configured.maxOutputTokens, 4_096),
    };
  }
  return { ...configured };
}
