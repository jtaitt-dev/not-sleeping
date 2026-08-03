import { stableContentHash } from "@/services/research/request-queue";

export type OpponentProfile = {
  rosterId: string;
  needs: string[];
  positionBias?: Record<string, number>;
};

export function nextPickSurvivalProbability(input: {
  candidateId: string;
  position?: string;
  adp?: number;
  currentPick?: number;
  picksUntilNext?: number;
  opponents?: OpponentProfile[];
  simulations?: number;
}): number {
  const horizon = Math.max(0, input.picksUntilNext ?? 0);
  if (horizon === 0) return 1;
  const currentPick = Math.max(1, input.currentPick ?? 1);
  const adp = input.adp ?? currentPick + horizon + 12;
  const basePickChance = logistic((currentPick + horizon - adp) / 4.5);
  const opponents = input.opponents ?? [];
  const needPressure = opponents.slice(0, horizon).reduce((sum, opponent) => {
    const need =
      input.position && opponent.needs.includes(input.position) ? 0.12 : 0;
    const bias = input.position
      ? (opponent.positionBias?.[input.position] ?? 0)
      : 0;
    return sum + need + Math.max(-0.08, Math.min(0.12, bias));
  }, 0);
  const simulations = Math.max(50, Math.min(2_000, input.simulations ?? 300));
  let survives = 0;
  for (let index = 0; index < simulations; index += 1) {
    const random = deterministicUnit(
      `${input.candidateId}:${currentPick}:${horizon}:${index}`,
    );
    const pickChance = clamp(
      basePickChance + needPressure / Math.max(1, horizon),
    );
    if (random > pickChance) survives += 1;
  }
  return round(survives / simulations, 3);
}

function deterministicUnit(seed: string): number {
  return Number.parseInt(stableContentHash(seed), 16) / 0xffffffff;
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function clamp(value: number): number {
  return Math.max(0.02, Math.min(0.98, value));
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
