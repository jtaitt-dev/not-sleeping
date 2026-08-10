/** Converts the ranking engine's documented -3..10 scarcity score to 0..1. */
export function normalizeScarcityForDecision(value: number): number {
  return round(clamp((value + 3) / 13, 0, 1), 4);
}

/** Converts an unbounded additive score into a readable, non-saturating 0..100 score. */
export function calibrateDraftScore(rawScore: number): number {
  return round(50 + 45 * Math.tanh((rawScore - 65) / 32), 1);
}

export function normalizeRiskForDecision(
  risk: "low" | "moderate" | "high",
): number {
  return risk === "high" ? 0.85 : risk === "moderate" ? 0.5 : 0.2;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, places: number): number {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}
