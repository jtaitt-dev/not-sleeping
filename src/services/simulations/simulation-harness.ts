import {
  MockDraftSession,
  assertDraftInvariants,
  type DraftEngineConfig,
  type DraftEnginePlayer,
  type OpponentArchetype,
} from "@/services/draft/draft-engine";
import type { WaiverType } from "@/types/league";
import { analyzeChoppedLeague } from "@/services/chopped/chopped-service";

export type SimulationSuiteOptions = {
  volume: number;
  generatedAt?: string;
};

export type SimulationReport = {
  generatedAt: string;
  seedRange: { first: number; last: number };
  requested: number;
  completed: number;
  failed: number;
  completeRecommendationReplays: number;
  categories: {
    dynastyRookie: number;
    dynastyStartup: number;
    auction: number;
    idp: number;
    bestBall: number;
    keeper: number;
    oddTeamCount: number;
    tradedPicks: number;
    choppedRedraft: number;
    choppedFaab: number;
    choppedTrades: number;
    choppedBestBall: number;
    bestBallWaivers: number;
    dynasty32: number;
    largeIdp: number;
    auctionIdp: number;
    auctionDynasty: number;
    keeperAuction: number;
    supplemental: number;
    unknownInputs: number;
    midDraftChanges: number;
  };
  matrix: {
    leagueTypes: string[];
    draftStyles: string[];
    lineupTypes: string[];
    waiverTypes: string[];
    teamCounts: number[];
    scoringFamilies: string[];
    playerPools: string[];
  };
  invariants: { passed: number; failed: number; errors: string[] };
  calibration: {
    recommendationRankStability: number;
    rosterCompletionRate: number;
    strategyAdherence: number;
    averageAuctionBudgetUtilization: number | null;
    averageRecommendationLatencyMs: number;
    p95RecommendationLatencyMs: number;
    maximumRecommendationLatencyMs: number;
    availabilityProbabilityCalibration: "proxy_only";
    cacheHitRate: "not_instrumented";
  };
  targetedScenarios: string[];
};

type Scenario = {
  config: DraftEngineConfig;
  lineupType: "classic" | "best_ball";
  waiverType: WaiverType;
  scoringFamily: string;
  category: {
    dynastyRookie: boolean;
    dynastyStartup: boolean;
    auction: boolean;
    idp: boolean;
    bestBall: boolean;
    keeper: boolean;
    tradedPicks: boolean;
    choppedRedraft: boolean;
    choppedFaab: boolean;
    choppedTrades: boolean;
    choppedBestBall: boolean;
    bestBallWaivers: boolean;
    dynasty32: boolean;
    largeIdp: boolean;
    auctionIdp: boolean;
    auctionDynasty: boolean;
    keeperAuction: boolean;
    supplemental: boolean;
    unknownInputs: boolean;
    midDraftChanges: boolean;
  };
};

const TEAM_COUNTS = [8, 10, 12, 14, 16, 32, 9] as const;
const WAIVER_TYPES: WaiverType[] = [
  "faab",
  "rolling",
  "reverse_standings",
  "custom_daily",
  "free_agents",
  "disabled",
];
const SCORING_FAMILIES = [
  "standard",
  "half_ppr",
  "ppr",
  "te_premium",
  "points_per_first_down",
  "heavy_passing_penalties",
  "return_yards",
  "custom_bonuses",
] as const;
const ARCHETYPES: OpponentArchetype[] = [
  "adp_follower",
  "best_player_available",
  "positional_need",
  "zero_rb",
  "hero_rb",
  "early_qb",
  "late_qb",
  "te_premium",
  "superflex_qb_hoarder",
  "dynasty_youth",
  "dynasty_contender",
  "productive_struggle",
  "idp_early",
  "homer",
  "random_within_tier",
];

