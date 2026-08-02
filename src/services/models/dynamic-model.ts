import type { EvidenceItem } from "@/types/league";

export type ModelComponentName =
  | "baseline_projection"
  | "league_scoring"
  | "usage"
  | "role"
  | "matchup"
  | "weather"
  | "injury"
  | "news"
  | "market"
  | "roster_context"
  | "risk_profile";

export type ModelComponentInput = {
  name: ModelComponentName;
  adjustment: number | null;
  confidence: number;
  evidence: EvidenceItem[];
  explanation: string;
  manualOverride?: boolean;
};

export type ModelContribution = {
  name: ModelComponentName;
  requestedAdjustment: number | null;
  appliedAdjustment: number;
  confidence: number;
  explanation: string;
  evidenceIds: string[];
  bounded: boolean;
  missing: boolean;
  manualOverride: boolean;
};

export type DynamicModelResult = {
  expectedPoints: number;
  median: number;
  floor: number;
  ceiling: number;
  bustProbability: number;
  boomProbability: number;
  availabilityProbability: number;
  confidence: number;
  contributions: ModelContribution[];
  conflicts: string[];
  generatedAt: string;
};

const COMPONENT_BOUNDS: Record<ModelComponentName, number> = {
  baseline_projection: 100,
  league_scoring: 8,
  usage: 5,
  role: 5,
  matchup: 3,
  weather: 4,
  injury: 8,
  news: 6,
  market: 3,
  roster_context: 3,
  risk_profile: 4,
};

export function runDynamicModel(input: {
  baseline: number;
  components: ModelComponentInput[];
  availabilityProbability?: number;
  volatility?: number;
  now?: number;
}): DynamicModelResult {
  const baseline = finite(input.baseline, 0);
  const contributions = input.components.map(applyComponent);
  const adjustment = contributions.reduce(
    (sum, contribution) => sum + contribution.appliedAdjustment,
    0,
  );
  const availabilityProbability = clamp(
    input.availabilityProbability ?? 1,
    0,
    1,
  );
  const expectedPoints = round(
    Math.max(0, (baseline + adjustment) * availabilityProbability),
  );
  const volatility = clamp(input.volatility ?? 0.28, 0.05, 0.8);
  const missingCount = contributions.filter((entry) => entry.missing).length;
  const conflicts = input.components.flatMap((component) =>
    component.evidence
      .filter((evidence) => evidence.contradictions.length > 0)
      .map((evidence) => `${component.name}: ${evidence.claimType}`),
  );
  const evidenceConfidence = weightedMean(
    contributions.map((entry) => ({
      value: entry.confidence,
      weight: entry.missing ? 0.5 : 1,
    })),
  );
  const confidence = clamp(
    evidenceConfidence - missingCount * 0.025 - conflicts.length * 0.05,
    0.05,
    0.99,
  );
  const spread = expectedPoints * volatility * (1.35 - confidence * 0.35);
  const floor = round(Math.max(0, expectedPoints - spread));
  const ceiling = round(expectedPoints + spread * 1.35);
  return {
    expectedPoints,
    median: round(expectedPoints * (1 - volatility * 0.04)),
    floor,
    ceiling,
    bustProbability: round(
      clamp(
        0.1 +
          volatility * 0.45 +
          (1 - confidence) * 0.25 +
          (1 - availabilityProbability) * 0.5,
        0,
        1,
      ),
    ),
    boomProbability: round(
      clamp(0.08 + volatility * 0.42 + confidence * 0.12, 0, 0.65),
    ),
    availabilityProbability,
    confidence: round(confidence),
    contributions,
    conflicts: [...new Set(conflicts)],
    generatedAt: new Date(input.now ?? Date.now()).toISOString(),
  };
}

function applyComponent(input: ModelComponentInput): ModelContribution {
  const bound = COMPONENT_BOUNDS[input.name];
  const missing =
    input.adjustment === null || !Number.isFinite(input.adjustment);
  const isAiOnly = input.evidence.length === 0 && !input.manualOverride;
  const numericRequested = missing ? 0 : finite(input.adjustment ?? 0, 0);
  const requested = missing ? null : numericRequested;
  const allowedBound = isAiOnly ? Math.min(bound, 0.5) : bound;
  const applied = missing
    ? 0
    : clamp(numericRequested, -allowedBound, allowedBound);
  const evidenceConfidence =
    input.evidence.length === 0
      ? input.manualOverride
        ? 1
        : 0.25
      : input.evidence.reduce((sum, evidence) => sum + evidence.confidence, 0) /
        input.evidence.length;
  const stalePenalty = input.evidence.some(
    (evidence) => evidence.freshness === "stale",
  )
    ? 0.25
    : 0;
  const conflictPenalty = input.evidence.some(
    (evidence) => evidence.contradictions.length > 0,
  )
    ? 0.2
    : 0;
  return {
    name: input.name,
    requestedAdjustment: requested,
    appliedAdjustment: round(applied),
    confidence: round(
      clamp(
        input.confidence * evidenceConfidence - stalePenalty - conflictPenalty,
        0,
        1,
      ),
    ),
    explanation: input.explanation,
    evidenceIds: input.evidence.map((evidence) => evidence.id),
    bounded: requested !== null && Math.abs(requested) > allowedBound,
    missing,
    manualOverride: input.manualOverride === true,
  };
}

function weightedMean(values: { value: number; weight: number }[]): number {
  if (values.length === 0) return 0.5;
  const weight = values.reduce((sum, entry) => sum + entry.weight, 0);
  return weight === 0
    ? 0.5
    : values.reduce((sum, entry) => sum + entry.value * entry.weight, 0) /
        weight;
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
