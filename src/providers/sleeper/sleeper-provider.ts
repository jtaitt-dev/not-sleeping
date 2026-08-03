import type { ZodType } from "zod";

import {
  sleeperBracketMatchSchema,
  sleeperDraftPickSchema,
  sleeperDraftSchema,
  sleeperLeagueSchema,
  sleeperLeagueUserSchema,
  sleeperMatchupSchema,
  sleeperNflStateSchema,
  sleeperPlayersSchema,
  sleeperProjectionsSchema,
  sleeperRosterSchema,
  sleeperTradedPickSchema,
  sleeperTrendingSchema,
  sleeperTransactionSchema,
  sleeperUserSchema,
  type SleeperPlayerRecord,
  type SleeperProjection,
} from "@/schemas/sleeper";
import { db } from "@/services/cache/database";
import { AppError } from "@/services/errors/app-error";
import {
  evidenceChanged,
  playerEvidenceFingerprint,
} from "@/services/evidence/evidence-freshness";
import { normalizePlayerName } from "@/services/ranking/identity";
import type { Player, Position } from "@/types/domain";

const API_ROOT = "https://api.sleeper.app/v1";
const PROJECTIONS_API_ROOT = "https://api.sleeper.app";
const PLAYER_CACHE_KEY = "sleeper:nfl-players";
const PLAYER_TTL_MS = 24 * 60 * 60 * 1000;
const PROJECTION_TTL_MS = 15 * 60 * 1000;
const PLAYER_SCHEMA_VERSION = 4;
const ALLOWED_POSITIONS = new Set<Position>([
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DEF",
  "DL",
  "DE",
  "DT",
  "EDGE",
  "LB",
  "ILB",
  "OLB",
  "DB",
  "CB",
  "S",
  "FS",
  "SS",
]);
const POSITION_ALIASES: Partial<Record<string, Position>> = {
  NT: "DL",
};

export const SLEEPER_TTLS = {
  nflState: 15 * 60_000,
  league: 15 * 60_000,
  leagueUsers: 30 * 60_000,
  activeRosters: 30_000,
  inactiveRosters: 5 * 60_000,
  activeDraft: 15_000,
  activePicks: 3_000,
  activeTradedPicks: 30_000,
  trending: 15 * 60_000,
} as const;

export class SleeperProvider {
  private readonly projectionCache = new Map<
    string,
    { expiresAt: number; rows: SleeperProjection[] }
  >();

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  getNflState() {
    return this.request("/state/nfl", sleeperNflStateSchema);
  }

  getUser(identifier: string) {
    return this.request(
      `/user/${encodeURIComponent(identifier)}`,
      sleeperUserSchema,
    );
  }

  getUserLeagues(userId: string, season: string) {
    return this.request(
      `/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`,
      sleeperLeagueSchema.array(),
    );
  }

