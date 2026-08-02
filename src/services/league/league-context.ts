import { detectSleeperCapabilities } from "@/config/sleeper-capabilities";
import type {
  SleeperDraft,
  SleeperLeague,
  SleeperRoster,
} from "@/schemas/sleeper";
import {
  resolveFreshness,
  type FreshnessPolicy,
} from "@/services/freshness/freshness-policy";
import type {
  FreshnessDomain,
  LeagueContext,
  ManualLeagueOverrides,
  TeamStrategy,
} from "@/types/league";

export function createLeagueContext(input: {
  league: SleeperLeague;
  draft?: SleeperDraft | null;
  rosters?: SleeperRoster[];
  userId: string;
  week: number;
  strategy?: TeamStrategy;
  selectedMatchupId?: number | null;
  fetchedAt?: number;
  overrides?: ManualLeagueOverrides;
  freshnessPolicy?: Partial<Record<FreshnessDomain, FreshnessPolicy>>;
}): LeagueContext {
  const capabilities = detectSleeperCapabilities(
    input.league,
    input.draft,
    input.overrides,
  );
  const roster = input.rosters?.find(
    (candidate) =>
      candidate.owner_id === input.userId ||
      candidate.co_owners?.includes(input.userId),
  );
  const fetchedAt = input.fetchedAt ?? Date.now();
  return {
    leagueId: input.league.league_id,
    leagueName: input.league.name,
    season: input.league.season,
    week: input.week,
    userId: input.userId,
    rosterId: roster?.roster_id ?? null,
    leagueType: capabilities.leagueType,
    lineupType: capabilities.lineupType,
    draftStyle: capabilities.draftStyle,
    waiverType: capabilities.waiverType,
    weeklyElimination: capabilities.weeklyElimination,
    eliminationTiebreaker: capabilities.eliminationTiebreaker,
    rosterPositions: capabilities.rosterPositions,
    scoringSettings: numericRecord(input.league.scoring_settings),
    settings: structuredClone(input.league.settings),
    strategy: input.strategy ?? "balanced",
    selectedMatchupId: input.selectedMatchupId ?? null,
    dataFreshness: {
      league_rosters: resolveFreshness({
        domain: "league_rosters",
        fetchedAt,
        policy: input.freshnessPolicy,
      }),
    },
  };
}

export function leagueScopedKey(
  context: Pick<LeagueContext, "leagueId" | "season" | "week">,
  domain: string,
  suffix = "",
): string {
  assertLeagueContext(context);
  const cleanDomain = domain.replace(/[^a-z0-9:_-]/gi, "_");
  const cleanSuffix = suffix.replace(/[^a-z0-9:_-]/gi, "_");
  return [
    "league",
    context.leagueId,
    context.season,
    context.week,
    cleanDomain,
    cleanSuffix,
  ]
    .filter((value) => String(value).length > 0)
    .join(":");
}

export function assertLeagueContext(
  context: Partial<Pick<LeagueContext, "leagueId" | "season" | "week">>,
): asserts context is Pick<LeagueContext, "leagueId" | "season" | "week"> {
  if (!context.leagueId || !context.season || !Number.isInteger(context.week)) {
    throw new Error("An explicit league ID, season, and week are required.");
  }
}

export function belongsToLeague(
  requestedLeagueId: string,
  payload: { leagueId?: string; league_id?: string },
): boolean {
  return (payload.leagueId ?? payload.league_id) === requestedLeagueId;
}

function numericRecord(value: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const number = typeof entry === "number" ? entry : Number(entry);
      return Number.isFinite(number) ? [[key, number]] : [];
    }),
  );
}
