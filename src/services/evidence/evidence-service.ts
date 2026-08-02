import { validateExternalHttpsUrl } from "@/services/security/url";
import type {
  EvidenceClass,
  EvidenceConflict,
  EvidenceItem,
  EvidenceNature,
  FreshnessState,
} from "@/types/league";

const SOURCE_TRUST: Record<EvidenceClass, number> = {
  official_league: 1,
  official_nfl: 0.98,
  official_team: 0.96,
  official_injury_report: 0.98,
  official_transaction: 0.98,
  weather: 0.9,
  schedule: 0.96,
  historical_stats: 0.92,
  projection: 0.72,
  market: 0.66,
  national_reporter: 0.82,
  beat_reporter: 0.78,
  public_social: 0.46,
  analysis: 0.5,
  user_import: 0.62,
  user_override: 1,
};

const INJECTION_PATTERNS = [
  /ignore (?:all|any|the|previous) instructions/i,
  /system prompt/i,
  /developer message/i,
  /reveal (?:your|the) (?:secret|key|credentials|instructions)/i,
  /execute (?:this|the following) (?:code|command)/i,
  /<\/?(?:system|assistant|developer)>/i,
];

export type EvidenceInput = {
  sourceClass: EvidenceClass;
  url: string;
  publisher: string;
  author?: string;
  publishedAt?: string | null;
  retrievedAt?: string;
  eventAt?: string | null;
  playerIds?: string[];
  teamIds?: string[];
  claimType: string;
  claim: string;
  confidence?: number;
  corroborationCount?: number;
  citation?: string;
  expiresAt: string;
  nature: EvidenceNature;
};

export function normalizeEvidence(
  input: EvidenceInput,
  now = Date.now(),
): EvidenceItem {
  const validUrl = validateExternalHttpsUrl(input.url);
  if (!validUrl)
    throw new Error("Evidence URLs must be safe public HTTPS URLs.");
  if (
    containsPromptInjection(input.claim) ||
    containsPromptInjection(input.citation ?? "")
  ) {
    throw new Error(
      "Evidence content contained instruction-like text and was rejected.",
    );
  }
  const retrievedAt = input.retrievedAt ?? new Date(now).toISOString();
  const expiresAt = new Date(input.expiresAt).toISOString();
  const publishedAt = input.publishedAt
    ? new Date(input.publishedAt).toISOString()
    : null;
  const freshness = evidenceFreshness(expiresAt, now);
  const id = `evidence_${stableHash([validUrl, input.claimType, input.claim, publishedAt].join("|"))}`;
  return {
    id,
    sourceClass: input.sourceClass,
    url: validUrl,
    publisher: input.publisher.slice(0, 200),
    ...(input.author ? { author: input.author.slice(0, 200) } : {}),
    publishedAt,
    retrievedAt,
    ...(input.eventAt !== undefined
      ? {
          eventAt: input.eventAt ? new Date(input.eventAt).toISOString() : null,
        }
      : {}),
    playerIds: [...new Set(input.playerIds ?? [])],
    teamIds: [...new Set(input.teamIds ?? [])],
    claimType: input.claimType.slice(0, 120),
    claim: input.claim.slice(0, 2_000),
    confidence: clamp(
      (input.confidence ?? 0.75) * SOURCE_TRUST[input.sourceClass],
      0,
      1,
    ),
    freshness,
    corroborationCount: Math.max(0, Math.floor(input.corroborationCount ?? 0)),
    contradictions: [],
    citation: (input.citation ?? input.claim).slice(0, 600),
    expiresAt,
    rawSourceHash: stableHash([validUrl, input.claim, retrievedAt].join("|")),
    nature: input.nature,
  };
}

export function attachContradictions(items: EvidenceItem[]): EvidenceItem[] {
  return items.map((item) => {
    const contradictions: EvidenceConflict[] = items
      .filter(
        (candidate) =>
          candidate.id !== item.id &&
          candidate.claimType === item.claimType &&
          overlaps(candidate.playerIds, item.playerIds) &&
          claimsConflict(candidate.claim, item.claim),
      )
      .map((candidate) => ({
        evidenceId: candidate.id,
        summary: candidate.claim.slice(0, 240),
      }));
    return { ...item, contradictions };
  });
}

export function boundedEvidenceImpact(items: EvidenceItem[]): {
  impact: number;
  confidence: number;
  reasons: string[];
} {
  const current = items.filter((item) => item.freshness !== "stale");
  if (current.length === 0) {
    return {
      impact: 0,
      confidence: 0,
      reasons: ["No current cited evidence."],
    };
  }
  const weighted = current.reduce(
    (sum, item) => sum + item.confidence * (item.nature === "fact" ? 1 : 0.6),
    0,
  );
  const contradictionPenalty = current.reduce(
    (sum, item) => sum + item.contradictions.length * 0.08,
    0,
  );
  const corroboration = Math.min(
    1,
    current.reduce((sum, item) => sum + item.corroborationCount, 0) / 3,
  );
  const confidence = clamp(
    weighted / current.length - contradictionPenalty,
    0,
    1,
  );
  const maximumImpact = current.some((item) =>
    item.sourceClass.startsWith("official_"),
  )
    ? 8
    : corroboration >= 0.66
      ? 5
      : 2;
  return {
    impact: Math.round(maximumImpact * confidence * 100) / 100,
    confidence,
    reasons: [
      `${current.length} current source${current.length === 1 ? "" : "s"}`,
      `${Math.round(confidence * 100)}% evidence confidence`,
      contradictionPenalty > 0
        ? "Conflicting evidence reduced confidence"
        : "No detected conflict",
    ],
  };
}

export function containsPromptInjection(value: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

export function evidenceFreshness(
  expiresAt: string,
  now = Date.now(),
): FreshnessState {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return "unknown";
  const remaining = expiry - now;
  if (remaining <= 0) return "stale";
  return remaining < 15 * 60_000 ? "aging" : "fresh";
}

function claimsConflict(left: string, right: string): boolean {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();
  const pairs: [string, string][] = [
    ["active", "inactive"],
    ["will play", "will not play"],
    ["expected to play", "not expected to play"],
    ["full participant", "did not participate"],
    ["starter", "backup"],
    ["increased", "decreased"],
  ];
  return pairs.some(
    ([positive, negative]) =>
      (normalizedLeft.includes(positive) &&
        normalizedRight.includes(negative)) ||
      (normalizedLeft.includes(negative) && normalizedRight.includes(positive)),
  );
}

function overlaps(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return true;
  const set = new Set(left);
  return right.some((value) => set.has(value));
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
