import {
  DEFAULT_SOURCE_PREFERENCES,
  type SourcePreferences,
} from "@/providers/evidence/evidence-adapters";

const STORAGE_KEY = "phase2SourcePreferences";
const MAX_ENTRIES = 100;

export async function getSourcePreferences(): Promise<SourcePreferences> {
  if (!hasStorage()) return structuredClone(DEFAULT_SOURCE_PREFERENCES);
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return parseSourcePreferences(stored[STORAGE_KEY]);
}

export async function saveSourcePreferences(
  preferences: SourcePreferences,
): Promise<SourcePreferences> {
  const parsed = parseSourcePreferences(preferences);
  if (hasStorage()) await chrome.storage.local.set({ [STORAGE_KEY]: parsed });
  return parsed;
}

export function parseSourcePreferences(value: unknown): SourcePreferences {
  if (!value || typeof value !== "object") {
    return structuredClone(DEFAULT_SOURCE_PREFERENCES);
  }
  const record = value as Record<string, unknown>;
  return {
    trustedDomains: stringList(record["trustedDomains"], true),
    blockedDomains: stringList(record["blockedDomains"], true),
    trustedReporters: stringList(record["trustedReporters"]),
    trustedSocialHandles: stringList(record["trustedSocialHandles"]),
    mutedReporters: stringList(record["mutedReporters"]),
    mutedTopics: stringList(record["mutedTopics"]),
    optionalXEnabled: record["optionalXEnabled"] === true,
  };
}

function stringList(value: unknown, domainsOnly = false): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((entry) => {
        if (typeof entry !== "string") return [];
        const normalized = entry.trim().toLowerCase().replace(/^@/, "");
        if (!normalized || normalized.length > 160) return [];
        if (domainsOnly && !isDomain(normalized)) return [];
        return [normalized];
      }),
    ),
  ].slice(0, MAX_ENTRIES);
}

function isDomain(value: string): boolean {
  const hostname = value.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    hostname,
  );
}

function hasStorage(): boolean {
  return typeof chrome !== "undefined";
}
