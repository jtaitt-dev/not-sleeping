import type { DraftContext, Recommendation } from "@/types/domain";

export type TurnPairPlan = {
  firstPickNumber: number;
  secondPickNumber: number;
  pickA: Recommendation;
  pickBOptions: Recommendation[];
  combinedScore: number;
  reason: string;
};

export function optimizeTurnPair(
  recommendations: Recommendation[],
  context: DraftContext,
): TurnPairPlan | null {
  if (context.draftStyle === "auction" || recommendations.length < 2)
    return null;
  const upcoming = context.ownedPickNumbers
    .filter((pick) => pick >= context.currentPick)
    .toSorted((left, right) => left - right);
  const firstPickNumber = upcoming[0];
  const secondPickNumber = upcoming[1];
  if (
    firstPickNumber === undefined ||
    secondPickNumber === undefined ||
    secondPickNumber - firstPickNumber > 2
  ) {
    return null;
  }

  const pool = recommendations.slice(0, 14);
  const pairs = pool.flatMap((pickA) =>
    pool
      .filter((pickB) => pickB.player.id !== pickA.player.id)
      .map((pickB) => ({
        pickA,
        pickB,
        score: pairScore(pickA, pickB),
      })),
  );
  const best = pairs.toSorted((left, right) => right.score - left.score)[0];
  if (!best) return null;

  const pickBOptions = pairs
    .filter((pair) => pair.pickA.player.id === best.pickA.player.id)
    .toSorted((left, right) => right.score - left.score)
    .map((pair) => pair.pickB)
    .filter(
      (recommendation, index, entries) =>
        entries.findIndex(
          (entry) => entry.player.id === recommendation.player.id,
        ) === index,
    )
    .slice(0, 3);

  return {
    firstPickNumber,
    secondPickNumber,
    pickA: best.pickA,
    pickBOptions,
    combinedScore: Math.round(best.score),
    reason:
      best.pickA.player.position === best.pickB.player.position
        ? `The tier supports doubling at ${best.pickA.player.position} without reaching past the board.`
        : `The pair balances ${best.pickA.player.position} value with ${best.pickB.player.position} roster construction.`,
  };
}

function pairScore(first: Recommendation, second: Recommendation): number {
  const diversification =
    first.player.position === second.player.position ? -1.5 : 2.25;
  const strongFitBonus =
    (first.rosterFit === "strong" ? 1 : 0) +
    (second.rosterFit === "strong" ? 1 : 0);
  const riskBalance = first.risk === "low" || second.risk === "low" ? 0.75 : 0;
  return (
    first.contextualScore +
    second.contextualScore +
    diversification +
    strongFitBonus +
    riskBalance
  );
}
