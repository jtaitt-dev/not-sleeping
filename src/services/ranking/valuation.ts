import type {
  DraftPick,
  LeagueFormat,
  Player,
  Recommendation,
  ScoreComponent,
  Strategy,
} from "@/types/domain";
import {
  rankDraftCandidates,
  type DraftEngineConfig,
  type DraftEnginePlayer,
  type OpponentArchetype,
} from "@/services/draft/draft-engine";

export type ValuationInputs = {
  importedRank?: number;
  importedTier?: number;
  adp?: number;
  projectedPoints?: number;
  redraftValue?: number;
  dynastyValue?: number;
  rookieValue?: number;
  historicalProduction?: number;
  recentProduction?: number;
  injuryRisk?: number;
  researchAdjustment?: number;
  sharedDraftScore?: number;
};

export type RankingContext = {
  format: LeagueFormat;
  strategy: Strategy;
  riskTolerance: number;
  currentPick: number;
  nextUserPick: number;
  rosterNeeds: Partial<Record<Player["position"], number>>;
  positionDemand: Partial<Record<Player["position"], number>>;
  remainingInTier: Partial<Record<Player["position"], number>>;
};

const DIRECT_ROSTER_POSITIONS: Player["position"][] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
  "DL",
  "LB",
  "DB",
];

const URGENT_STARTER_NEED = 10;

type PlayerScore = {
  player: Player;
  localScore: number;
  researchAdjustment: number;
  contextualScore: number;
  orderingScore: number;
  components: ScoreComponent[];
};

export function calculatePlayerScore(
  player: Player,
  inputs: ValuationInputs,
  context: RankingContext,
): PlayerScore {
  const baseline = baselineScore(player, inputs, context);
  const components: ScoreComponent[] = [
    {
      key: "baseline",
      label: "Baseline value",
      value: baseline,
      reason: "Imported ranks, projections, ADP, and local fallback value.",
    },
  ];

  const ageValue = ageCurveScore(player, context.strategy, context.format.mode);
  components.push({
    key: "age_curve",
    label: "Age curve",
    value: ageValue,
    reason: ageReason(player, ageValue),
  });

  const scarcity = scarcityScore(player, context);
  components.push({
    key: "scarcity",
    label: "Positional scarcity",
    value: scarcity,
    reason: `${context.remainingInTier[player.position] ?? 0} players remain in the current tier.`,
  });

  const rosterFit = clamp(
    (context.rosterNeeds[player.position] ?? 0) * 4,
    -8,
    8,
  );
  components.push({
    key: "roster_fit",
    label: "Roster fit",
    value: rosterFit,
    reason:
      rosterFit > 2
        ? "The roster has a meaningful need at this position."
        : "Roster construction does not force this position.",
  });

  const rosterCompletion =
    (context.rosterNeeds[player.position] ?? 0) >= URGENT_STARTER_NEED ? 40 : 0;
  components.push({
    key: "roster_completion",
    label: "Roster completion",
    value: rosterCompletion,
    reason:
      rosterCompletion > 0
        ? "The remaining draft slots must cover this unfilled starting position."
        : "Enough draft slots remain to address required starters later.",
  });

  const sharedDraftEngine =
    inputs.sharedDraftScore === undefined
      ? 0
      : clamp((inputs.sharedDraftScore - 65) / 6, -8, 8);
  components.push({
    key: "shared_draft_engine",
    label: "Shared draft engine",
    value: sharedDraftEngine,
    reason:
      inputs.sharedDraftScore === undefined
        ? "Shared-engine input is unavailable for this calculation."
        : "The deterministic engine used by live drafts and Mock Draft Lab evaluated this candidate.",
  });

  const formatAdjustment = formatAdjustmentScore(player, context);
  components.push({
    key: "format_adjustment",
    label: "League-format value",
    value: formatAdjustment,
    reason: formatAdjustmentReason(player, context),
  });

  const draftTiming = draftTimingScore(inputs.adp, context.currentPick);
  components.push({
    key: "draft_timing",
    label: "Draft timing",
    value: draftTiming,
    reason:
      inputs.adp === undefined
        ? "Imported ADP is unavailable, so no market-timing adjustment applies."
        : inputs.adp > context.currentPick
          ? `ADP ${inputs.adp} suggests this player may be available after the current pick.`
          : `ADP ${inputs.adp} is at or ahead of the current pick.`,
  });

  const draftCapital = draftCapitalScore(player);
  components.push({
    key: "draft_capital",
    label: "NFL draft capital",
    value: draftCapital,
    reason:
      player.nflDraftPick === undefined
        ? "Verified NFL draft capital is unavailable."
        : `Selected at NFL pick ${player.nflDraftPick}.`,
  });

  const injuryPenalty = -clamp(
    (inputs.injuryRisk ?? statusRisk(player)) * (1 - context.riskTolerance),
    0,
    8,
  );
  components.push({
    key: "risk",
    label: "Risk tolerance",
    value: injuryPenalty,
    reason: "Applies injury and status risk using the selected risk tolerance.",
  });

  const orderingScore =
    baseline +
    ageValue +
    scarcity +
    rosterFit +
    rosterCompletion +
    sharedDraftEngine +
    formatAdjustment +
    draftTiming +
    draftCapital +
    injuryPenalty;
  const localScore = clamp(orderingScore, 0, 100);
  const researchAdjustment = clamp(inputs.researchAdjustment ?? 0, -8, 8);
  return {
    player,
    localScore: round(localScore),
    researchAdjustment: round(researchAdjustment),
    contextualScore: round(clamp(localScore + researchAdjustment, 0, 100)),
    orderingScore: round(orderingScore + researchAdjustment),
    components: components.map((component) => ({
      ...component,
      value: round(component.value),
    })),
  };
}

