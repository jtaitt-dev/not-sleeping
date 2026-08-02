export type MatchupPlayerProjection = {
  playerId: string;
  name: string;
  position: string;
  team?: string;
  projectedPoints: number | null;
  currentPoints: number;
  locked?: boolean;
  status?: string;
};

export type MatchupTeamInput = {
  rosterId: number;
  name: string;
  currentPoints: number;
  starters: MatchupPlayerProjection[];
};

export type MatchupTeamDistribution = {
  rosterId: number;
  name: string;
  projectedFinal: number;
  floor: number;
  ceiling: number;
  standardDeviation: number;
  remainingPlayers: number;
  lockedPlayers: number;
  injuryExposure: number;
  correlationPairs: number;
};

export type PositionComparison = {
  position: string;
  user: number;
  opponent: number;
  edge: number;
};

export type MatchupProjection = {
  user: MatchupTeamDistribution;
  opponent: MatchupTeamDistribution | null;
  headToHeadWinProbability: number | null;
  leagueMedianWinProbability: number | null;
  positionComparisons: PositionComparison[];
  biggestSwingPlayers: Array<{
    playerId: string;
    name: string;
    swing: number;
  }>;
  fragileAssumptions: string[];
};

export function projectMatchup(input: {
  user: MatchupTeamInput;
  opponent?: MatchupTeamInput | null;
  leagueTeams?: MatchupTeamInput[];
  weatherAdjustment?: number;
}): MatchupProjection {
  const user = teamDistribution(input.user, input.weatherAdjustment ?? 0);
  const opponent = input.opponent
    ? teamDistribution(input.opponent, input.weatherAdjustment ?? 0)
    : null;
  const headToHeadWinProbability = opponent
    ? probabilityGreater(
        user.projectedFinal,
        user.standardDeviation,
        opponent.projectedFinal,
        opponent.standardDeviation,
      )
    : null;
  const leagueDistributions = (input.leagueTeams ?? [])
    .filter((team) => team.rosterId !== input.user.rosterId)
    .map((team) => teamDistribution(team, 0));
  const medianMean = median(
    leagueDistributions.map((team) => team.projectedFinal),
  );
  const medianDeviation = median(
    leagueDistributions.map((team) => team.standardDeviation),
  );
  const leagueMedianWinProbability =
    medianMean === null
      ? null
      : probabilityGreater(
          user.projectedFinal,
          user.standardDeviation,
          medianMean,
          medianDeviation ?? 8,
        );
  const allPlayers = [
    ...input.user.starters,
    ...(input.opponent?.starters ?? []),
  ];
  const missing = allPlayers.filter(
    (player) => player.projectedPoints === null,
  ).length;
  const fragileAssumptions = [
    ...(missing > 0
      ? [
          `${missing} starter projection${missing === 1 ? " is" : "s are"} unavailable.`,
        ]
      : []),
    ...(!opponent
      ? ["No head-to-head opponent is assigned for this week."]
      : []),
    ...(input.weatherAdjustment === undefined
      ? ["Weather is not applied until a kickoff and stadium forecast resolve."]
      : []),
    ...(allPlayers.some((player) => isInjuryConcern(player.status))
      ? ["Injury designations may materially widen the score range."]
      : []),
  ];
  return {
    user,
    opponent,
    headToHeadWinProbability,
    leagueMedianWinProbability,
    positionComparisons: opponent
      ? comparePositions(input.user.starters, input.opponent?.starters ?? [])
      : [],
    biggestSwingPlayers: allPlayers
      .map((player) => ({
        playerId: player.playerId,
        name: player.name,
        swing: round(
          effectiveProjection(player) * positionVolatility(player.position),
        ),
      }))
      .toSorted(
        (left, right) =>
          right.swing - left.swing ||
          left.playerId.localeCompare(right.playerId),
      )
      .slice(0, 5),
    fragileAssumptions,
  };
}

