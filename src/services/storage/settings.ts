import { z } from "zod";

import type { AiFeatureConfig, AppSettings } from "@/types/domain";
import {
  isModelIdentifierShapeValid,
  LUNA_MODEL_ID,
} from "@/services/intelligence/model-selection";

export const APP_SETTINGS_KEY = "appSettings";

const aiProviderSchema = z.enum(["openai", "anthropic"]);
const aiReasoningEffortSchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
const aiThinkingModeSchema = z.enum(["off", "enabled", "adaptive"]);
const aiFeatureConfigSchema = z.object({
  provider: aiProviderSchema,
  model: z.string().min(1).max(160),
  consensusModels: z.object({
    openai: z.string().min(1).max(160),
    anthropic: z.string().min(1).max(160),
  }),
  routingMode: z.enum(["off", "manual", "balanced", "quality", "consensus"]),
  reasoningEffort: aiReasoningEffortSchema,
  thinkingMode: aiThinkingModeSchema,
  maxOutputTokens: z.number().int().min(256).max(64_000),
  timeoutMs: z.number().int().min(10_000).max(180_000),
  webSearch: z.boolean(),
});
const aiFeatureSchema = z.enum([
  "draft",
  "start_sit",
  "matchup",
  "waiver",
  "trade",
  "dynasty",
  "rookie",
  "taxi",
  "idp",
  "auction",
  "best_ball",
  "chopped",
  "keeper",
  "research",
]);

export const appSettingsSchema = z
  .object({
    settingsVersion: z.number().int().min(1),
    onboardingComplete: z.boolean(),
    sleeperUsername: z.string().max(64),
    sleeperUserId: z.string().max(32),
    defaultMode: z.enum([
      "redraft",
      "keeper",
      "dynasty_startup",
      "dynasty_rookie",
      "best_ball",
      "unknown",
    ]),
    modeOverrides: z.record(
      z.string().max(80),
      z.enum([
        "redraft",
        "keeper",
        "dynasty_startup",
        "dynasty_rookie",
        "best_ball",
        "unknown",
      ]),
    ),
    defaultStrategy: z.enum([
      "contender",
      "balanced",
      "productive_struggle",
      "rebuild",
    ]),
    riskTolerance: z.number().min(0).max(1),
    researchDepth: z.enum(["quick", "standard", "deep"]),
    automaticAnalysis: z.boolean(),
    advancedResearchAcknowledgedAt: z.number().int().positive().nullable(),
    advancedResearchEnabled: z.boolean(),
    maxRequestsPerMinute: z.number().int().min(1).max(12),
    maxConcurrency: z.number().int().min(1).max(2),
    maxOutputTokens: z.number().int().min(256).max(16_384),
    requestTimeoutMs: z.number().int().min(10_000).max(180_000),
    routineModel: z.string().min(1).max(120),
    researchModel: z.string().min(1).max(120),
    manualModelIds: z.array(z.string().min(1).max(120)).max(20),
    aiPreset: z.enum(["economy", "balanced", "quality", "custom"]),
    aiDefaults: aiFeatureConfigSchema,
    aiFeatureOverrides: z.partialRecord(aiFeatureSchema, aiFeatureConfigSchema),
    aiBudgets: z.object({
      maxRequestsPerMinute: z.number().int().min(1).max(60),
      maxConcurrency: z.number().int().min(1).max(4),
      dailyRequestLimit: z.number().int().min(1).max(10_000),
      dailyInputTokenLimit: z.number().int().min(1_000).max(100_000_000),
      dailyOutputTokenLimit: z.number().int().min(1_000).max(100_000_000),
      dailyCostCeilingUsd: z.number().min(0).max(1_000),
    }),
    anthropicManualModelIds: z.array(z.string().min(1).max(160)).max(20),
    enablePublicData: z.boolean(),
    theme: z.enum(["dark", "light", "system", "high_contrast"]),
    reducedMotion: z.boolean(),
    highContrast: z.boolean(),
    launcherEnabled: z.boolean(),
    launcherPosition: z.enum(["bottom_left", "bottom_right"]),
    logLevel: z.enum(["debug", "info", "warning", "error"]),
  })
  .refine(
    (settings) =>
      !settings.advancedResearchEnabled ||
      settings.advancedResearchAcknowledgedAt !== null,
    {
      message: "Advanced research requires explicit acknowledgement.",
      path: ["advancedResearchEnabled"],
    },
  );