export function rankPlayers(
  players: Array<{ player: Player; inputs: ValuationInputs }>,
  context: RankingContext,
): Recommendation[] {
  const sharedScores = sharedDraftEngineScores(players, context);
  const urgentPositions = new Set(
    Object.entries(context.rosterNeeds)
      .filter(([, need]) => need >= URGENT_STARTER_NEED)
      .map(([position]) => position as Player["position"]),
  );
  const eligiblePlayers =
    urgentPositions.size > 0
      ? players.filter(({ player }) => urgentPositions.has(player.position))
      : players;
  const scored = eligiblePlayers
    .map(({ player, inputs }) =>
      calculatePlayerScore(
        player,
        {
          ...inputs,
          ...(sharedScores.get(player.id) === undefined
            ? {}
            : { sharedDraftScore: sharedScores.get(player.id) }),
        },
        context,
      ),
    )
    .toSorted((a, b) => b.orderingScore - a.orderingScore);
  const tiers = generateTiers(scored.map((entry) => entry.orderingScore));
  const replacement = calculateReplacementLevels(
    scored.map((entry) => ({
      player: entry.player,
      score: entry.orderingScore,
    })),
    context.format,
  );

  return scored.map((entry, index) => {
    const availability = estimateAvailability({
      playerScore: entry.contextualScore,
      adp: eligiblePlayers.find((item) => item.player.id === entry.player.id)
        ?.inputs.adp,
      currentPick: context.currentPick,
      nextPick: context.nextUserPick,
      positionDemand: context.positionDemand[entry.player.position] ?? 0.5,
      remainingTier: context.remainingInTier[entry.player.position] ?? 1,
    });
    const need = context.rosterNeeds[entry.player.position] ?? 0;
    const vor =
      entry.orderingScore -
      (replacement.get(entry.player.position) ?? entry.orderingScore);
    return {
      player: entry.player,
      rank: index + 1,
      tier: tiers[index] ?? 1,
      localScore: entry.localScore,
      researchAdjustment: entry.researchAdjustment,
      contextualScore: entry.contextualScore,
      confidence: round(0.55 + availability.confidence * 0.35),
      valueOverReplacement: round(vor),
      rosterFit: need > 1 ? "strong" : need < -0.5 ? "weak" : "neutral",
      scarcity: round(scarcityScore(entry.player, context)),
      nextPickAvailability: availability.probability,
      risk: riskLabel(entry.components),
      rationale: buildRationale(
        entry.player,
        entry.components,
        availability.probability,
      ),
      cited: entry.researchAdjustment === 0,
      components: entry.components,
    };
  });
}

