export type AuctionTeamState = {
  rosterId: number;
  budget: number;
  remainingBudget: number;
  rosterSpots: number;
  filledSpots: number;
  minimumBid: number;
};

export type AuctionPlayerValue = {
  playerId: string;
  baselineValue: number;
  leagueAdjustedValue: number;
  rosterSpecificValue: number;
};

export type AuctionRecommendation = {
  playerId: string;
  inflation: number;
  inflationAdjustedValue: number;
  maximumLegalBid: number;
  maximumRecommendedBid: number;
  bargainThreshold: number;
  overpayThreshold: number;
  reserveRequired: number;
  warning: string | null;
};

export type AuctionRoomPlan = {
  initialBudget: number;
  spendableBudget: number;
  keeperCommitment: number;
  remainingSpots: number;
  budgetPace: "ahead" | "on_pace" | "behind";
  dollarsPerOpenSpot: number;
  currentBidLegal: boolean;
  bidLeader: string | null;
  nominationRecommendation: string;
  positionSpend: Record<string, number>;
  warnings: string[];
};

export function maximumLegalBid(team: AuctionTeamState): number {
  const remainingSpotsAfterWin = Math.max(
    0,
    team.rosterSpots - team.filledSpots - 1,
  );
  return Math.max(
    0,
    Math.floor(team.remainingBudget - remainingSpotsAfterWin * team.minimumBid),
  );
}

export function calculateInflation(input: {
  initialLeagueBudget: number;
  remainingLeagueBudget: number;
  initialPlayerValue: number;
  remainingPlayerValue: number;
}): number {
  if (input.remainingPlayerValue <= 0 || input.initialPlayerValue <= 0)
    return 1;
  const budgetShare =
    input.remainingLeagueBudget / Math.max(1, input.initialLeagueBudget);
  const valueShare = input.remainingPlayerValue / input.initialPlayerValue;
  return round(clamp(budgetShare / valueShare, 0.65, 1.65));
}

export function recommendAuctionBid(input: {
  team: AuctionTeamState;
  player: AuctionPlayerValue;
  inflation: number;
  strategyAggression?: number;
}): AuctionRecommendation {
  const legal = maximumLegalBid(input.team);
  const adjusted = input.player.leagueAdjustedValue * input.inflation;
  const blended = adjusted * 0.55 + input.player.rosterSpecificValue * 0.45;
  const aggression = clamp(input.strategyAggression ?? 0.5, 0, 1);
  const recommended = Math.min(
    legal,
    Math.max(0, Math.round(blended * (0.94 + aggression * 0.12))),
  );
  const reserveRequired = Math.max(
    0,
    (input.team.rosterSpots - input.team.filledSpots - 1) *
      input.team.minimumBid,
  );
  return {
    playerId: input.player.playerId,
    inflation: input.inflation,
    inflationAdjustedValue: round(adjusted),
    maximumLegalBid: legal,
    maximumRecommendedBid: recommended,
    bargainThreshold: Math.max(0, Math.round(blended * 0.78)),
    overpayThreshold: Math.min(legal, Math.round(blended * 1.15)),
    reserveRequired,
    warning:
      recommended === legal && legal < blended
        ? "Roster reserve requirements cap this bid below the modeled value."
        : null,
  };
}

export function auctionValueFromReplacement(input: {
  playerProjections: number[];
  starterCount: number;
  totalBudget: number;
  minimumBid: number;
}): number[] {
  const sorted = input.playerProjections.toSorted(
    (left, right) => right - left,
  );
  const replacement =
    sorted[Math.min(sorted.length - 1, Math.max(0, input.starterCount))] ?? 0;
  const surplus = sorted.map((projection) =>
    Math.max(0, projection - replacement),
  );
  const discretionary = Math.max(
    0,
    input.totalBudget - sorted.length * input.minimumBid,
  );
  const totalSurplus = surplus.reduce((sum, value) => sum + value, 0);
  return surplus.map((value) =>
    round(
      input.minimumBid +
        (totalSurplus > 0 ? (value / totalSurplus) * discretionary : 0),
    ),
  );
}

