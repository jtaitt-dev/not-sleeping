import type { AiFeature, AiProviderId, Strategy } from "@/types/domain";

export type DecisionCandidate = {
  id: string;
  label: string;
  position?: string;
  team?: string;
  baseValue?: number;
  adp?: number;
  projectedPoints?: number;
  rosterFit?: number;
  scarcity?: number;
  risk?: number;
  available?: boolean;
  eligible?: boolean;
  alreadySelected?: boolean;
  reasons?: string[];
  metadata?: Record<string, string | number | boolean | null>;
};

export type DecisionInput = {
  feature: AiFeature;
  subject: string;
  contextSummary: string;
  candidates: DecisionCandidate[];
  strategy: Strategy;
  riskTolerance: number;
  picksUntilNext?: number;
  currentPick?: number;
  facts?: Record<
    string,
    string | number | boolean | null | string[] | number[]
  >;
};

/**
 * One addend of a deterministic score. The engine already computes these
 * separately and then sums them; surfacing them is what makes a recommendation
 * auditable rather than a number with a sentence attached.
 */
export type ScoreFactor = {
  key: "base" | "roster_fit" | "scarcity" | "risk" | "strategy" | "urgency";
  label: string;
  /** Signed contribution in score points. `base` carries the starting value. */
  impact: number;
  note: string;
};

export type RankedDecisionCandidate = DecisionCandidate & {
  score: number;
  confidence: number;
  nextPickSurvival: number;
  legal: boolean;
  reasons: string[];
  factors: ScoreFactor[];
};

export type DeterministicDecision = {
  feature: AiFeature;
  stateHash: string;
  generatedAt: number;
  recommendationId: string | null;
  recommendation: string;
  confidence: number;
  ranked: RankedDecisionCandidate[];
  rejectedCandidateIds: string[];
  warnings: string[];
};

export type AiDecisionOverlay = {
  provider: AiProviderId | "consensus";
  model: string;
  generatedAt: number;
  stateHash: string;
  recommendationId: string | null;
  summary: string;
  adjustment: number;
  confidenceDelta: number;
  reasons: string[];
  risks: string[];
  evidenceUrls: string[];
  warnings: string[];
};

export type RealtimeDecision = {
  jobId: string;
  baseline: DeterministicDecision;
  aiStatus: "off" | "queued" | "ready" | "error" | "stale";
  overlay?: AiDecisionOverlay;
  error?: string;
};