function sharedDraftEngineScores(
  players: Array<{ player: Player; inputs: ValuationInputs }>,
  context: RankingContext,
): Map<string, number> {
  const enginePlayers: DraftEnginePlayer[] = players.map(
    ({ player, inputs }, index) => {
      const rank =
        inputs.adp ?? inputs.importedRank ?? player.searchRank ?? index + 1;
      const baseValue = clamp(101 - Math.log2(Math.max(2, rank)) * 8, 1, 100);
      return {
        playerId: player.id,
        name: player.fullName,
        positions: player.fantasyPositions.length
          ? player.fantasyPositions
          : [player.position],
        ...(player.team ? { team: player.team } : {}),
        adp: rank,
        tier:
          inputs.importedTier ??
          Math.floor(index / Math.max(1, context.format.teams)) + 1,
        redraftValue: inputs.redraftValue ?? baseValue,
        dynastyValue: inputs.dynastyValue ?? baseValue,
        contenderValue: inputs.redraftValue ?? baseValue,
        rookie: player.yearsExperience === 0,
        ...(player.age === undefined ? {} : { age: player.age }),
      };
    },
  );
  if (!enginePlayers.length) return new Map();
  const config: DraftEngineConfig = {
    seed: context.currentPick * 1_009 + context.format.teams * 97,
    leagueType:
      context.format.mode === "keeper"
        ? "keeper"
        : context.format.mode.startsWith("dynasty")
          ? "dynasty"
          : "redraft",
    teams: context.format.teams,
    rounds: Math.max(
      1,
      context.format.draftRounds ?? expandedRosterSlots(context.format).length,
    ),
    style: "snake",
    playerPool:
      context.format.mode === "dynasty_rookie"
        ? "rookies_only"
        : "all_available",
    rosterSlots: expandedRosterSlots(context.format),
    userSlot: 1,
    opponentArchetypes: [archetypeForStrategy(context.strategy)],
    superflex: context.format.superflex || context.format.twoQuarterback,
    tePremium: context.format.tightEndPremium,
    idp: context.format.idp,
    bestBall: context.format.bestBall,
    recordHistory: false,
  };
  const ranked = rankDraftCandidates({
    config,
    candidates: enginePlayers,
    rosterPlayerIds: [],
    allPlayers: enginePlayers,
    pickNumber: context.currentPick,
    archetype: archetypeForStrategy(context.strategy),
    seed: config.seed,
  });
  return new Map(ranked.map((entry) => [entry.playerId, entry.score]));
}

function expandedRosterSlots(format: LeagueFormat): string[] {
  const slots = Object.entries(format.starters).flatMap(([slot, count]) =>
    Array.from({ length: Math.max(0, Math.floor(count)) }, () => slot),
  );
  slots.push(...Array.from({ length: Math.max(0, format.bench) }, () => "BN"));
  return slots.length ? slots : ["BN"];
}

function archetypeForStrategy(strategy: Strategy): OpponentArchetype {
  if (strategy === "contender") return "dynasty_contender";
  if (strategy === "rebuild") return "dynasty_youth";
  if (strategy === "productive_struggle") return "productive_struggle";
  return "best_player_available";
}