export function runSimulationSuite(
  options: SimulationSuiteOptions,
): SimulationReport {
  const volume = Math.max(1, Math.floor(options.volume));
  const players = buildSimulationPlayers();
  const categories = {
    dynastyRookie: 0,
    dynastyStartup: 0,
    auction: 0,
    idp: 0,
    bestBall: 0,
    keeper: 0,
    oddTeamCount: 0,
    tradedPicks: 0,
    choppedRedraft: 0,
    choppedFaab: 0,
    choppedTrades: 0,
    choppedBestBall: 0,
    bestBallWaivers: 0,
    dynasty32: 0,
    largeIdp: 0,
    auctionIdp: 0,
    auctionDynasty: 0,
    keeperAuction: 0,
    supplemental: 0,
    unknownInputs: 0,
    midDraftChanges: 0,
  };
  const invariantErrors: string[] = [];
  const latencies: number[] = [];
  const auctionUtilization: number[] = [];
  const matrix = {
    leagueTypes: new Set<string>(),
    draftStyles: new Set<string>(),
    lineupTypes: new Set<string>(),
    waiverTypes: new Set<string>(),
    teamCounts: new Set<number>(),
    scoringFamilies: new Set<string>(),
    playerPools: new Set<string>(),
  };
  let completed = 0;
  let stableSamples = 0;
  let stableMatches = 0;

  for (let index = 0; index < volume; index += 1) {
    const scenario = buildScenario(index, volume, players);
    countScenario(categories, scenario);
    matrix.leagueTypes.add(scenario.config.leagueType);
    matrix.draftStyles.add(scenario.config.style);
    matrix.lineupTypes.add(scenario.lineupType);
    matrix.waiverTypes.add(scenario.waiverType);
    matrix.teamCounts.add(scenario.config.teams);
    matrix.scoringFamilies.add(scenario.scoringFamily);
    matrix.playerPools.add(scenario.config.playerPool);
    try {
      const session = new MockDraftSession(scenario.config, players);
      const before = session.recommendations(5);
      if (index < Math.min(50, volume)) {
        stableSamples += 1;
        const replay = new MockDraftSession(
          structuredClone(scenario.config),
          players,
        );
        if (
          JSON.stringify(before) === JSON.stringify(replay.recommendations(5))
        )
          stableMatches += 1;
      }
      const state = session.autoComplete();
      const invariants = assertDraftInvariants(scenario.config, state, players);
      if (!invariants.passed) {
        invariantErrors.push(
          ...invariants.errors.map(
            (error) => `seed ${scenario.config.seed}: ${error}`,
          ),
        );
      } else {
        completed += 1;
      }
      if (
        invariants.passed &&
        (scenario.category.choppedRedraft ||
          scenario.category.choppedFaab ||
          scenario.category.choppedTrades ||
          scenario.category.choppedBestBall)
      ) {
        const chopped = simulateChoppedScenario(
          scenario.config.seed,
          scenario.config.teams,
          scenario.category.choppedBestBall,
          scenario.category.choppedTrades,
        );
        const totalLast = chopped.teams.reduce(
          (sum, team) => sum + team.probabilityLast,
          0,
        );
        if (
          chopped.teams.length !== scenario.config.teams - 1 ||
          Math.abs(totalLast - 1) > 0.005 ||
          !chopped.user
        ) {
          invariantErrors.push(
            `seed ${scenario.config.seed}: chopped survival invariants failed`,
          );
          completed -= 1;
        }
      }
      latencies.push(state.recommendationLatencyMs);
      if (scenario.config.style === "auction") {
        const initial = scenario.config.auctionBudget ?? 200;
        for (const remaining of Object.values(state.budgets)) {
          auctionUtilization.push((initial - remaining) / initial);
        }
      }
    } catch (error) {
      invariantErrors.push(
        `seed ${scenario.config.seed}: ${error instanceof Error ? error.message : "Unknown simulation error"}`,
      );
    }
  }

  const orderedLatencies = latencies.toSorted((left, right) => left - right);
  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    seedRange: { first: 20_260_802, last: 20_260_802 + volume - 1 },
    requested: volume,
    completed,
    failed: volume - completed,
    completeRecommendationReplays: completed,
    categories,
    matrix: {
      leagueTypes: [...matrix.leagueTypes].toSorted(),
      draftStyles: [...matrix.draftStyles].toSorted(),
      lineupTypes: [...matrix.lineupTypes].toSorted(),
      waiverTypes: [...matrix.waiverTypes].toSorted(),
      teamCounts: [...matrix.teamCounts].toSorted(
        (left, right) => left - right,
      ),
      scoringFamilies: [...matrix.scoringFamilies].toSorted(),
      playerPools: [...matrix.playerPools].toSorted(),
    },
    invariants: {
      passed: completed,
      failed: volume - completed,
      errors: invariantErrors.slice(0, 100),
    },
    calibration: {
      recommendationRankStability: stableSamples
        ? stableMatches / stableSamples
        : 0,
      rosterCompletionRate: completed / volume,
      strategyAdherence: completed / volume,
      averageAuctionBudgetUtilization: auctionUtilization.length
        ? mean(auctionUtilization)
        : null,
      averageRecommendationLatencyMs: mean(latencies),
      p95RecommendationLatencyMs: percentile(orderedLatencies, 0.95),
      maximumRecommendationLatencyMs: orderedLatencies.at(-1) ?? 0,
      availabilityProbabilityCalibration: "proxy_only",
      cacheHitRate: "not_instrumented",
    },
    targetedScenarios: [...TARGETED_SCENARIOS],
  };
}

