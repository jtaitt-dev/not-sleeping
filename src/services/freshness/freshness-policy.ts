import type {
  DataFreshnessEntry,
  FreshnessDomain,
  FreshnessState,
} from "@/types/league";

export type FreshnessPolicy = {
  ttlMs: number | null;
  liveWindowMs?: number;
  description: string;
};

export const DEFAULT_FRESHNESS_POLICIES: Record<
  FreshnessDomain,
  FreshnessPolicy
> = {
  draft_picks: {
    ttlMs: 3_000,
    liveWindowMs: 6_000,
    description: "Active draft picks",
  },
  matchup: {
    ttlMs: 30_000,
    liveWindowMs: 30_000,
    description: "Current matchup",
  },
  league_rosters: { ttlMs: 30_000, description: "Active league rosters" },
  transactions: { ttlMs: 2 * 60_000, description: "In-season transactions" },
  official_injuries: {
    ttlMs: 15 * 60_000,
    description: "Official injuries and practice status",
  },
  inactive_reports: {
    ttlMs: 5 * 60_000,
    description: "Near-kickoff inactive reports",
  },
  weather: { ttlMs: 30 * 60_000, description: "Stadium forecast" },
  general_news: { ttlMs: 2 * 60 * 60_000, description: "General player news" },
  breaking_news: { ttlMs: 15 * 60_000, description: "Breaking player news" },
  dynasty_profile: { ttlMs: 24 * 60 * 60_000, description: "Dynasty profile" },
  historical_data: { ttlMs: null, description: "Versioned historical data" },
};

export function resolveFreshness(input: {
  domain: FreshnessDomain;
  fetchedAt?: number | null;
  now?: number;
  policy?: Partial<Record<FreshnessDomain, FreshnessPolicy>>;
  sourceVersion?: string;
  lastError?: string;
}): DataFreshnessEntry {
  const now = input.now ?? Date.now();
  const policy =
    input.policy?.[input.domain] ?? DEFAULT_FRESHNESS_POLICIES[input.domain];
  const fetchedAt = input.fetchedAt ?? null;
  if (fetchedAt === null) {
    return {
      domain: input.domain,
      fetchedAt: null,
      expiresAt: null,
      state: "unknown",
      ...(input.sourceVersion ? { sourceVersion: input.sourceVersion } : {}),
      ...(input.lastError ? { lastError: input.lastError } : {}),
    };
  }
  if (policy.ttlMs === null) {
    return {
      domain: input.domain,
      fetchedAt,
      expiresAt: null,
      state: input.sourceVersion ? "fresh" : "unknown",
      ...(input.sourceVersion ? { sourceVersion: input.sourceVersion } : {}),
      ...(input.lastError ? { lastError: input.lastError } : {}),
    };
  }
  const age = Math.max(0, now - fetchedAt);
  const state: FreshnessState =
    policy.liveWindowMs !== undefined && age <= policy.liveWindowMs
      ? "live"
      : age <= policy.ttlMs * 0.75
        ? "fresh"
        : age <= policy.ttlMs
          ? "aging"
          : "stale";
  return {
    domain: input.domain,
    fetchedAt,
    expiresAt: fetchedAt + policy.ttlMs,
    state,
    ...(input.sourceVersion ? { sourceVersion: input.sourceVersion } : {}),
    ...(input.lastError ? { lastError: input.lastError } : {}),
  };
}

export function nearKickoffWeatherPolicy(
  hoursUntilKickoff: number,
): FreshnessPolicy {
  return hoursUntilKickoff <= 3
    ? { ttlMs: 10 * 60_000, description: "Near-kickoff stadium forecast" }
    : DEFAULT_FRESHNESS_POLICIES.weather;
}