export function deriveRosterNeeds(
  format: LeagueFormat,
  picks: DraftPick[],
  currentPick: number,
): Partial<Record<Player["position"], number>> {
  const currentSlot = slotForPick(currentPick, format.teams);
  const rosterCounts = picks
    .filter((pick) => pick.pickInRound === currentSlot)
    .reduce<Partial<Record<Player["position"], number>>>((counts, pick) => {
      counts[pick.position] = (counts[pick.position] ?? 0) + 1;
      return counts;
    }, {});
  const needs: Partial<Record<Player["position"], number>> = {};

  for (const position of DIRECT_ROSTER_POSITIONS) {
    const starterCount = format.starters[position] ?? 0;
    const rosterCount = rosterCounts[position] ?? 0;
    const missing = Math.max(0, starterCount - rosterCount);
    if (missing > 0) needs[position] = missing;
    else if (
      starterCount > 0 &&
      rosterCount >= starterCount &&
      ["QB", "TE", "K", "DEF"].includes(position)
    ) {
      needs[position] = -1;
    }
  }

  addFlexibleNeed(
    needs,
    rosterCounts,
    format,
    ["RB", "WR", "TE"],
    (format.starters["FLEX"] ?? 0) + (format.starters["REC_FLEX"] ?? 0),
    0.5,
  );
  addFlexibleNeed(
    needs,
    rosterCounts,
    format,
    ["QB", "RB", "WR", "TE"],
    format.starters["SUPER_FLEX"] ?? 0,
    0.5,
  );
  addFlexibleNeed(
    needs,
    rosterCounts,
    format,
    ["DL", "LB", "DB"],
    (format.starters["IDP_FLEX"] ?? 0) + (format.starters["IDP"] ?? 0),
    0.5,
  );

  applyBenchBalanceNeeds(needs, rosterCounts, format);
  applyStarterCompletionNeeds(needs, rosterCounts, format);

  return needs;
}

export function generateTiers(scores: number[], minimumGap = 2.25): number[] {
  let tier = 1;
  return scores.map((score, index) => {
    if (index > 0 && (scores[index - 1] ?? score) - score >= minimumGap)
      tier += 1;
    return tier;
  });
}

export function calculateReplacementLevels(
  players: Array<{ player: Player; score: number }>,
  format: LeagueFormat,
): Map<Player["position"], number> {
  const positions = new Map<Player["position"], number[]>();
  for (const { player, score } of players) {
    const list = positions.get(player.position) ?? [];
    list.push(score);
    positions.set(player.position, list);
  }
  const levels = new Map<Player["position"], number>();
  for (const [position, scores] of positions) {
    const directStarters = format.starters[position] ?? 0;
    const flexDemand = ["RB", "WR", "TE"].includes(position)
      ? (format.starters["FLEX"] ?? 0) + (format.starters["REC_FLEX"] ?? 0)
      : 0;
    const superflexDemand =
      position === "QB" && format.superflex
        ? (format.starters["SUPER_FLEX"] ?? 1)
        : 0;
    const benchDemand = Math.ceil((format.bench * format.teams) / 5);
    const demand = Math.max(
      1,
      directStarters * format.teams +
        flexDemand * format.teams +
        superflexDemand * format.teams +
        benchDemand,
    );
    const ordered = scores.toSorted((a, b) => b - a);
    levels.set(
      position,
      ordered[Math.min(demand - 1, ordered.length - 1)] ?? 0,
    );
  }
  return levels;
}

type AvailabilityInput = {
  playerScore: number;
  adp?: number;
  currentPick: number;
  nextPick: number;
  positionDemand: number;
  remainingTier: number;
};