function teamDistribution(
  team: MatchupTeamInput,
  weatherAdjustment: number,
): MatchupTeamDistribution {
  const remaining = team.starters.filter((player) => !player.locked);
  const remainingProjection = remaining.reduce(
    (sum, player) =>
      sum + Math.max(0, effectiveProjection(player) - player.currentPoints),
    0,
  );
  const projectedFinal = Math.max(
    team.currentPoints,
    team.currentPoints + remainingProjection + weatherAdjustment,
  );
  const variance = remaining.reduce((sum, player) => {
    const deviation =
      effectiveProjection(player) * positionVolatility(player.position);
    return sum + deviation * deviation;
  }, 0);
  const injuryExposure = team.starters.filter((player) =>
    isInjuryConcern(player.status),
  ).length;
  const standardDeviation = Math.max(
    2,
    Math.sqrt(variance) + injuryExposure * 1.25,
  );
  return {
    rosterId: team.rosterId,
    name: team.name,
    projectedFinal: round(projectedFinal),
    floor: round(
      Math.max(team.currentPoints, projectedFinal - standardDeviation * 1.15),
    ),
    ceiling: round(projectedFinal + standardDeviation * 1.15),
    standardDeviation: round(standardDeviation),
    remainingPlayers: remaining.length,
    lockedPlayers: team.starters.length - remaining.length,
    injuryExposure,
    correlationPairs: correlationPairs(team.starters),
  };
}

function comparePositions(
  user: MatchupPlayerProjection[],
  opponent: MatchupPlayerProjection[],
): PositionComparison[] {
  const positions = new Set([
    ...user.map((player) => player.position.toUpperCase()),
    ...opponent.map((player) => player.position.toUpperCase()),
  ]);
  return [...positions]
    .map((position) => {
      const userValue = sumPosition(user, position);
      const opponentValue = sumPosition(opponent, position);
      return {
        position,
        user: round(userValue),
        opponent: round(opponentValue),
        edge: round(userValue - opponentValue),
      };
    })
    .toSorted(
      (left, right) =>
        Math.abs(right.edge) - Math.abs(left.edge) ||
        left.position.localeCompare(right.position),
    );
}

function sumPosition(
  players: MatchupPlayerProjection[],
  position: string,
): number {
  return players
    .filter((player) => player.position.toUpperCase() === position)
    .reduce((sum, player) => sum + effectiveProjection(player), 0);
}

function effectiveProjection(player: MatchupPlayerProjection): number {
  return player.projectedPoints === null
    ? player.currentPoints
    : Math.max(player.currentPoints, player.projectedPoints);
}

function correlationPairs(players: MatchupPlayerProjection[]): number {
  let pairs = 0;
  for (let left = 0; left < players.length; left += 1) {
    for (let right = left + 1; right < players.length; right += 1) {
      const first = players[left];
      const second = players[right];
      if (!first?.team || first.team !== second?.team) continue;
      if (
        [first.position.toUpperCase(), second.position.toUpperCase()].includes(
          "QB",
        )
      ) {
        pairs += 1;
      }
    }
  }
  return pairs;
}

function isInjuryConcern(status?: string): boolean {
  return ["questionable", "doubtful", "out", "injured", "ir"].includes(
    status?.toLowerCase() ?? "",
  );
}

function positionVolatility(position: string): number {
  const normalized = position.toUpperCase();
  if (["WR", "TE", "DB", "CB", "S"].includes(normalized)) return 0.38;
  if (["K", "DEF", "DST", "DL", "DE", "DT"].includes(normalized)) return 0.42;
  if (["QB", "LB"].includes(normalized)) return 0.25;
  return 0.31;
}

function probabilityGreater(
  leftMean: number,
  leftDeviation: number,
  rightMean: number,
  rightDeviation: number,
): number {
  const combined = Math.max(
    0.001,
    Math.sqrt(leftDeviation ** 2 + rightDeviation ** 2),
  );
  return round(clamp(normalCdf((leftMean - rightMean) / combined), 0.01, 0.99));
}

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? null)
    : round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
