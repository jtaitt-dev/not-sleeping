import type { ZodType } from "zod";

import {
  sleeperDraftPickSchema,
  sleeperDraftSchema,
  sleeperLeagueSchema,
  sleeperLeagueUserSchema,
  sleeperNflStateSchema,
  sleeperPlayersSchema,
  sleeperRosterSchema,
  sleeperTradedPickSchema,
  sleeperTrendingSchema,
  sleeperUserSchema,
  type SleeperPlayerRecord,
} from "@/schemas/sleeper";
import { db } from "@/services/cache/database";
import { AppError } from "@/services/errors/app-error";
import { normalizePlayerName } from "@/services/ranking/identity";
import type { Player, Position } from "@/types/domain";

const API_ROOT = "https://api.sleeper.app/v1";
const PLAYER_CACHE_KEY = "sleeper:nfl-players";
const PLAYER_TTL_MS = 24 * 60 * 60 * 1000;
const PLAYER_SCHEMA_VERSION = 2;
const ALLOWED_POSITIONS = new Set<Position>([
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DEF",
  "DL",
  "LB",
  "DB",
]);
const POSITION_ALIASES: Partial<Record<string, Position>> = {
  DE: "DL",
  DT: "DL",
  NT: "DL",
  EDGE: "DL",
  ILB: "LB",
  OLB: "LB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
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
      await db.transaction("rw", db.players, db.cacheMetadata, async () => {
        await db.players.clear();
        await db.players.bulkPut(players);
        await db.cacheMetadata.put({
          key: PLAYER_CACHE_KEY,
          fetchedAt: this.now(),
          expiresAt: this.now() + PLAYER_TTL_MS,
          schemaVersion: PLAYER_SCHEMA_VERSION,
          sourceVersion: "sleeper-v2",
          sizeBytes: JSON.stringify(raw).length,
        });
      });
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
    const readLimit =
      normalized.length === 0
        ? boundedLimit
        : Math.min(1_000, boundedLimit * 4);
    const collection =
      normalized.length === 0
        ? db.players.orderBy("searchRank")
        : db.players.where("normalizedName").startsWithIgnoreCase(normalized);
    const results = await collection.limit(readLimit).toArray();
    const positionSet = new Set(positions);
    return results
      .filter(
        (player) => positionSet.size === 0 || positionSet.has(player.position),
      )
      .slice(0, boundedLimit);
  }

  private async request<T>(path: string, schema: ZodType<T>): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher.call(globalThis, `${API_ROOT}${path}`, {
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
