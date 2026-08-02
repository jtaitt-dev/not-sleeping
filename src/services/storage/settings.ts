import { z } from "zod";

import type { AppSettings } from "@/types/domain";

export const APP_SETTINGS_KEY = "appSettings";

export const appSettingsSchema = z.object({
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
  maxRequestsPerMinute: z.number().int().min(1).max(12),
  maxConcurrency: z.number().int().min(1).max(2),
  maxOutputTokens: z.number().int().min(256).max(16_384),
  requestTimeoutMs: z.number().int().min(10_000).max(180_000),
  routineModel: z.string().min(1).max(120),
  researchModel: z.string().min(1).max(120),
  manualModelIds: z.array(z.string().min(1).max(120)).max(20),
  enablePublicData: z.boolean(),
  theme: z.enum(["dark", "light", "system", "high_contrast"]),
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  launcherEnabled: z.boolean(),
  launcherPosition: z.enum(["bottom_left", "bottom_right"]),
  logLevel: z.enum(["debug", "info", "warning", "error"]),
});

export const DEFAULT_SETTINGS: AppSettings = {
  settingsVersion: 1,
  onboardingComplete: false,
  sleeperUsername: "",
  sleeperUserId: "",
  defaultMode: "unknown",
  modeOverrides: {},
  defaultStrategy: "balanced",
  riskTolerance: 0.5,
  researchDepth: "standard",
  automaticAnalysis: false,
  maxRequestsPerMinute: 4,
  maxConcurrency: 1,
  maxOutputTokens: 2048,
  requestTimeoutMs: 60_000,
  routineModel: "gpt-5.6-terra",
  researchModel: "gpt-5.6-sol",
  manualModelIds: [],
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
  const parsed = appSettingsSchema.safeParse(result[APP_SETTINGS_KEY]);
  return parsed.success ? parsed.data : structuredClone(DEFAULT_SETTINGS);
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
