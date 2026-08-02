export type DynastyTeamProfile = {
  starterStrength: number;
  depth: number;
  youth: number;
  ageRisk: number;
  injuryRisk: number;
  pickCapital: number;
  futurePickDistribution: number;
  marketValue: number;
  expectedPoints: number;
  leagueStrength: number;
  playoffOdds: number;
  taxiAssets: number;
  rookieAssets: number;
  rosterFlexibility: number;
};

export type DynastyDirection = {
  contender: number;
  balanced: number;
  productiveStruggle: number;
  rebuild: number;
  primary: "contender" | "balanced" | "productive_struggle" | "rebuild";
  conflicts: string[];
};

export type FuturePickValue = {
  season: string;
  round: number;
  originalRosterId: number;
  ownerRosterId: number;
  expectedRange: "early" | "mid" | "late" | "wide";
  marketValue: number;
  productionValue: number;
  liquidity: number;
  uncertainty: number;
};

export type DynastyScenarioAsset = {
  id: string;
  label: string;
  type: "player" | "pick";
  position?: string;
  marketValue: number;
  productionValue: number;
  age?: number;
  injured?: boolean;
  taxiEligible?: boolean;
};

export type OrphanRosterAnalysis = {
  immediateCompetitiveness: number;
  futureFlexibility: number;
  takeoverDifficulty: "low" | "moderate" | "high";
  strengths: string[];
  risks: string[];
  priorities: string[];
  noWriteBoundary: string;
};

export type DispersalPoolAnalysis = {
  teamCount: number;
  assetCount: number;
  assetsPerTeam: number;
  positionScarcity: Array<{ position: string; perTeam: number }>;
  warnings: string[];
};

export function calculateDynastyDirection(
  profile: DynastyTeamProfile,
): DynastyDirection {
  const contender = score([
    [profile.starterStrength, 0.24],
    [profile.depth, 0.14],
    [profile.expectedPoints, 0.2],
    [profile.playoffOdds, 0.22],
    [1 - profile.injuryRisk, 0.08],
    [profile.rosterFlexibility, 0.12],
  ]);
  const rebuild = score([
    [profile.youth, 0.2],
    [profile.pickCapital, 0.22],
    [profile.futurePickDistribution, 0.12],
    [profile.rookieAssets, 0.13],
    [profile.taxiAssets, 0.08],
    [1 - profile.playoffOdds, 0.17],
    [profile.rosterFlexibility, 0.08],
  ]);
  const productiveStruggle = score([
    [profile.youth, 0.18],
    [profile.pickCapital, 0.18],
    [profile.marketValue, 0.16],
    [1 - profile.expectedPoints, 0.18],
    [1 - profile.playoffOdds, 0.14],
    [profile.rosterFlexibility, 0.16],
  ]);
  const balanced = score([
    [1 - Math.abs(profile.starterStrength - 0.55), 0.22],
    [profile.depth, 0.14],
    [profile.marketValue, 0.18],
    [profile.pickCapital, 0.14],
    [profile.rosterFlexibility, 0.18],
    [1 - profile.ageRisk, 0.14],
  ]);
  const values = { contender, balanced, productiveStruggle, rebuild };
  const primary =
    Object.entries(values).toSorted(
      (left, right) => right[1] - left[1],
    )[0]?.[0] ?? "balanced";
  const conflicts = [
    ...(contender >= 65 && rebuild >= 65
      ? [
          "Strong current lineup and strong future capital support multiple viable windows.",
        ]
      : []),
    ...(profile.ageRisk >= 0.7 && profile.playoffOdds >= 0.65
      ? ["High playoff odds conflict with an aging roster window."]
      : []),
    ...(profile.marketValue >= 0.7 && profile.expectedPoints <= 0.4
      ? ["Market value is materially stronger than current production."]
      : []),
  ];
  return {
    contender,
    balanced,
    productiveStruggle,
    rebuild,
    primary:
      primary === "productiveStruggle"
        ? "productive_struggle"
        : (primary as DynastyDirection["primary"]),
    conflicts,
  };
}

export function valueFuturePick(input: {
  season: string;
  round: number;
  originalRosterId: number;
  ownerRosterId: number;
  teamStrength?: number | null;
  classStrength?: number | null;
  yearsAway: number;
}): FuturePickValue {
  const teamStrength = input.teamStrength;
  const range =
    teamStrength === null || teamStrength === undefined
      ? "wide"
      : teamStrength < 0.35
        ? "early"
        : teamStrength > 0.68
          ? "late"
          : "mid";
  const roundBase = [0, 82, 44, 24, 14, 8, 5, 3][input.round] ?? 2;
  const rangeMultiplier =
    range === "early" ? 1.22 : range === "late" ? 0.82 : 1;
  const classMultiplier = 0.85 + clamp(input.classStrength ?? 0.5, 0, 1) * 0.3;
  const discount = 1 / (1 + Math.max(0, input.yearsAway) * 0.12);
  const marketValue = round(
    roundBase * rangeMultiplier * classMultiplier * discount,
  );
  return {
    season: input.season,
    round: input.round,
    originalRosterId: input.originalRosterId,
    ownerRosterId: input.ownerRosterId,
    expectedRange: range,
    marketValue,
    productionValue: round(marketValue * (range === "wide" ? 0.72 : 0.82)),
    liquidity: round(
      clamp(
        0.95 - input.yearsAway * 0.08 - (input.round - 1) * 0.06,
        0.35,
        0.95,
      ),
    ),
    uncertainty: round(
      clamp(
        0.22 + input.yearsAway * 0.15 + (range === "wide" ? 0.22 : 0),
        0.15,
        0.85,
      ),
    ),
  };
}