  getLeague(leagueId: string) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}`,
      sleeperLeagueSchema,
    );
  }

  getLeagueUsers(leagueId: string) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}/users`,
      sleeperLeagueUserSchema.array(),
    );
  }

  getRosters(leagueId: string) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}/rosters`,
      sleeperRosterSchema.array(),
    );
  }

  getLeagueDrafts(leagueId: string) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}/drafts`,
      sleeperDraftSchema.array(),
    );
  }

  getLeagueTradedPicks(leagueId: string) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}/traded_picks`,
      sleeperTradedPickSchema.array(),
    );
  }

  getMatchups(leagueId: string, week: number) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}/matchups/${boundedWeek(week)}`,
      sleeperMatchupSchema.array(),
    );
  }

  getTransactions(leagueId: string, week: number) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}/transactions/${boundedWeek(week)}`,
      sleeperTransactionSchema.array(),
    );
  }

  getWinnersBracket(leagueId: string) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}/winners_bracket`,
      sleeperBracketMatchSchema.array(),
    );
  }

  getLosersBracket(leagueId: string) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}/losers_bracket`,
      sleeperBracketMatchSchema.array(),
    );
  }

  getDraft(draftId: string) {
    return this.request(
      `/draft/${encodeURIComponent(draftId)}`,
      sleeperDraftSchema,
    );
  }

  getDraftPicks(draftId: string) {
    return this.request(
      `/draft/${encodeURIComponent(draftId)}/picks`,
      sleeperDraftPickSchema.array(),
    );
  }

  getDraftTradedPicks(draftId: string) {
    return this.request(
      `/draft/${encodeURIComponent(draftId)}/traded_picks`,
      sleeperTradedPickSchema.array(),
    );
  }

  getTrending(kind: "add" | "drop", lookbackHours = 24, limit = 50) {
    const query = new URLSearchParams({
      lookback_hours: String(Math.min(168, Math.max(1, lookbackHours))),
      limit: String(Math.min(100, Math.max(1, limit))),
    });
    return this.request(
      `/players/nfl/trending/${kind}?${query.toString()}`,
      sleeperTrendingSchema,
    );
  }

  async getNflProjections(
    season: string,
    positions: Position[] = ["QB", "RB", "WR", "TE", "K", "DEF"],
  ): Promise<SleeperProjection[]> {
    const normalizedPositions = [...new Set(positions)].toSorted();
    const cacheKey = `${season}:${normalizedPositions.join(",")}`;
    const cached = this.projectionCache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) return cached.rows;

    const query = new URLSearchParams({
      season_type: "regular",
      order_by: "adp_std",
    });
    for (const position of normalizedPositions) {
      query.append("position[]", position);
    }
    const rows = await this.requestUrl(
      `${PROJECTIONS_API_ROOT}/projections/nfl/${encodeURIComponent(season)}?${query.toString()}`,
      sleeperProjectionsSchema,
    );
    this.projectionCache.set(cacheKey, {
      expiresAt: this.now() + PROJECTION_TTL_MS,
      rows,
    });
    return rows;
  }

  async refreshPlayers(force = false): Promise<{
    players: number;
    stale: boolean;
    fetchedAt: number;
  }> {
    const metadata = await db.cacheMetadata.get(PLAYER_CACHE_KEY);
    if (
      !force &&
      metadata?.schemaVersion === PLAYER_SCHEMA_VERSION &&
      metadata.expiresAt > this.now() &&
      (await db.players.count()) > 0
    ) {
      return {
        players: await db.players.count(),
        stale: false,
        fetchedAt: metadata.fetchedAt,
      };
    }

    try {
      const raw = await this.request("/players/nfl", sleeperPlayersSchema);
      const players = Object.entries(raw).flatMap(([id, record]) => {
        const normalized = normalizeSleeperPlayer(id, record);
        return normalized ? [normalized] : [];
      });
      const priorPlayers = await db.players.bulkGet(
        players.map((player) => player.id),
      );
      const changedPlayerIds = players.flatMap((player, index) => {
        const prior = priorPlayers[index];
        return prior &&
          evidenceChanged(
            playerEvidenceFingerprint(prior),
            playerEvidenceFingerprint(player),
          )
          ? [player.id]
          : [];
      });
      await db.transaction(
        "rw",
        db.players,
        db.cacheMetadata,
        db.research,
        db.evidence,
        async () => {
          if (changedPlayerIds.length > 0) {
            await Promise.all([
              db.research.where("playerId").anyOf(changedPlayerIds).delete(),
              db.evidence.where("playerIds").anyOf(changedPlayerIds).delete(),
            ]);
          }
          await db.players.clear();
          await db.players.bulkPut(players);
          await db.cacheMetadata.put({
            key: PLAYER_CACHE_KEY,
            fetchedAt: this.now(),
            expiresAt: this.now() + PLAYER_TTL_MS,
            schemaVersion: PLAYER_SCHEMA_VERSION,
            sourceVersion: "sleeper-v3-news-metadata",
            sizeBytes: JSON.stringify(raw).length,
          });
        },
      );
      return { players: players.length, stale: false, fetchedAt: this.now() };
    } catch (error) {
      const count = await db.players.count();
      if (count > 0 && metadata) {
        await db.cacheMetadata.put({
          ...metadata,
          lastError: "Player refresh failed; stale data preserved.",
        });
        return { players: count, stale: true, fetchedAt: metadata.fetchedAt };
      }
      throw error;
    }
  }

  async searchPlayers(
    query: string,
    positions: Position[] = [],
    limit = 30,
  ): Promise<Player[]> {
    const normalized = normalizePlayerName(query);
    const boundedLimit = Math.min(1_000, Math.max(1, limit));
    const positionSet = new Set(positions);
    if (positionSet.size > 0) {
      const results = await db.players
        .where("position")
        .anyOf([...positionSet])
        .toArray();
      return results
        .filter(
          (player) =>
            normalized.length === 0 ||
            player.normalizedName.startsWith(normalized),
        )
        .toSorted(
          (a, b) =>
            (a.searchRank ?? Number.MAX_SAFE_INTEGER) -
              (b.searchRank ?? Number.MAX_SAFE_INTEGER) ||
            a.fullName.localeCompare(b.fullName),
        )
        .slice(0, boundedLimit);
    }
    const readLimit =
      normalized.length === 0
        ? boundedLimit
        : Math.min(1_000, boundedLimit * 4);
    const collection =
      normalized.length === 0
        ? db.players.orderBy("searchRank")
        : db.players.where("normalizedName").startsWithIgnoreCase(normalized);
    const results = await collection.limit(readLimit).toArray();
    return results.slice(0, boundedLimit);
  }

  private async request<T>(path: string, schema: ZodType<T>): Promise<T> {
    return this.requestUrl(`${API_ROOT}${path}`, schema);
  }

  private async requestUrl<T>(url: string, schema: ZodType<T>): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher.call(globalThis, url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } catch (error) {
      throw new AppError({
        code: navigator.onLine ? "SLEEPER_UNAVAILABLE" : "OFFLINE",
        message: navigator.onLine
          ? "Sleeper is temporarily unavailable."
          : "You are offline.",
        safeDetail: "A read-only Sleeper request could not connect.",
        suggestedAction: "Keep using cached data and retry later.",
        retryable: true,
        cause: error,
      });
    }
    if (response.status === 429) {
      throw new AppError({
        code: "SLEEPER_RATE_LIMIT",
        message: "Sleeper is receiving too many requests.",
        safeDetail: "The provider returned HTTP 429.",
        suggestedAction: "Wait before refreshing again.",
        retryable: true,
      });
    }
    if (response.status === 404) {
      throw new AppError({
        code: "SLEEPER_UNAVAILABLE",
        message: "The Sleeper resource was not found.",
        safeDetail: "The provider returned HTTP 404.",
        suggestedAction: "Check the username, league, or draft selection.",
        retryable: false,
      });
    }
    if (!response.ok) {
      throw new AppError({
        code: "SLEEPER_UNAVAILABLE",
        message: "Sleeper is temporarily unavailable.",
        safeDetail: `The provider returned HTTP ${response.status}.`,
        suggestedAction: "Keep using cached data and retry later.",
        retryable: response.status >= 500,
      });
    }
    const json: unknown = await response.json();
    return schema.parse(json);
  }
}

export function normalizeSleeperPlayer(
  id: string,
  record: SleeperPlayerRecord,
): Player | null {
  const fullName =
    record.full_name ??
    [record.first_name, record.last_name].filter(Boolean).join(" ");
  const position = normalizeSupportedPosition(
    record.position,
    record.fantasy_positions,
  );
  if (!fullName || !position) return null;
  const status =
    record.injury_status || record.status === "Injured Reserve"
      ? "injured"
      : record.status === "Active"
        ? "active"
        : record.status
          ? "inactive"
          : "unknown";
  return {
    id,
    sleeperId: record.player_id ?? id,
    firstName: record.first_name ?? "",
    lastName: record.last_name ?? "",
    fullName,
    normalizedName: normalizePlayerName(fullName),
    position,
    ...(record.team ? { team: record.team } : {}),
    ...(record.age !== null && record.age !== undefined
      ? { age: record.age }
      : {}),
    ...(record.years_exp !== null && record.years_exp !== undefined
      ? { yearsExperience: record.years_exp }
      : {}),
    status,
    ...(record.injury_status ? { injuryStatus: record.injury_status } : {}),
    ...(normalizeTimestamp(record.news_updated) !== undefined
      ? { newsUpdatedAt: normalizeTimestamp(record.news_updated) }
      : {}),
    ...(record.college ? { college: record.college } : {}),
    ...(record.search_rank !== null && record.search_rank !== undefined
      ? { searchRank: record.search_rank }
      : {}),
    fantasyPositions: [
      ...new Set(
        (record.fantasy_positions ?? [])
          .map((value) => normalizePosition(value))
          .filter((value): value is Position => value !== undefined),
      ),
    ],
  };
}

function normalizeTimestamp(
  value: number | string | null | undefined,
): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1_000 : value;
  }
  if (typeof value !== "string" || value.length === 0) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeSupportedPosition(
  primary: string | null | undefined,
  fantasyPositions: string[] | null | undefined,
): Position | undefined {
  const primaryPosition = normalizePosition(primary);
  if (primaryPosition) return primaryPosition;
  return (fantasyPositions ?? [])
    .map((value) => normalizePosition(value))
    .find((value): value is Position => value !== undefined);
}

function normalizePosition(
  value: string | null | undefined,
): Position | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  if (ALLOWED_POSITIONS.has(normalized as Position)) {
    return normalized as Position;
  }
  return POSITION_ALIASES[normalized];
}

function boundedWeek(week: number): number {
  if (!Number.isInteger(week) || week < 0 || week > 30) {
    throw new Error("Sleeper week must be an integer from 0 through 30.");
  }
  return week;
}
