import {
  normalizeEvidence,
  type EvidenceInput,
} from "@/services/evidence/evidence-service";
import { validateExternalHttpsUrl } from "@/services/security/url";
import type {
  EvidenceClass,
  EvidenceItem,
  EvidenceNature,
} from "@/types/league";

export type SourcePreferences = {
  trustedDomains: string[];
  blockedDomains: string[];
  trustedReporters: string[];
  trustedSocialHandles: string[];
  mutedReporters: string[];
  mutedTopics: string[];
  optionalXEnabled: boolean;
};

export const DEFAULT_SOURCE_PREFERENCES: SourcePreferences = {
  trustedDomains: [],
  blockedDomains: [],
  trustedReporters: [],
  trustedSocialHandles: [],
  mutedReporters: [],
  mutedTopics: [],
  optionalXEnabled: false,
};

export const OFFICIAL_RESEARCH_DOMAINS = [
  "api.sleeper.app",
  "sleeper.com",
  "nfl.com",
  "operations.nfl.com",
  "open-meteo.com",
] as const;
const SOCIAL_DOMAINS = ["x.com", "twitter.com", "bsky.app", "threads.net"];

export function researchAllowedDomains(
  preferences: SourcePreferences,
): string[] {
  const candidates = [
    ...OFFICIAL_RESEARCH_DOMAINS,
    ...preferences.trustedDomains,
    ...(preferences.optionalXEnabled ? SOCIAL_DOMAINS : []),
  ];
  return [...new Set(candidates)].filter(
    (domain) =>
      !preferences.blockedDomains.some((blocked) =>
        domainMatches(domain, blocked),
      ),
  );
}

type AdapterInput = Omit<EvidenceInput, "sourceClass" | "nature"> & {
  sourceClass?: EvidenceClass;
  nature?: EvidenceNature;
};

export function adaptSleeperEvidence(
  input: AdapterInput,
  now = Date.now(),
): EvidenceItem {
  return normalizeEvidence(
    {
      ...input,
      sourceClass: "official_league",
      nature: input.nature ?? "fact",
      publisher: input.publisher || "Sleeper public API",
    },
    now,
  );
}

export function adaptNflverseEvidence(
  input: AdapterInput,
  now = Date.now(),
): EvidenceItem {
  return normalizeEvidence(
    {
      ...input,
      sourceClass: input.sourceClass ?? "historical_stats",
      nature: input.nature ?? "fact",
      publisher: input.publisher || "nflverse",
    },
    now,
  );
}

export function adaptWeatherEvidence(
  input: AdapterInput,
  now = Date.now(),
): EvidenceItem {
  return normalizeEvidence(
    {
      ...input,
      sourceClass: "weather",
      nature: input.nature ?? "projection",
      publisher: input.publisher || "Open-Meteo",
    },
    now,
  );
}

export function adaptUserImportEvidence(
  input: AdapterInput,
  now = Date.now(),
): EvidenceItem {
  return normalizeEvidence(
    {
      ...input,
      sourceClass: "user_import",
      nature: input.nature ?? "projection",
      publisher: input.publisher || "User import",
    },
    now,
  );
}

export function adaptPublicResearchEvidence(
  input: AdapterInput,
  preferences: SourcePreferences = DEFAULT_SOURCE_PREFERENCES,
  now = Date.now(),
): EvidenceItem {
  const url = validateExternalHttpsUrl(input.url);
  if (
    !url ||
    !isSourceAllowed(url, input.author, input.claimType, preferences)
  ) {
    throw new Error(
      "The evidence source is blocked by the active source policy.",
    );
  }
  const sourceClass = input.sourceClass ?? classifyPublicSource(url);
  if (
    sourceClass === "public_social" &&
    !isTrustedSocialAuthor(input.author, preferences)
  ) {
    return normalizeEvidence(
      {
        ...input,
        url,
        sourceClass,
        nature: "report",
        confidence: Math.min(input.confidence ?? 0.5, 0.5),
        publisher: input.publisher || new URL(url).hostname,
      },
      now,
    );
  }
  return normalizeEvidence(
    {
      ...input,
      url,
      sourceClass,
      nature: input.nature ?? "report",
      publisher: input.publisher || new URL(url).hostname,
    },
    now,
  );
}

export function filterEvidenceByPreferences(
  items: EvidenceItem[],
  preferences: SourcePreferences,
): EvidenceItem[] {
  return items.filter((item) =>
    isSourceAllowed(
      item.url,
      item.author,
      `${item.claimType} ${item.claim}`,
      preferences,
    ),
  );
}

export function isSourceAllowed(
  url: string,
  author: string | undefined,
  topic: string,
  preferences: SourcePreferences,
): boolean {
  const valid = validateExternalHttpsUrl(url);
  if (!valid) return false;
  const hostname = new URL(valid).hostname.toLowerCase();
  const social = SOCIAL_DOMAINS.some((domain) =>
    domainMatches(hostname, domain),
  );
  if (social && !preferences.optionalXEnabled) return false;
  const allowedDomain = researchAllowedDomains(preferences).some((domain) =>
    domainMatches(hostname, domain),
  );
  if (!allowedDomain) return false;
  const blocked = preferences.blockedDomains.some((domain) =>
    domainMatches(hostname, domain),
  );
  if (blocked) return false;
  const normalizedAuthor = author?.trim().toLowerCase();
  if (
    normalizedAuthor &&
    preferences.mutedReporters.some(
      (reporter) => reporter.trim().toLowerCase() === normalizedAuthor,
    )
  ) {
    return false;
  }
  const normalizedTopic = topic.toLowerCase();
  return !preferences.mutedTopics.some((muted) => {
    const value = muted.trim().toLowerCase();
    return value.length > 0 && normalizedTopic.includes(value);
  });
}

export function classifyPublicSource(url: string): EvidenceClass {
  const hostname = new URL(url).hostname.toLowerCase();
  if (domainMatches(hostname, "sleeper.com")) return "official_league";
  if (domainMatches(hostname, "nfl.com")) return "official_nfl";
  if (domainMatches(hostname, "open-meteo.com")) return "weather";
  if (domainMatches(hostname, "github.com")) return "historical_stats";
  if (
    ["x.com", "twitter.com", "bsky.app", "threads.net"].some((domain) =>
      domainMatches(hostname, domain),
    )
  ) {
    return "public_social";
  }
  return "analysis";
}

function isTrustedSocialAuthor(
  author: string | undefined,
  preferences: SourcePreferences,
): boolean {
  if (!author) return false;
  const normalized = author.trim().toLowerCase().replace(/^@/, "");
  return preferences.trustedSocialHandles.some(
    (handle) => handle.trim().toLowerCase().replace(/^@/, "") === normalized,
  );
}

function domainMatches(hostname: string, preference: string): boolean {
  const normalized =
    preference
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0] ?? "";
  return (
    normalized.length > 0 &&
    (hostname === normalized || hostname.endsWith(`.${normalized}`))
  );
}
