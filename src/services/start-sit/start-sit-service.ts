import {
  optimizeLineup,
  type LineupCandidate,
  type LineupStrategy,
} from "@/services/lineup/lineup-optimizer";
import type { DynamicModelResult } from "@/services/models/dynamic-model";
import type {
  Citation,
  DecisionFactor,
  DecisionRisk,
  EvidenceItem,
  LeagueContext,
  PendingNews,
  StartSitRecommendation,
} from "@/types/league";

export type StartSitPlayer = {
  playerId: string;
  name: string;
  positions: string[];
  model: DynamicModelResult;
  currentSlotIndex?: number;
  userLocked?: boolean;
  gameStarted?: boolean;
  inactive?: boolean;
  onIr?: boolean;
  onTaxi?: boolean;
  decisionDeadline?: string | null;
  pendingNews?: PendingNews[];
  evidence?: EvidenceItem[];
};

export type StartSitPlan = {
  mode: "classic" | "best_ball";
  assignments: ReturnType<typeof optimizeLineup>["assignments"];
  recommendations: StartSitRecommendation[];
  emptySlots: number[];
  alternatives: ReturnType<typeof optimizeLineup>["alternatives"];
  summary: string;
  generatedAt: string;
};

export function buildStartSitPlan(input: {
  context: LeagueContext;
  players: StartSitPlayer[];
  strategy?: LineupStrategy;
  excludedPlayerIds?: string[];
  manualSlotMappings?: Record<string, string[]>;
  now?: number;
}): StartSitPlan {
  const now = input.now ?? Date.now();
  const candidates: LineupCandidate[] = input.players.map((player) => ({
    playerId: player.playerId,
    name: player.name,
    eligiblePositions: player.positions,
    expectedPoints: player.model.expectedPoints,
    floor: player.model.floor,
    ceiling: player.model.ceiling,
    availabilityProbability: player.model.availabilityProbability,
    ...((player.gameStarted || player.userLocked) &&
    player.currentSlotIndex !== undefined
      ? { lockedSlotIndex: player.currentSlotIndex }
      : {}),
    gameStarted: player.gameStarted,
    inactive: player.inactive,
    onIr: player.onIr,
    onTaxi: player.onTaxi,
  }));
  const optimized = optimizeLineup({
    rosterPositions: input.context.rosterPositions,
    players: candidates,
    strategy: input.strategy ?? "balanced",
    excludedPlayerIds: input.excludedPlayerIds,
    manualSlotMappings: input.manualSlotMappings,
  });
  if (input.context.lineupType === "best_ball") {
    return {
      mode: "best_ball",
      assignments: optimized.assignments,
      recommendations: [],
      emptySlots: optimized.emptySlots,
      alternatives: optimized.alternatives,
      summary:
        "Sleeper selects the highest-scoring legal lineup after games. Use this optimizer for depth, volatility, correlation, and roster-construction decisions; no manual start/sit action is recommended.",
      generatedAt: new Date(now).toISOString(),
    };
  }

  const playerMap = new Map(
    input.players.map((player) => [player.playerId, player]),
  );
  const selected = new Set(
    optimized.assignments.flatMap((assignment) =>
      assignment.playerId ? [assignment.playerId] : [],
    ),
  );
  const currentStarters = new Set(
    input.players.flatMap((player) =>
      player.currentSlotIndex !== undefined && !player.onIr && !player.onTaxi
        ? [player.playerId]
        : [],
    ),
  );
  const benched = input.players
    .filter((player) => !selected.has(player.playerId))
    .toSorted(
      (left, right) => right.model.expectedPoints - left.model.expectedPoints,
    );
  const recommendations = optimized.assignments.flatMap((assignment) => {
    if (!assignment.playerId) return [];
    const player = playerMap.get(assignment.playerId);
    if (!player) return [];
    const replaced = benched.filter(
      (candidate) =>
        currentStarters.has(candidate.playerId) &&
        candidate.playerId !== player.playerId,
    );
    const bestReplaced = replaced[0];
    const projectedAdvantage = bestReplaced
      ? player.model.expectedPoints - bestReplaced.model.expectedPoints
      : 0;
    const floorAdvantage = bestReplaced
      ? player.model.floor - bestReplaced.model.floor
      : 0;
    const ceilingAdvantage = bestReplaced
      ? player.model.ceiling - bestReplaced.model.ceiling
      : 0;
    const evidence = player.evidence ?? [];
    const pending = player.pendingNews ?? [];
    const status = recommendationStatus(
      projectedAdvantage,
      player.model.confidence,
      pending.length > 0,
    );
    return [
      {
        leagueId: input.context.leagueId,
        week: input.context.week,
        generatedAt: new Date(now).toISOString(),
        expiresAt: expiresAt(player, now),
        slot: assignment.slot,
        startPlayerId: player.playerId,
        sitPlayerIds: replaced.map((candidate) => candidate.playerId),
        projectedAdvantage: round(projectedAdvantage),
        floorAdvantage: round(floorAdvantage),
        ceilingAdvantage: round(ceilingAdvantage),
        confidence: player.model.confidence,
        status,
        decisionDeadline: player.decisionDeadline ?? null,
        keyFactors: topFactors(player),
        risks: modelRisks(player),
        pendingNews: pending,
        citations: toCitations(evidence),
      } satisfies StartSitRecommendation,
    ];
  });
  return {
    mode: "classic",
    assignments: optimized.assignments,
    recommendations,
    emptySlots: optimized.emptySlots,
    alternatives: optimized.alternatives,
    summary:
      optimized.emptySlots.length > 0
        ? `${optimized.emptySlots.length} legal lineup slot${optimized.emptySlots.length === 1 ? " is" : "s are"} empty.`
        : "Best legal lineup solved exactly for the selected risk strategy.",
    generatedAt: new Date(now).toISOString(),
  };
}