export function estimateAvailability(input: AvailabilityInput): {
  probability: number;
  confidenceInterval: [number, number];
  confidence: number;
  factors: string[];
  warning?: string;
} {
  const picksAway = Math.max(1, input.nextPick - input.currentPick);
  const adpGap = input.adp === undefined ? 0 : input.adp - input.nextPick;
  const scorePressure = (input.playerScore - 75) / 8;
  const demandPressure = clamp(input.positionDemand, 0, 1.5) * 1.4;
  const tierPressure =
    input.remainingTier <= 2 ? 1.2 : input.remainingTier <= 5 ? 0.5 : 0;
  const survival =
    1 /
    (1 +
      Math.exp(
        scorePressure +
          demandPressure +
          tierPressure -
          picksAway / 7 -
          adpGap / 12,
      ));
  const probability = Math.round(clamp(survival * 100, 2, 98));
  const confidence = input.adp === undefined ? 0.46 : 0.74;
  const margin = input.adp === undefined ? 24 : 13;
  return {
    probability,
    confidenceInterval: [
      Math.max(0, probability - margin),
      Math.min(100, probability + margin),
    ],
    confidence,
    factors: [
      `${picksAway} selections before the next owned pick`,
      `${input.remainingTier} players remain in the tier`,
      input.adp === undefined ? "No imported ADP" : `Imported ADP ${input.adp}`,
    ],
    ...(input.adp === undefined
      ? { warning: "Availability is lower confidence without imported ADP." }
      : {}),
  };
}

export function detectPositionRun(
  positions: Player["position"][],
  windowSize = 6,
): {
  position: Player["position"] | null;
  picksInWindow: number;
  strength: "none" | "emerging" | "strong";
} {
  const window = positions.slice(-Math.max(2, windowSize));
  const counts = new Map<Player["position"], number>();
  for (const position of window) {
    counts.set(position, (counts.get(position) ?? 0) + 1);
  }
  const leader = [...counts.entries()].toSorted((a, b) => b[1] - a[1])[0];
  if (!leader || leader[1] < 3) {
    return {
      position: leader?.[0] ?? null,
      picksInWindow: leader?.[1] ?? 0,
      strength: "none",
    };
  }
  return {
    position: leader[0],
    picksInWindow: leader[1],
    strength:
      leader[1] >= Math.ceil(window.length * 0.6) ? "strong" : "emerging",
  };
}

function baselineScore(
  player: Player,
  inputs: ValuationInputs,
  context: RankingContext,
): number {
  const values: Array<{ value: number | undefined; weight: number }> = [
    {
      value:
        inputs.importedRank === undefined
          ? undefined
          : 100 - Math.min(inputs.importedRank, 300) / 3,
      weight: 0.28,
    },
    {
      value:
        inputs.adp === undefined
          ? undefined
          : 100 - Math.min(inputs.adp, 300) / 3,
      weight: 0.17,
    },
    {
      value:
        inputs.projectedPoints === undefined
          ? undefined
          : clamp(inputs.projectedPoints / 4, 0, 100),
      weight: 0.22,
    },
    {
      value:
        context.format.mode === "redraft"
          ? inputs.redraftValue
          : context.format.mode === "dynasty_rookie"
            ? inputs.rookieValue
            : inputs.dynastyValue,
      weight: 0.28,
    },
    { value: inputs.recentProduction, weight: 0.08 },
    { value: inputs.historicalProduction, weight: 0.06 },
  ];
  let total = 0;
  let weight = 0;
  for (const item of values) {
    if (item.value === undefined) continue;
    total += clamp(item.value, 0, 100) * item.weight;
    weight += item.weight;
  }
  if (weight === 0) {
    const searchRank = player.searchRank ?? 180;
    return clamp(88 - searchRank / 4, 30, 88);
  }
  return total / weight;
}

function ageCurveScore(
  player: Player,
  strategy: Strategy,
  mode: LeagueFormat["mode"],
): number {
  if (player.age === undefined || ["redraft", "best_ball"].includes(mode))
    return 0;
  const peak: Partial<Record<Player["position"], number>> = {
    QB: 28,
    RB: 24,
    WR: 26,
    TE: 27,
  };
  const target = peak[player.position] ?? 26;
  const difference = player.age - target;
  const strategyMultiplier =
    strategy === "rebuild"
      ? 1.4
      : strategy === "productive_struggle"
        ? 1.2
        : strategy === "contender"
          ? 0.65
          : 1;
  return clamp(-difference * 0.9 * strategyMultiplier, -10, 7);
}