export const DEFAULT_SETTINGS: AppSettings = {
  settingsVersion: 4,
  onboardingComplete: false,
  sleeperUsername: "",
  sleeperUserId: "",
  defaultMode: "unknown",
  modeOverrides: {},
  defaultStrategy: "balanced",
  riskTolerance: 0.5,
  researchDepth: "standard",
  automaticAnalysis: false,
  advancedResearchAcknowledgedAt: null,
  advancedResearchEnabled: false,
  maxRequestsPerMinute: 4,
  maxConcurrency: 1,
  maxOutputTokens: 2048,
  requestTimeoutMs: 60_000,
  routineModel: LUNA_MODEL_ID,
  researchModel: "gpt-5.6-sol",
  manualModelIds: [],
  aiPreset: "balanced",
  aiDefaults: {
    provider: "openai",
    model: LUNA_MODEL_ID,
    consensusModels: {
      openai: LUNA_MODEL_ID,
      anthropic: "claude-sonnet-4-6",
    },
    routingMode: "balanced",
    reasoningEffort: "medium",
    thinkingMode: "off",
    maxOutputTokens: 2048,
    timeoutMs: 60_000,
    webSearch: false,
  },
  aiFeatureOverrides: {
    research: {
      provider: "openai",
      model: "gpt-5.6-sol",
      consensusModels: {
        openai: "gpt-5.6-sol",
        anthropic: "claude-sonnet-4-6",
      },
      routingMode: "quality",
      reasoningEffort: "high",
      thinkingMode: "off",
      maxOutputTokens: 4096,
      timeoutMs: 90_000,
      webSearch: true,
    },
  },
  aiBudgets: {
    maxRequestsPerMinute: 4,
    maxConcurrency: 1,
    dailyRequestLimit: 100,
    dailyInputTokenLimit: 1_000_000,
    dailyOutputTokenLimit: 250_000,
    dailyCostCeilingUsd: 10,
  },
  anthropicManualModelIds: [],
  enablePublicData: false,
  theme: "dark",
  reducedMotion: false,
  highContrast: false,
  launcherEnabled: true,
  launcherPosition: "bottom_right",
  logLevel: "warning",
};

export async function getSettings(): Promise<AppSettings> {
  if (!hasChromeStorage()) {
    return structuredClone(DEFAULT_SETTINGS);
  }
  const result = await chrome.storage.local.get(APP_SETTINGS_KEY);
  return migrateSettings(result[APP_SETTINGS_KEY]);
}

export function migrateSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(DEFAULT_SETTINGS);
  }
  const legacy = value as Omit<Partial<AppSettings>, "aiDefaults"> & {
    aiDefaults?: Partial<AiFeatureConfig>;
  };
  const defaults = structuredClone(DEFAULT_SETTINGS);
  const routineModel = isModelIdentifierShapeValid(
    "openai",
    legacy.routineModel,
  )
    ? legacy.routineModel
    : LUNA_MODEL_ID;
  const defaultProvider = legacy.aiDefaults?.provider ?? "openai";
  const requestedDefaultModel =
    legacy.aiDefaults?.model ??
    (defaultProvider === "openai" ? routineModel : defaults.aiDefaults.model);
  const defaultModel = isModelIdentifierShapeValid(
    defaultProvider,
    requestedDefaultModel,
  )
    ? requestedDefaultModel
    : LUNA_MODEL_ID;
  const advancedResearchAcknowledgedAt =
    typeof legacy.advancedResearchAcknowledgedAt === "number" &&
    Number.isInteger(legacy.advancedResearchAcknowledgedAt) &&
    legacy.advancedResearchAcknowledgedAt > 0
      ? legacy.advancedResearchAcknowledgedAt
      : null;
  const candidate = {
    ...defaults,
    ...legacy,
    settingsVersion: DEFAULT_SETTINGS.settingsVersion,
    routineModel,
    advancedResearchAcknowledgedAt,
    advancedResearchEnabled:
      advancedResearchAcknowledgedAt !== null &&
      legacy.advancedResearchEnabled === true,
    aiDefaults: {
      ...defaults.aiDefaults,
      ...(legacy.aiDefaults ?? {}),
      provider: defaultProvider,
      model: defaultModel,
      consensusModels: {
        ...defaults.aiDefaults.consensusModels,
        ...(legacy.aiDefaults?.consensusModels ?? {}),
        openai: isModelIdentifierShapeValid(
          "openai",
          legacy.aiDefaults?.consensusModels?.openai,
        )
          ? legacy.aiDefaults.consensusModels.openai
          : defaults.aiDefaults.consensusModels.openai,
      },
    },
    aiFeatureOverrides: {
      ...defaults.aiFeatureOverrides,
      ...Object.fromEntries(
        Object.entries(legacy.aiFeatureOverrides ?? {}).map(
          ([feature, config]) => [
            feature,
            {
              ...defaults.aiDefaults,
              ...config,
              consensusModels: {
                ...defaults.aiDefaults.consensusModels,
                ...config.consensusModels,
              },
            },
          ],
        ),
      ),
    },
    aiBudgets: {
      ...defaults.aiBudgets,
      ...(legacy.aiBudgets ?? {}),
    },
  };
  const parsed = appSettingsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : defaults;
}

export async function saveSettings(
  settings: AppSettings,
): Promise<AppSettings> {
  const parsed = appSettingsSchema.parse(settings);
  if (!hasChromeStorage()) return parsed;
  await chrome.storage.local.set({ [APP_SETTINGS_KEY]: parsed });
  return parsed;
}

export async function resetSettings(): Promise<AppSettings> {
  if (!hasChromeStorage()) {
    return structuredClone(DEFAULT_SETTINGS);
  }
  await chrome.storage.local.set({
    [APP_SETTINGS_KEY]: structuredClone(DEFAULT_SETTINGS),
  });
  return structuredClone(DEFAULT_SETTINGS);
}

function hasChromeStorage(): boolean {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  if (!chromeValue || typeof chromeValue !== "object") return false;
  const storage: unknown = Reflect.get(chromeValue, "storage");
  return Boolean(storage && typeof storage === "object");
}