export function lateNewsAction(
  player: StartSitPlayer,
  now = Date.now(),
): string {
  const deadline = player.decisionDeadline
    ? Date.parse(player.decisionDeadline)
    : Number.NaN;
  const hasPending = (player.pendingNews?.length ?? 0) > 0;
  if (!hasPending) return "Set now";
  if (!Number.isFinite(deadline)) return "Wait for inactive report";
  const minutes = (deadline - now) / 60_000;
  if (minutes <= 0) return "No legal pivot available";
  if (minutes <= 30) return "Use late-game pivot";
  if (minutes <= 120) return "Use early-game fallback";
  return "Wait for inactive report";
}

function topFactors(player: StartSitPlayer): DecisionFactor[] {
  return player.model.contributions
    .filter(
      (component) =>
        component.appliedAdjustment !== 0 || component.manualOverride,
    )
    .toSorted(
      (left, right) =>
        Math.abs(right.appliedAdjustment) - Math.abs(left.appliedAdjustment),
    )
    .slice(0, 4)
    .map((component) => ({
      id: `${player.playerId}:${component.name}`,
      label: component.name.replaceAll("_", " "),
      contribution: component.appliedAdjustment,
      explanation: component.explanation,
      evidenceIds: component.evidenceIds,
    }));
}

function modelRisks(player: StartSitPlayer): DecisionRisk[] {
  const risks: DecisionRisk[] = [];
  if (player.model.availabilityProbability < 0.9) {
    risks.push({
      id: `${player.playerId}:availability`,
      label: "Availability",
      severity:
        player.model.availabilityProbability < 0.65 ? "high" : "moderate",
      explanation: `${Math.round(player.model.availabilityProbability * 100)}% modeled availability.`,
    });
  }
  if (player.model.bustProbability > 0.35) {
    risks.push({
      id: `${player.playerId}:bust`,
      label: "Bust risk",
      severity: player.model.bustProbability > 0.55 ? "high" : "moderate",
      explanation: `${Math.round(player.model.bustProbability * 100)}% modeled bust probability.`,
    });
  }
  if (player.model.conflicts.length > 0) {
    risks.push({
      id: `${player.playerId}:conflict`,
      label: "Conflicting evidence",
      severity: "moderate",
      explanation: player.model.conflicts.join("; "),
    });
  }
  return risks;
}

function toCitations(evidence: EvidenceItem[]): Citation[] {
  return evidence.map((item) => ({
    evidenceId: item.id,
    title: item.citation,
    url: item.url,
    publisher: item.publisher,
    publishedAt: item.publishedAt,
  }));
}

function expiresAt(player: StartSitPlayer, now: number): string {
  const evidenceExpiry = (player.evidence ?? [])
    .map((evidence) => Date.parse(evidence.expiresAt))
    .filter(Number.isFinite)
    .toSorted((left, right) => left - right)[0];
  return new Date(evidenceExpiry ?? now + 30 * 60_000).toISOString();
}

function recommendationStatus(
  advantage: number,
  confidence: number,
  pendingNews: boolean,
): StartSitRecommendation["status"] {
  if (pendingNews && confidence < 0.72) return "wait_for_news";
  if (Math.abs(advantage) < 1.25) return "coin_flip";
  if (Math.abs(advantage) < 3 || confidence < 0.75) return "lean";
  return "clear";
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