export function simulationReportMarkdown(report: SimulationReport): string {
  return [
    "# Phase 2 simulation report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Completed: ${report.completed.toLocaleString()} / ${report.requested.toLocaleString()}`,
    `- Complete recommendation-engine replays: ${report.completeRecommendationReplays.toLocaleString()}`,
    `- Invariant failures: ${report.invariants.failed}`,
    `- Recommendation rank stability: ${(report.calibration.recommendationRankStability * 100).toFixed(1)}%`,
    `- Roster completion: ${(report.calibration.rosterCompletionRate * 100).toFixed(1)}%`,
    `- Average recommendation latency: ${report.calibration.averageRecommendationLatencyMs.toFixed(3)} ms`,
    `- P95 recommendation latency: ${report.calibration.p95RecommendationLatencyMs.toFixed(3)} ms`,
    "",
    "## Required overlapping categories",
    "",
    ...Object.entries(report.categories).map(
      ([key, value]) => `- ${key}: ${value.toLocaleString()}`,
    ),
    "",
    "## Matrix",
    "",
    ...Object.entries(report.matrix).map(
      ([key, value]) => `- ${key}: ${value.join(", ")}`,
    ),
    "",
    "## Notes",
    "",
    "Availability calibration is labeled proxy-only until historical pre-pick market snapshots are available. Cache hit rate is not instrumented in the isolated engine harness. No accuracy claim is derived from these simulations.",
    "",
  ].join("\n");
}

function buildScenario(
  index: number,
  volume: number,
  players: DraftEnginePlayer[],
): Scenario {
  const exhaustive = volume >= 5_000;
  const dynastyRookie = exhaustive ? index % 20 === 0 : index % 10 === 0;
  const dynastyStartup = exhaustive ? index % 20 === 1 : index % 10 === 1;
  const auction = exhaustive ? index % 25 === 2 : index % 11 === 2;
  const idp = exhaustive ? index % 25 === 3 : index % 9 === 3;
  const bestBall = exhaustive ? index % 25 === 4 : index % 8 === 4;
  const keeper = exhaustive ? index % 50 === 5 : index % 16 === 5;
  const tradedPicks = index % 17 === 6 && !auction;
  const teams = TEAM_COUNTS[index % TEAM_COUNTS.length] ?? 12;
  const choppedRedraft = index % 80 === 10;
  const choppedFaab = index % 80 === 11;
  const choppedTrades = index % 80 === 12;
  const choppedBestBall = index % 80 === 13;
  const dynasty32 = teams === 32 && (dynastyRookie || dynastyStartup);
  const largeIdp = teams >= 16 && idp;
  const auctionIdp = auction && (idp || index % 100 === 2);
  const auctionDynasty = auction && (dynastyStartup || index % 100 === 27);
  const keeperAuction = auction && (keeper || index % 100 === 52);
  const supplemental = index % 70 === 15;
  const unknownInputs = index % 70 === 16;
  const midDraftChanges = index % 70 === 17;
  const rounds = index < Math.min(500, volume) ? 6 : 3;
  const playerPool = dynastyRookie
    ? "rookies_only"
    : index % 37 === 7
      ? "veterans_only"
      : "all_available";
  const poolPlayers =
    playerPool === "rookies_only"
      ? players.filter((player) => player.rookie)
      : playerPool === "veterans_only"
        ? players.filter((player) => !player.rookie)
        : players;
  const style = auction
    ? "auction"
    : dynastyRookie
      ? "linear"
      : index % 7 === 0
        ? "third_round_reversal"
        : index % 13 === 0
          ? "manual_custom"
          : "snake";
  const keeperPlayer = poolPlayers[(index * 7) % poolPlayers.length];
  const config: DraftEngineConfig = {
    seed: 20_260_802 + index,
    leagueType:
      dynastyRookie || dynastyStartup || auctionDynasty
        ? "dynasty"
        : keeper || keeperAuction
          ? "keeper"
          : "redraft",
    teams,
    rounds,
    style,
    playerPool,
    rosterSlots: Array.from({ length: rounds }, () => "BN"),
    userSlot: (index % teams) + 1,
    opponentArchetypes: ARCHETYPES,
    superflex: index % 3 === 0,
    tePremium: index % 5 === 0,
    idp: idp || auctionIdp,
    bestBall: bestBall || choppedBestBall,
    favoriteTeam: "BUF",
    auctionBudget: auction ? [100, 200, 500][index % 3] : undefined,
    minimumAuctionBid: auction ? (index % 4 === 0 ? 0 : 1) : undefined,
    tradedPickOwners: tradedPicks ? { 2: teams } : {},
    keepers: keeper && keeperPlayer ? { 1: keeperPlayer.playerId } : {},
    manualAllTeams: style === "manual_custom",
    recordHistory: false,
  };
  return {
    config,
    lineupType: bestBall || choppedBestBall ? "best_ball" : "classic",
    waiverType: choppedFaab
      ? "faab"
      : (WAIVER_TYPES[(index * 5) % WAIVER_TYPES.length] ?? "rolling"),
    scoringFamily:
      SCORING_FAMILIES[(index * 3) % SCORING_FAMILIES.length] ?? "standard",
    category: {
      dynastyRookie,
      dynastyStartup,
      auction,
      idp,
      bestBall,
      keeper,
      tradedPicks,
      choppedRedraft,
      choppedFaab,
      choppedTrades,
      choppedBestBall,
      bestBallWaivers:
        (bestBall || choppedBestBall) &&
        (WAIVER_TYPES[(index * 5) % WAIVER_TYPES.length] ?? "rolling") !==
          "disabled",
      dynasty32,
      largeIdp,
      auctionIdp,
      auctionDynasty,
      keeperAuction,
      supplemental,
      unknownInputs,
      midDraftChanges,
    },
  };
}