export function buildAuctionRoomPlan(input: {
  team: AuctionTeamState;
  keeperCommitment: number;
  currentBid: number;
  bidLeader: string | null;
  currentNomination: AuctionPlayerValue | null;
  positionSpend: Record<string, number>;
  strategy:
    | "stars_and_scrubs"
    | "balanced"
    | "zero_rb"
    | "hero_rb"
    | "elite_qb"
    | "late_qb"
    | "punt_position"
    | "productive_struggle";
  nominationCandidates: Array<{
    name: string;
    position: string;
    leagueAdjustedValue: number;
    rosterSpecificValue: number;
  }>;
}): AuctionRoomPlan {
  const remainingSpots = Math.max(
    0,
    input.team.rosterSpots - input.team.filledSpots,
  );
  const initialBudget = Math.max(0, input.team.budget);
  const keeperCommitment = clamp(input.keeperCommitment, 0, initialBudget);
  const spendableBudget = Math.max(0, input.team.remainingBudget);
  const budgetShare =
    spendableBudget / Math.max(1, initialBudget - keeperCommitment);
  const spotShare = remainingSpots / Math.max(1, input.team.rosterSpots);
  const paceRatio = budgetShare / Math.max(0.01, spotShare);
  const candidate = chooseNomination(
    input.nominationCandidates,
    input.strategy,
  );
  const legal = maximumLegalBid(input.team);
  const warnings: string[] = [];
  if (input.currentBid > legal)
    warnings.push(
      `Current bid exceeds this roster's legal maximum of $${legal}.`,
    );
  if (spendableBudget < remainingSpots * input.team.minimumBid)
    warnings.push(
      "Budget cannot cover the configured minimum bid for every open spot.",
    );
  if (!input.currentNomination)
    warnings.push(
      "Current nomination is unavailable; live auction state may require manual entry.",
    );

  return {
    initialBudget,
    spendableBudget,
    keeperCommitment,
    remainingSpots,
    budgetPace:
      paceRatio > 1.15 ? "ahead" : paceRatio < 0.85 ? "behind" : "on_pace",
    dollarsPerOpenSpot: round(spendableBudget / Math.max(1, remainingSpots)),
    currentBidLegal: input.currentBid <= legal,
    bidLeader: input.bidLeader,
    nominationRecommendation: candidate
      ? `Nominate ${candidate.name} (${candidate.position}) — ${nominationReason(candidate, input.strategy)}.`
      : "No legal nomination candidate is available in the current pool.",
    positionSpend: Object.fromEntries(
      Object.entries(input.positionSpend).map(([position, value]) => [
        position,
        round(Math.max(0, value)),
      ]),
    ),
    warnings,
  };
}

function chooseNomination(
  candidates: Array<{
    name: string;
    position: string;
    leagueAdjustedValue: number;
    rosterSpecificValue: number;
  }>,
  strategy: string,
) {
  return candidates.toSorted((left, right) => {
    const leftFit = strategyFit(left.position, strategy);
    const rightFit = strategyFit(right.position, strategy);
    const leftDrain = left.leagueAdjustedValue - left.rosterSpecificValue;
    const rightDrain = right.leagueAdjustedValue - right.rosterSpecificValue;
    return (
      rightDrain + rightFit - (leftDrain + leftFit) ||
      left.name.localeCompare(right.name)
    );
  })[0];
}

function strategyFit(position: string, strategy: string): number {
  if (strategy === "zero_rb" && position === "RB") return 8;
  if (strategy === "late_qb" && position === "QB") return 7;
  if (strategy === "punt_position") return 3;
  return 0;
}

function nominationReason(
  candidate: {
    leagueAdjustedValue: number;
    rosterSpecificValue: number;
  },
  strategy: string,
): string {
  return candidate.leagueAdjustedValue > candidate.rosterSpecificValue
    ? `market cost exceeds roster fit, encouraging opponent budget spend under ${strategy.replaceAll("_", " ")}`
    : `fits the ${strategy.replaceAll("_", " ")} plan without exceeding the modeled value`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
