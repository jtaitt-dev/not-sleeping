import type { Strategy } from "@/types/domain";

export type TradeAsset = {
  id: string;
  label: string;
  kind: "player" | "pick" | "manual";
  dynastyValue: number;
  contenderValue: number;
  rebuilderValue: number;
  age?: number;
  risk: number;
  rosterSpots: number;
};

export type TradeEvaluation = {
  sideATotal: number;
  sideBTotal: number;
  difference: number;
  percentageDifference: number;
  fairness: "strong_a" | "lean_a" | "fair" | "lean_b" | "strong_b";
  recommendation: string;
  confidence: number;
  conditions: string[];
};

export function evaluateTrade(
  sideA: TradeAsset[],
  sideB: TradeAsset[],
  strategy: Strategy,
): TradeEvaluation {
  const sideATotal = adjustedSideValue(sideA, strategy);
  const sideBTotal = adjustedSideValue(sideB, strategy);
  const difference = sideBTotal - sideATotal;
  const midpoint = Math.max(1, (sideATotal + sideBTotal) / 2);
  const percentageDifference = (difference / midpoint) * 100;
  const absolute = Math.abs(percentageDifference);
  const direction = difference > 0 ? "b" : "a";
  const fairness =
    absolute <= 6
      ? "fair"
      : absolute <= 14
        ? (`lean_${direction}` as const)
        : (`strong_${direction}` as const);
  const riskDifference =
    sideB.reduce((sum, asset) => sum + asset.risk, 0) -
    sideA.reduce((sum, asset) => sum + asset.risk, 0);

  return {
    sideATotal: round(sideATotal),
    sideBTotal: round(sideBTotal),
    difference: round(Math.abs(difference)),
    percentageDifference: round(percentageDifference),
    fairness,
    recommendation:
      fairness === "fair"
        ? "The local values fall inside the fair-trade band."
        : `Local value favors Side ${direction.toUpperCase()}.`,
    confidence: sideA.length > 0 && sideB.length > 0 ? 0.78 : 0.25,
    conditions: [
      "A material injury or depth-chart change affects a centerpiece.",
      "A future pick lands outside its estimated range.",
      riskDifference === 0
        ? "The selected strategy changes."
        : `Risk tolerance shifts toward Side ${riskDifference > 0 ? "A" : "B"}.`,
    ],
  };
}

function adjustedSideValue(assets: TradeAsset[], strategy: Strategy): number {
  if (assets.length === 0) return 0;
  const raw = assets.reduce((sum, asset) => {
    const value =
      strategy === "contender"
        ? asset.contenderValue
        : strategy === "rebuild" || strategy === "productive_struggle"
          ? asset.rebuilderValue
          : asset.dynastyValue;
    return sum + value - asset.risk * 0.4;
  }, 0);
  const bestPlayer = Math.max(
    0,
    ...assets
      .filter((asset) => asset.kind === "player")
      .map((asset) => asset.dynastyValue),
  );
  const consolidationPremium = assets.length <= 2 ? bestPlayer * 0.035 : 0;
  const rosterCost = Math.max(0, assets.length - 2) * 1.25;
  return raw + consolidationPremium - rosterCost;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