export function analyzeOrphanRoster(input: {
  assets: DynastyScenarioAsset[];
  requiredRosterSize: number;
  futurePickYears: number;
}): OrphanRosterAnalysis {
  const players = input.assets.filter((asset) => asset.type === "player");
  const picks = input.assets.filter((asset) => asset.type === "pick");
  const production = average(players.map((asset) => asset.productionValue));
  const market = average(input.assets.map((asset) => asset.marketValue));
  const youngShare =
    players.filter((asset) => asset.age !== undefined && asset.age <= 25)
      .length / Math.max(1, players.length);
  const injuryShare =
    players.filter((asset) => asset.injured).length /
    Math.max(1, players.length);
  const rosterCompleteness = clamp(
    players.length / Math.max(1, input.requiredRosterSize),
    0,
    1,
  );
  const pickDepth = clamp(
    picks.length / Math.max(1, input.futurePickYears * 3),
    0,
    1,
  );
  const immediateCompetitiveness = round(
    clamp(production / 100, 0, 1) * 65 + rosterCompleteness * 35,
  );
  const futureFlexibility = round(
    clamp(market / 100, 0, 1) * 35 + youngShare * 35 + pickDepth * 30,
  );
  const difficultyScore =
    100 - (immediateCompetitiveness * 0.45 + futureFlexibility * 0.55);
  return {
    immediateCompetitiveness,
    futureFlexibility,
    takeoverDifficulty:
      difficultyScore >= 60
        ? "high"
        : difficultyScore >= 35
          ? "moderate"
          : "low",
    strengths: [
      ...(youngShare >= 0.4 ? ["Meaningful young-player foundation"] : []),
      ...(pickDepth >= 0.55 ? ["Flexible multi-year pick inventory"] : []),
      ...(production >= 65 ? ["Competitive current production"] : []),
      ...(market >= 65 ? ["Liquid market-value base"] : []),
    ],
    risks: [
      ...(injuryShare >= 0.2 ? ["Concentrated injury exposure"] : []),
      ...(rosterCompleteness < 0.85
        ? ["Open roster spots require replacement assets"]
        : []),
      ...(pickDepth < 0.3 ? ["Thin future-pick inventory"] : []),
      ...(youngShare < 0.25 ? ["Aging curve limits the rebuild runway"] : []),
    ],
    priorities: [
      "Verify original and current future-pick ownership.",
      "Model legal cuts, taxi eligibility, and replacement options.",
      difficultyScore >= 45
        ? "Preserve liquidity before consolidating assets."
        : "Explore consolidation without sacrificing future flexibility.",
    ],
    noWriteBoundary:
      "Scenario analysis only — roster takeovers and dispersal allocations remain manual.",
  };
}

export function analyzeDispersalPool(input: {
  assets: DynastyScenarioAsset[];
  teamCount: number;
}): DispersalPoolAnalysis {
  const teamCount = Math.max(1, Math.floor(input.teamCount));
  const counts = input.assets.reduce<Record<string, number>>(
    (result, asset) => {
      const position =
        asset.type === "pick"
          ? "PICK"
          : (asset.position?.toUpperCase() ?? "OTHER");
      result[position] = (result[position] ?? 0) + 1;
      return result;
    },
    {},
  );
  const positionScarcity = Object.entries(counts)
    .map(([position, count]) => ({
      position,
      perTeam: round(count / teamCount),
    }))
    .toSorted(
      (left, right) =>
        left.perTeam - right.perTeam ||
        left.position.localeCompare(right.position),
    );
  return {
    teamCount,
    assetCount: input.assets.length,
    assetsPerTeam: round(input.assets.length / teamCount),
    positionScarcity,
    warnings: [
      ...(input.assets.length < teamCount
        ? ["There are fewer assets than participating teams."]
        : []),
      ...(positionScarcity.some(
        (entry) => entry.position !== "PICK" && entry.perTeam < 1,
      )
        ? ["At least one position cannot supply one asset per team."]
        : []),
      "Draft order, keepers, contracts, and commissioner exceptions require manual confirmation.",
    ],
  };
}

function score(values: [number, number][]): number {
  return round(
    clamp(
      values.reduce(
        (sum, [value, weight]) => sum + clamp(value, 0, 1) * weight,
        0,
      ),
      0,
      1,
    ) * 100,
  );
}

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
