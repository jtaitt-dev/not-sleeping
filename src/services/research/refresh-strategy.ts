export type ResearchTrigger =
  | "injury_designation_changed"
  | "practice_participation_changed"
  | "inactive_window_approaching"
  | "transaction_or_promotion"
  | "starter_ruled_out"
  | "depth_chart_changed"
  | "weather_threshold_crossed"
  | "close_start_sit_opened"
  | "draft_clock_stale_top_pick"
  | "trade_stale_player"
  | "waiver_breaking_news"
  | "poll_cycle"
  | "deterministic_calculation";

export type ResearchRefreshDecision = {
  refresh: boolean;
  reason: string;
  batchKey: string | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
};

export function decideResearchRefresh(input: {
  trigger: ResearchTrigger;
  automaticResearchEnabled: boolean;
  hasEquivalentFreshResearch: boolean;
  budgetRemaining: boolean;
  cacheKey: string;
  leagueId: string;
  week: number;
  relatedPlayerCount?: number;
}): ResearchRefreshDecision {
  const denied = !input.automaticResearchEnabled
    ? "Automatic research is disabled."
    : !input.budgetRemaining
      ? "The configured research budget is exhausted."
      : input.hasEquivalentFreshResearch
        ? "Equivalent fresh research already exists."
        : ["poll_cycle", "deterministic_calculation"].includes(input.trigger)
          ? "Polling and deterministic calculations never trigger research."
          : null;
  const playerCount = clampInt(input.relatedPlayerCount ?? 1, 1, 12);
  return {
    refresh: denied === null,
    reason: denied ?? triggerReason(input.trigger),
    batchKey:
      denied === null
        ? `${input.leagueId}:${input.week}:${input.cacheKey.replace(/[^a-z0-9:_-]/gi, "_")}`
        : null,
    estimatedInputTokens: denied === null ? 550 + playerCount * 260 : 0,
    estimatedOutputTokens: denied === null ? 300 + playerCount * 180 : 0,
  };
}

export function groupResearchBatches(
  decisions: ResearchRefreshDecision[],
): Array<{ batchKey: string; decisions: ResearchRefreshDecision[] }> {
  const groups = new Map<string, ResearchRefreshDecision[]>();
  for (const decision of decisions) {
    if (!decision.refresh || !decision.batchKey) continue;
    const values = groups.get(decision.batchKey) ?? [];
    values.push(decision);
    groups.set(decision.batchKey, values);
  }
  return [...groups.entries()].map(([batchKey, values]) => ({
    batchKey,
    decisions: values,
  }));
}

function triggerReason(trigger: ResearchTrigger): string {
  const reasons: Record<ResearchTrigger, string> = {
    injury_designation_changed: "A player received a new injury designation.",
    practice_participation_changed: "Practice participation changed.",
    inactive_window_approaching: "The official inactive window is approaching.",
    transaction_or_promotion:
      "A roster transaction or promotion changed the role context.",
    starter_ruled_out: "A starter was ruled out.",
    depth_chart_changed: "The depth chart changed.",
    weather_threshold_crossed: "Weather crossed a modeled impact threshold.",
    close_start_sit_opened: "The user opened a close lineup decision.",
    draft_clock_stale_top_pick:
      "A top on-clock recommendation has stale research.",
    trade_stale_player: "A trade contains a player with stale current context.",
    waiver_breaking_news: "A waiver target has breaking news.",
    poll_cycle: "Polling does not trigger research.",
    deterministic_calculation:
      "Deterministic calculations do not trigger research.",
  };
  return reasons[trigger];
}

function clampInt(value: number, minimum: number, maximum: number): number {
  return Math.round(Math.min(maximum, Math.max(minimum, value)));
}
