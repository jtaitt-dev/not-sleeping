import { stableContentHash } from "@/services/research/request-queue";

export type OpponentProfile = {
  rosterId: string;
  needs: string[];
  positionBias?: Record<string, number>;
};

export type NextPickSurvivalEstimate = {
  probability: number;
  interval: [number, number];
  confidence: number;
  simulations: number;
  factors: string[];
  warning?: string;
};

export function nextPickSurvivalProbability(input: {
  candidateId: string;
  position?: string;
  adp?: number;
  currentPick?: number;
  picksUntilNext?: number;
  opponents?: OpponentProfile[];
  positionDemand?: number;
  remainingTier?: number;
  simulations?: number;
}): number {
  return nextPickSurvivalEstimate(input).probability;
}

export function nextPickSurvivalEstimate(input: {
  candidateId: string;
  position?: string;
  adp?: number;
  currentPick?: number;
  picksUntilNext?: number;
  opponents?: OpponentProfile[];
  positionDemand?: number;
  remainingTier?: number;
  simulations?: number;
}): NextPickSurvivalEstimate {
  // `picksUntilNext` includes the current owned selection and the next owned
  // pick. Only the selections strictly between them can remove a passed player.
  const horizon = Math.max(0, (input.picksUntilNext ?? 0) - 1);
  const simulations = Math.max(100, Math.min(5_000, input.simulations ?? 600));
  if (horizon === 0) {
    return {
      probability: 1,
      interval: [1, 1],
      confidence: input.adp === undefined ? 0.45 : 0.82,
      simulations,
      factors: ["No opponent selections occur before the next owned pick"],
    };
  }
  const currentPick = Math.max(1, input.currentPick ?? 1);
  const adp = input.adp ?? currentPick + horizon + 12;
  const opponents = input.opponents ?? [];
  let survives = 0;
  for (let index = 0; index < simulations; index += 1) {
    let available = true;
    for (let offset = 1; offset <= horizon && available; offset += 1) {
      const overallPick = currentPick + offset;
      const priorCdf = marketCdf(overallPick - 1, adp);
      const currentCdf = marketCdf(overallPick, adp);
      const marketHazard =
        (currentCdf - priorCdf) / Math.max(0.001, 1 - priorCdf);
      const opponent = opponents[offset - 1];
      const need =
        input.position && opponent?.needs.includes(input.position) ? 0.08 : 0;
      const bias = input.position
        ? (opponent?.positionBias?.[input.position] ?? 0)
        : 0;
      const demand = Math.max(-0.04, Math.min(0.08, input.positionDemand ?? 0));
      const tier =
        input.remainingTier !== undefined && input.remainingTier <= 2
          ? 0.055
          : input.remainingTier !== undefined && input.remainingTier <= 5
            ? 0.025
            : 0;
      const pickChance = clampHazard(
        marketHazard + need + bias + demand + tier,
      );
      const random = deterministicUnit(
        `${input.candidateId}:${currentPick}:${horizon}:${index}:${overallPick}`,
      );
      if (random < pickChance) available = false;
    }
    if (available) survives += 1;
  }
  const probability = round(survives / simulations, 3);
  const evidenceConfidence = input.adp === undefined ? 0.46 : 0.78;
  const samplingMargin = Math.max(
    0.035,
    1.96 * Math.sqrt((probability * (1 - probability)) / simulations),
  );
  const evidenceMargin = input.adp === undefined ? 0.18 : 0.08;
  const margin = Math.min(0.28, samplingMargin + evidenceMargin);
  return {
    probability,
    interval: [
      round(Math.max(0, probability - margin), 3),
      round(Math.min(1, probability + margin), 3),
    ],
    confidence: evidenceConfidence,
    simulations,
    factors: [
      `${horizon} opponent selection${horizon === 1 ? "" : "s"} before the next owned pick`,
      input.adp === undefined
        ? "No imported ADP"
        : `Imported ADP ${round(adp, 1)}`,
      input.remainingTier === undefined
        ? "Tier depth unavailable"
        : `${input.remainingTier} player${input.remainingTier === 1 ? "" : "s"} remain in the tier`,
      opponents.length > 0
        ? "Opponent roster needs included"
        : "Opponent needs approximated from board demand",
    ],
    ...(input.adp === undefined
      ? { warning: "Wide range: imported ADP is unavailable." }
      : {}),
  };
}

function deterministicUnit(seed: string): number {
  return Number.parseInt(stableContentHash(seed), 16) / 0xffffffff;
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function marketCdf(pick: number, adp: number): number {
  return logistic((pick - adp) / 6.5);
}

function clampHazard(value: number): number {
  return Math.max(0.002, Math.min(0.92, value));
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
