export type ChoppedTeamInput = {
  rosterId: number;
  name: string;
  currentPoints: number;
  projectedRemaining: number;
  floorRemaining: number;
  ceilingRemaining: number;
  lockedPoints: number;
  injuryExposure: number;
  faabRemaining: number;
  eliminated: boolean;
};

export type ReleasedPlayerInput = {
  playerId: string;
  name: string;
  position: string;
  value: number;
};

export type ChoppedTeamProjection = ChoppedTeamInput & {
  projectedFinal: number;
  floor: number;
  ceiling: number;
  probabilityLast: number;
  survivalProbability: number;
  distanceFromSafety: number;
  rank: number;
};

export type ChoppedAnalysis = {
  teams: ChoppedTeamProjection[];
  chopZone: ChoppedTeamProjection | null;
  user: ChoppedTeamProjection | null;
  lineupApproach: "floor_first" | "balanced" | "ceiling_required";
  faabRecommendation: string;
  expectedFutureReleaseQuality: "low" | "moderate" | "high";
  releasedPlayerTargets: ReleasedPlayerInput[];
  tradeMessage: string;
  tiebreakerMessage: string;
  bestBallMessage: string | null;
  warnings: string[];
};

export function analyzeChoppedLeague(input: {
  teams: ChoppedTeamInput[];
  userRosterId: number | null;
  releasedPlayers?: ReleasedPlayerInput[];
  tradesEnabled: boolean;
  bestBall: boolean;
  tiebreaker: string | null;
}): ChoppedAnalysis {
  const active = input.teams.filter((team) => !team.eliminated);
  const projected = active.map((team) => ({
    ...team,
    projectedFinal: round(team.currentPoints + team.projectedRemaining),
    floor: round(team.currentPoints + team.floorRemaining),
    ceiling: round(team.currentPoints + team.ceilingRemaining),
    probabilityLast: 0,
    survivalProbability: 1,
    distanceFromSafety: 0,
    rank: 0,
  }));

  const rawLast = projected.map((team) => {
    const deviation = Math.max(2.5, (team.ceiling - team.floor) / 3.29);
    return projected.reduce((probability, opponent) => {
      if (opponent.rosterId === team.rosterId) return probability;
      const opponentDeviation = Math.max(
        2.5,
        (opponent.ceiling - opponent.floor) / 3.29,
      );
      const combined = Math.sqrt(
        deviation * deviation + opponentDeviation * opponentDeviation,
      );
      return (
        probability *
        normalCdf((opponent.projectedFinal - team.projectedFinal) / combined)
      );
    }, 1);
  });
  const total = rawLast.reduce((sum, value) => sum + value, 0);
  const safetyLine = projected
    .map((team) => team.projectedFinal)
    .toSorted((left, right) => left - right)[1];

  const teams = projected
    .map((team, index) => {
      const probabilityLast =
        total > 0
          ? (rawLast[index] ?? 0) / total
          : 1 / Math.max(1, active.length);
      return {
        ...team,
        probabilityLast: roundProbability(probabilityLast),
        survivalProbability: roundProbability(1 - probabilityLast),
        distanceFromSafety: round(
          team.projectedFinal - (safetyLine ?? team.projectedFinal),
        ),
      };
    })
    .toSorted(
      (left, right) =>
        right.projectedFinal - left.projectedFinal ||
        left.rosterId - right.rosterId,
    )
    .map((team, index) => ({ ...team, rank: index + 1 }));

  const chopZone =
    teams.toSorted(
      (left, right) =>
        right.probabilityLast - left.probabilityLast ||
        left.projectedFinal - right.projectedFinal,
    )[0] ?? null;
  const user =
    teams.find((team) => team.rosterId === input.userRosterId) ?? null;
  const lineupApproach = approachFor(user);
  const averageFaab = average(teams.map((team) => team.faabRemaining));
  const expectedFutureReleaseQuality = releaseQuality(teams);
  const warnings: string[] = [];
  if (teams.length < 2)
    warnings.push(
      "Fewer than two active teams remain; survival odds are final.",
    );
  if (teams.some((team) => team.projectedRemaining <= 0))
    warnings.push(
      "At least one roster has no usable remaining projection; odds are conservative.",
    );
  if (!input.tiebreaker && hasNearTie(teams))
    warnings.push(
      "The chop-zone projection is nearly tied and Sleeper does not expose a tiebreak rule for this league.",
    );

  return {
    teams,
    chopZone,
    user,
    lineupApproach,
    faabRecommendation: faabAdvice(
      user,
      averageFaab,
      expectedFutureReleaseQuality,
    ),
    expectedFutureReleaseQuality,
    releasedPlayerTargets: (input.releasedPlayers ?? [])
      .toSorted((left, right) => right.value - left.value)
      .slice(0, 8),
    tradeMessage: input.tradesEnabled
      ? "Trades are enabled; price survival upgrades against expected future releases."
      : "Trades are disabled; build survival plans through legal waivers and roster depth.",
    tiebreakerMessage: input.tiebreaker
      ? `Modeled tiebreaker: ${input.tiebreaker}.`
      : "Tiebreaker unavailable from Sleeper; confirm the commissioner rule before a tied finish.",
    bestBallMessage: input.bestBall
      ? "Best Ball hybrid: Sleeper chooses the legal scoring lineup, so this model emphasizes roster floor, ceiling, depth, correlation, and injury resilience."
      : null,
    warnings,
  };
}

function approachFor(
  user: ChoppedTeamProjection | null,
): ChoppedAnalysis["lineupApproach"] {
  if (!user) return "balanced";
  if (user.probabilityLast >= 0.3 || user.distanceFromSafety < -8)
    return "ceiling_required";
  if (user.probabilityLast <= 0.12 && user.distanceFromSafety > 8)
    return "floor_first";
  return "balanced";
}

function faabAdvice(
  user: ChoppedTeamProjection | null,
  averageFaab: number,
  futureQuality: ChoppedAnalysis["expectedFutureReleaseQuality"],
): string {
  if (!user) return "Select a roster before sizing a survival bid.";
  if (user.probabilityLast >= 0.3)
    return "Survival is urgent: prioritize an immediate floor or ceiling upgrade even above the league-average budget pace.";
  if (user.faabRemaining < averageFaab * 0.55)
    return "Budget is below the field: preserve flexibility and target narrower role upgrades.";
  if (futureQuality === "high")
    return "Current safety is adequate: preserve meaningful FAAB for stronger future eliminated-roster releases.";
  return "Balance present-week improvement against the next projected release wave.";
}

function releaseQuality(
  teams: ChoppedTeamProjection[],
): ChoppedAnalysis["expectedFutureReleaseQuality"] {
  const riskTeam = teams.toSorted(
    (left, right) => right.probabilityLast - left.probabilityLast,
  )[0];
  if (!riskTeam) return "low";
  const signal =
    riskTeam.ceiling - riskTeam.floor + riskTeam.projectedFinal / 8;
  return signal >= 45 ? "high" : signal >= 28 ? "moderate" : "low";
}

function hasNearTie(teams: ChoppedTeamProjection[]): boolean {
  const ordered = teams
    .map((team) => team.projectedFinal)
    .toSorted((left, right) => left - right);
  const first = ordered[0];
  const second = ordered[1];
  return (
    first !== undefined &&
    second !== undefined &&
    Math.abs(second - first) <= 0.5
  );
}

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    sign *
    (1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
        t +
        0.254829592) *
        t *
        Math.exp(-x * x));
  return (1 + erf) / 2;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundProbability(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 10_000) / 10_000;
}