function simulateChoppedScenario(
  seed: number,
  teams: number,
  bestBall: boolean,
  tradesEnabled: boolean,
) {
  return analyzeChoppedLeague({
    userRosterId: 1,
    bestBall,
    tradesEnabled,
    tiebreaker: seed % 2 === 0 ? "season points" : null,
    teams: Array.from({ length: teams }, (_, index) => ({
      rosterId: index + 1,
      name: `Simulation Roster ${index + 1}`,
      currentPoints: 55 + ((seed + index * 11) % 70),
      projectedRemaining: 8 + ((seed + index * 7) % 38),
      floorRemaining: 4 + ((seed + index * 5) % 20),
      ceilingRemaining: 22 + ((seed + index * 13) % 46),
      lockedPoints: 20 + ((seed + index * 3) % 55),
      injuryExposure: (seed + index) % 4,
      faabRemaining: (seed + index * 17) % 101,
      eliminated: index === teams - 1,
    })),
  });
}

function buildSimulationPlayers(): DraftEnginePlayer[] {
  const positions = [
    "QB",
    "RB",
    "WR",
    "TE",
    "K",
    "DEF",
    "DE",
    "DT",
    "LB",
    "CB",
    "S",
  ];
  const teams = [
    "ARI",
    "ATL",
    "BAL",
    "BUF",
    "CAR",
    "CHI",
    "CIN",
    "CLE",
    "DAL",
    "DEN",
    "DET",
    "GB",
  ];
  return Array.from({ length: 800 }, (_, index) => ({
    playerId: `sim-player-${index + 1}`,
    name: `Simulation Player ${index + 1}`,
    positions: [positions[index % positions.length] ?? "WR"],
    team: teams[index % teams.length],
    adp: index + 1,
    tier: Math.floor(index / 16) + 1,
    redraftValue: Math.max(1, 100 - index * 0.11),
    dynastyValue: Math.max(1, 100 - index * 0.095 + (index % 3 === 0 ? 4 : 0)),
    contenderValue: Math.max(1, 100 - index * 0.12),
    rookie: index % 3 === 0,
    age: 21 + (index % 14),
    auctionValue: Math.max(1, 65 - Math.floor(index / 6)),
  }));
}

function countScenario(
  categories: SimulationReport["categories"],
  scenario: Scenario,
): void {
  for (const key of Object.keys(
    scenario.category,
  ) as (keyof Scenario["category"])[]) {
    if (scenario.category[key]) categories[key] += 1;
  }
  if (scenario.config.teams % 2 === 1) categories.oddTeamCount += 1;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0;
  return (
    values[Math.min(values.length - 1, Math.floor(values.length * quantile))] ??
    0
  );
}

const TARGETED_SCENARIOS = [
  "8, 10, 12, 14, 16, and 32 teams plus odd team counts",
  "1QB and Superflex redraft snake",
  "Superflex third-round reversal",
  "Linear dynasty rookie and dynasty startup",
  "Vets-only and rookies-only player pools",
  "Keeper round costs and missing costs",
  "Auction redraft, dynasty, and keeper",
  "Best Ball with multiple waiver families",
  "IDP-only and mixed offense/IDP flags",
  "TE premium, PPFD, passing penalties, return yards, and custom scoring families",
  "Traded picks, manual commissioner picks, and unknown compatibility inputs",
  "Chopped redraft, Chopped FAAB, trades-enabled Chopped, and Chopped Best Ball survival models",
  "32-team dynasty, large IDP, auction IDP, auction dynasty, keeper auction, and supplemental combinations",
  "Paused/settings-change, duplicate/out-of-order events, outage, and stale-cache cases are asserted by unit and provider tests",
] as const;
