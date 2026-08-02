import {
  DEFAULT_FRESHNESS_POLICIES,
  type FreshnessPolicy,
} from "@/services/freshness/freshness-policy";
import type { FreshnessDomain } from "@/types/league";

export type FreshnessOverrides = Partial<Record<FreshnessDomain, number>>;

const STORAGE_KEY = "phase2FreshnessOverrides";
const MINIMUM_TTL_MS = 1_000;
const MAXIMUM_TTL_MS = 7 * 24 * 60 * 60_000;

export async function getFreshnessOverrides(): Promise<FreshnessOverrides> {
  if (!hasChromeStorage()) return {};
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return parseFreshnessOverrides(stored[STORAGE_KEY]);
}

export async function saveFreshnessOverrides(
  overrides: FreshnessOverrides,
): Promise<FreshnessOverrides> {
  const parsed = parseFreshnessOverrides(overrides);
  if (hasChromeStorage())
    await chrome.storage.local.set({ [STORAGE_KEY]: parsed });
  return parsed;
}

export function effectiveFreshnessPolicies(
  overrides: FreshnessOverrides,
): Record<FreshnessDomain, FreshnessPolicy> {
  return Object.fromEntries(
    Object.entries(DEFAULT_FRESHNESS_POLICIES).map(([domain, policy]) => {
      const ttlMs = overrides[domain as FreshnessDomain];
      return [
        domain,
        ttlMs === undefined || policy.ttlMs === null
          ? policy
          : {
              ...policy,
              ttlMs,
              ...(policy.liveWindowMs === undefined
                ? {}
                : { liveWindowMs: Math.min(policy.liveWindowMs, ttlMs) }),
            },
      ];
    }),
  ) as Record<FreshnessDomain, FreshnessPolicy>;
}

export function parseFreshnessOverrides(value: unknown): FreshnessOverrides {
  if (!value || typeof value !== "object") return {};
  const validDomains = new Set(Object.keys(DEFAULT_FRESHNESS_POLICIES));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(
      ([domain, ttl]) => {
        if (
          !validDomains.has(domain) ||
          typeof ttl !== "number" ||
          !Number.isFinite(ttl)
        )
          return [];
        const policy = DEFAULT_FRESHNESS_POLICIES[domain as FreshnessDomain];
        if (policy.ttlMs === null) return [];
        return [
          [
            domain,
            Math.round(Math.min(MAXIMUM_TTL_MS, Math.max(MINIMUM_TTL_MS, ttl))),
          ],
        ];
      },
    ),
  );
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage.local);
}
