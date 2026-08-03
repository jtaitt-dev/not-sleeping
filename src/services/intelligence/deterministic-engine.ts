import { stableContentHash } from "@/services/research/request-queue";
import { nextPickSurvivalProbability } from "@/services/scenarios/next-pick-survival";

import type {
  DecisionCandidate,
  DecisionInput,
  DeterministicDecision,
  RankedDecisionCandidate,
} from "./types";

export function evaluateDeterministicDecision(
  input: DecisionInput,
  now = Date.now(),
): DeterministicDecision {
  const stateHash = stableContentHash(normalizeDecisionInput(input));
  const rejectedCandidateIds: string[] = [];
  const ranked = input.candidates.flatMap((candidate) => {
    const legal = isLegalCandidate(candidate);
    if (!legal) {
      rejectedCandidateIds.push(candidate.id);
      return [];
    }
    return [rankCandidate(input, candidate)];
  });
  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      right.confidence - left.confidence ||
      left.label.localeCompare(right.label),
  );
  const top = ranked[0];
  const runnerUp = ranked[1];
  const confidence = top
    ? clamp01(
        0.52 +
          Math.min(
            0.26,
            Math.max(0, top.score - (runnerUp?.score ?? top.score - 8)) / 30,
          ) +
          Math.min(0.12, ranked.length / 100),
      )
    : 0;
  return {
    feature: input.feature,
    stateHash,
    generatedAt: now,
    recommendationId: top?.id ?? null,
    recommendation: top
      ? `${top.label} is the strongest valid option right now.`
      : "No valid candidate is available for this decision.",
    confidence: round(confidence),
    ranked,
    rejectedCandidateIds,
    warnings: [
      ...(rejectedCandidateIds.length > 0
        ? [
            `Excluded ${rejectedCandidateIds.length} unavailable or ineligible option(s).`,
          ]
        : []),
      ...(input.candidates.length === 0
        ? ["No candidates were supplied."]
        : []),
    ],
  };
}

function rankCandidate(
  input: DecisionInput,
  candidate: DecisionCandidate,
): RankedDecisionCandidate {
  const base = candidate.baseValue ?? candidate.projectedPoints ?? 50;
  const rosterFit = clampSigned(candidate.rosterFit ?? 0) * 9;
  const scarcity = clamp01(candidate.scarcity ?? 0.5) * 7;
  const risk = clamp01(candidate.risk ?? 0.5);
  const riskAdjustment = (input.riskTolerance - risk) * 8;
  const strategyAdjustment = strategyFit(input.strategy, candidate) * 6;
  const survival = nextPickSurvivalProbability({
    candidateId: candidate.id,
    position: candidate.position,
    adp: candidate.adp,
    currentPick: input.currentPick,
    picksUntilNext: input.picksUntilNext,
  });
  const urgency = input.feature === "draft" ? (1 - survival) * 8 : 0;
  const score = round(
    Math.max(
      0,
      Math.min(
        100,
        base +
          rosterFit +
          scarcity +
          riskAdjustment +
          strategyAdjustment +
          urgency,
      ),
    ),
  );
  const reasons = [
    ...(candidate.reasons ?? []),
    `Deterministic value ${round(base)}.`,
    ...(input.feature === "draft"
      ? [
          `Estimated ${Math.round(survival * 100)}% chance to survive to the next pick.`,
        ]
      : []),
    rosterFit > 2
      ? "Improves roster construction."
      : "Roster fit is neutral or modest.",
  ].slice(0, 6);
  return {
    ...candidate,
    score,
    confidence: round(clamp01(0.48 + Math.abs(score - 50) / 160)),
    nextPickSurvival: survival,
    legal: true,
    reasons,
  };
}

function isLegalCandidate(candidate: DecisionCandidate): boolean {
  return (
    candidate.available !== false &&
    candidate.eligible !== false &&
    candidate.alreadySelected !== true
  );
}

function strategyFit(
  strategy: DecisionInput["strategy"],
  candidate: DecisionCandidate,
): number {
  const age = Number(candidate.metadata?.["age"] ?? 0);
  const experience = Number(candidate.metadata?.["yearsExperience"] ?? 0);
  if (strategy === "rebuild" || strategy === "productive_struggle") {
    if (age > 0) return clampSigned((26 - age) / 8);
    return experience <= 2 ? 0.45 : 0;
  }
  if (strategy === "contender" && candidate.projectedPoints !== undefined) {
    return clampSigned((candidate.projectedPoints - 50) / 50);
  }
  return 0;
}

function normalizeDecisionInput(input: DecisionInput): unknown {
  return {
    ...input,
    candidates: input.candidates
      .map((candidate) => ({
        ...candidate,
        reasons: candidate.reasons?.toSorted(),
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id)),
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