function ageReason(player: Player, value: number): string {
  if (player.age === undefined) return "Verified age is unavailable.";
  if (value > 1)
    return `${player.age.toFixed(1)} years old with age-curve upside.`;
  if (value < -1)
    return `${player.age.toFixed(1)} years old with age-curve decline risk.`;
  return `${player.age.toFixed(1)} years old and near the positional peak.`;
}

function scarcityScore(player: Player, context: RankingContext): number {
  const remaining = context.remainingInTier[player.position] ?? 8;
  const demand = context.positionDemand[player.position] ?? 0.5;
  const superflex =
    player.position === "QB" &&
    (context.format.superflex || context.format.twoQuarterback)
      ? 3.5
      : 0;
  const tightEndPremium =
    player.position === "TE" && context.format.tightEndPremium ? 2.5 : 0;
  return clamp(
    (6 - remaining) * 0.85 + demand * 3 + superflex + tightEndPremium,
    -3,
    10,
  );
}

function draftCapitalScore(player: Player): number {
  if (player.nflDraftPick === undefined) return 0;
  if (player.nflDraftPick <= 10) return 5;
  if (player.nflDraftPick <= 32) return 3.5;
  if (player.nflDraftPick <= 64) return 2;
  if (player.nflDraftPick <= 100) return 0.8;
  return -0.5;
}

function draftTimingScore(
  adp: number | undefined,
  currentPick: number,
): number {
  if (adp === undefined) return 0;
  const marketGap = currentPick - adp;
  if (marketGap >= 0) return clamp(marketGap * 0.12, 0, 2);
  return -clamp(Math.abs(marketGap) * 0.45, 0, 6);
}

function formatAdjustmentScore(
  player: Player,
  context: RankingContext,
): number {
  const round = Math.max(
    1,
    Math.ceil(context.currentPick / Math.max(1, context.format.teams)),
  );
  if (player.position === "QB") {
    if (context.format.superflex || context.format.twoQuarterback) return 6;
    if ((context.rosterNeeds.QB ?? 0) < 0) return -14;
    if (round <= 2) return -16;
    if (round <= 4) return -9;
    return 0;
  }
  if (player.position === "RB" && context.format.scoring === "standard")
    return 2;
  if (player.position === "WR") {
    if (context.format.scoring === "ppr") return 2;
    if (context.format.scoring === "half_ppr") return 1;
  }
  if (player.position === "TE") {
    if (context.format.tightEndPremium) return 2.5;
    if ((context.rosterNeeds.TE ?? 0) < 0) return -8;
    if (round === 1) return -20;
    if (round === 2) return -12;
    if (round <= 4) return -5;
  }
  if (player.position === "K" || player.position === "DEF") {
    return round <= 12 ? -18 : -4;
  }
  return 0;
}

function formatAdjustmentReason(
  player: Player,
  context: RankingContext,
): string {
  if (player.position === "QB") {
    return context.format.superflex || context.format.twoQuarterback
      ? "Quarterbacks receive a premium in superflex and two-QB formats."
      : "One-QB leagues discount early quarterback value because replacement options remain available.";
  }
  if (player.position === "RB" && context.format.scoring === "standard") {
    return "Standard scoring modestly favors rushing and touchdown volume.";
  }
  if (player.position === "WR" && context.format.scoring !== "standard") {
    return "Reception scoring increases wide-receiver value.";
  }
  if (player.position === "TE") {
    return context.format.tightEndPremium
      ? "Tight-end premium scoring increases tight-end value."
      : "Non-premium leagues discount early tight ends because replacement options remain available.";
  }
  if (player.position === "K" || player.position === "DEF") {
    return "Kickers and defenses are deferred while scarce skill-position value remains.";
  }
  return "No additional league-format adjustment applies.";
}

function statusRisk(player: Player): number {
  if (player.status === "injured") return 8;
  if (player.status === "inactive") return 6;
  if (player.injuryStatus) return 3;
  return 0.5;
}

