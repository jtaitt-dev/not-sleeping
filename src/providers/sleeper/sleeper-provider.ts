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
import {
  assertSleeperRequestIsReadOnly,
  sleeperReadOnlyRequest,
} from "@/providers/sleeper/read-only-boundary";

const API_ROOT = "https://api.sleeper.app/v1";
const PROJECTIONS_API_ROOT = "https://api.sleeper.app";
const PLAYER_CACHE_KEY = "sleeper:nfl-players";
const PLAYER_TTL_MS = 24 * 60 * 60 * 1000;
const PROJECTION_TTL_MS = 15 * 60 * 1000;
const PLAYER_SCHEMA_VERSION = 4;
const DEFAULT_RESPONSE_BYTES = 5 * 1024 * 1024;
const LARGE_RESPONSE_BYTES = 40 * 1024 * 1024;
const MAX_PLAYER_RECORDS = 20_000;
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

  async getUserLeagues(userId: string, season: string) {
    const leagues = await this.request(
      `/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`,
      sleeperLeagueSchema.array(),
    );
    assertEvery(
      leagues,
      (league) => league.season === season,
      "Sleeper returned a league from a different season.",
    );
    return leagues;
  }

  async getLeague(leagueId: string) {
    const league = await this.request(
      `/league/${encodeURIComponent(leagueId)}`,
      sleeperLeagueSchema,
    );
    assertIdentity(league.league_id, leagueId, "league");
    return league;
  }

  getLeagueUsers(leagueId: string) {
    return this.request(
      `/league/${encodeURIComponent(leagueId)}/users`,
      sleeperLeagueUserSchema.array(),
    );
  }

  async getRosters(leagueId: string) {
    const rosters = await this.request(
      `/league/${encodeURIComponent(leagueId)}/rosters`,
      sleeperRosterSchema.array(),
    );
    assertEvery(
      rosters,
      (roster) => roster.league_id === leagueId,
      "Sleeper returned a roster from a different league.",
    );
    return rosters;
  }

  async getLeagueDrafts(leagueId: string) {
    const drafts = await this.request(
      `/league/${encodeURIComponent(leagueId)}/drafts`,
      sleeperDraftSchema.array(),
    );
    assertEvery(
      drafts,
      (draft) => draft.league_id === leagueId,
      "Sleeper returned a draft from a different league.",
    );
    return drafts;
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

  async getDraft(draftId: string) {
    const draft = await this.request(
      `/draft/${encodeURIComponent(draftId)}`,
      sleeperDraftSchema,
    );
    assertIdentity(draft.draft_id, draftId, "draft");
    return draft;
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
      if (Object.keys(raw).length > MAX_PLAYER_RECORDS) {
        throw malformedSleeperResponse(
          `The player catalog exceeded ${MAX_PLAYER_RECORDS} records.`,
        );
      }
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
      const init = sleeperReadOnlyRequest(url);
      assertSleeperRequestIsReadOnly(url, init);
      response = await this.fetcher.call(globalThis, url, init);
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
    const json = await readBoundedJson(response, responseLimit(url));
    assertBoundedPayload(json, url.includes("/players/nfl"));
    return schema.parse(json);
  }
}

async function readBoundedJson(
  response: Response,
  maximumBytes: number,
): Promise<unknown> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw malformedSleeperResponse(
      `The response exceeded the ${maximumBytes}-byte limit.`,
    );
  }
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maximumBytes) {
      throw malformedSleeperResponse(
        `The response exceeded the ${maximumBytes}-byte limit.`,
      );
    }
    return parseJson(text);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    let next = await reader.read();
    while (!next.done) {
      const value = next.value;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw malformedSleeperResponse(
          `The response exceeded the ${maximumBytes}-byte limit.`,
        );
      }
      chunks.push(value);
      next = await reader.read();
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return parseJson(new TextDecoder().decode(bytes));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new AppError({
      code: "SLEEPER_UNAVAILABLE",
      message: "Sleeper returned data that could not be safely used.",
      safeDetail: "The response was not valid JSON.",
      suggestedAction: "Keep using cached data and retry later.",
      retryable: true,
      cause: error,
    });
  }
}

function responseLimit(url: string): number {
  return url.includes("/players/nfl") || url.includes("/projections/nfl/")
    ? LARGE_RESPONSE_BYTES
    : DEFAULT_RESPONSE_BYTES;
}

function assertBoundedPayload(value: unknown, large: boolean): void {
  const maximumNodes = large ? 600_000 : 100_000;
  const maximumCollection = large ? 25_000 : 10_000;
  let nodes = 0;
  const visit = (entry: unknown, depth: number): void => {
    nodes += 1;
    if (nodes > maximumNodes || depth > 14) {
      throw malformedSleeperResponse("The response structure was too large.");
    }
    if (typeof entry === "string" && entry.length > 20_000) {
      throw malformedSleeperResponse(
        "The response contained an oversized field.",
      );
    }
    if (Array.isArray(entry)) {
      if (entry.length > maximumCollection) {
        throw malformedSleeperResponse(
          "The response collection was too large.",
        );
      }
      for (const item of entry) visit(item, depth + 1);
      return;
    }
    if (entry && typeof entry === "object") {
      const values = Object.values(entry);
      if (values.length > maximumCollection) {
        throw malformedSleeperResponse("The response record was too large.");
      }
      for (const item of values) visit(item, depth + 1);
    }
  };
  visit(value, 0);
}

function assertIdentity(
  actual: string | null | undefined,
  expected: string,
  kind: string,
): void {
  if (actual !== expected) {
    throw malformedSleeperResponse(
      `Sleeper returned a different ${kind} identity than requested.`,
    );
  }
}

function assertEvery<T>(
  values: T[],
  predicate: (value: T) => boolean,
  detail: string,
): void {
  if (!values.every(predicate)) throw malformedSleeperResponse(detail);
}

function malformedSleeperResponse(detail: string): AppError {
  return new AppError({
    code: "SLEEPER_UNAVAILABLE",
    message: "Sleeper returned data that could not be safely used.",
    safeDetail: detail,
    suggestedAction: "Keep using cached data and retry later.",
    retryable: true,
  });
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