function addFlexibleNeed(
  needs: Partial<Record<Player["position"], number>>,
  rosterCounts: Partial<Record<Player["position"], number>>,
  format: LeagueFormat,
  positions: Player["position"][],
  flexSlots: number,
  boost: number,
): void {
  if (flexSlots <= 0) return;
  const surplus = positions.reduce(
    (total, position) =>
      total +
      Math.max(
        0,
        (rosterCounts[position] ?? 0) - (format.starters[position] ?? 0),
      ),
    0,
  );
  const unfilled = Math.max(0, flexSlots - surplus);
  if (unfilled <= 0) return;
  for (const position of positions) {
    needs[position] = (needs[position] ?? 0) + unfilled * boost;
  }
}

function applyBenchBalanceNeeds(
  needs: Partial<Record<Player["position"], number>>,
  rosterCounts: Partial<Record<Player["position"], number>>,
  format: LeagueFormat,
): void {
  if ((format.starters.RB ?? 0) <= 0 || (format.starters.WR ?? 0) <= 0) {
    return;
  }

  const runningBacks = rosterCounts.RB ?? 0;
  const wideReceivers = rosterCounts.WR ?? 0;
  const difference = runningBacks - wideReceivers;
  if (difference >= 3) {
    needs.RB = Math.min(needs.RB ?? 0, -1);
    needs.WR = Math.max(needs.WR ?? 0, 1);
  } else if (difference <= -3) {
    needs.WR = Math.min(needs.WR ?? 0, -1);
    needs.RB = Math.max(needs.RB ?? 0, 1);
  }
}

function applyStarterCompletionNeeds(
  needs: Partial<Record<Player["position"], number>>,
  rosterCounts: Partial<Record<Player["position"], number>>,
  format: LeagueFormat,
): void {
  const inferredRosterSize =
    Object.values(format.starters).reduce(
      (total, count) => total + Math.max(0, count),
      0,
    ) + Math.max(0, format.bench);
  const rosterSize = format.draftRounds ?? inferredRosterSize;
  const drafted = Object.values(rosterCounts).reduce(
    (total, count) => total + Math.max(0, count),
    0,
  );
  const remainingPicks = Math.max(0, rosterSize - drafted);
  const missingDirectStarters = DIRECT_ROSTER_POSITIONS.reduce(
    (total, position) =>
      total +
      Math.max(
        0,
        (format.starters[position] ?? 0) - (rosterCounts[position] ?? 0),
      ),
    0,
  );

  if (missingDirectStarters <= 0 || remainingPicks > missingDirectStarters) {
    return;
  }

  for (const position of DIRECT_ROSTER_POSITIONS) {
    if ((format.starters[position] ?? 0) > (rosterCounts[position] ?? 0)) {
      needs[position] = Math.max(needs[position] ?? 0, URGENT_STARTER_NEED);
    }
  }
}

function slotForPick(pickNumber: number, teams: number): number {
  const round = Math.max(1, Math.ceil(pickNumber / teams));
  const inRound = ((Math.max(1, pickNumber) - 1) % teams) + 1;
  return round % 2 === 0 ? teams - inRound + 1 : inRound;
}

function riskLabel(components: ScoreComponent[]): Recommendation["risk"] {
  const penalty =
    components.find((component) => component.key === "risk")?.value ?? 0;
  if (penalty <= -4.5) return "high";
  if (penalty <= -1.5) return "moderate";
  return "low";
}

function buildRationale(
  player: Player,
  components: ScoreComponent[],
  availability: number,
): string {
  const best = components
    .filter((component) => component.key !== "baseline")
    .toSorted((a, b) => b.value - a.value)[0];
  if (availability < 30) {
    return `${player.fullName} is unlikely to reach the next pick, with ${best?.label.toLowerCase() ?? "strong local value"} supporting the selection.`;
  }
  return `${player.fullName} offers ${best?.label.toLowerCase() ?? "strong local value"} and may remain available at the next pick.`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
