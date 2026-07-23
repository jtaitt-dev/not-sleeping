import Dexie, { type EntityTable } from "dexie";

import type { Player, PlayerResearch, UsageEvent } from "@/types/domain";

export type CacheMetadata = {
  key: string;
  fetchedAt: number;
  expiresAt: number;
  schemaVersion: number;
  sourceVersion?: string;
  sizeBytes?: number;
  lastError?: string;
};

export type StoredWatchlist = {
  id: string;
  playerId: string;
  leagueId?: string;
  notes: string;
  tags: string[];
  targetRound?: number;
  targetRookiePick?: string;
  customRank?: number;
  createdAt: number;
  updatedAt: number;
};

export type StoredResearch = PlayerResearch & {
  cacheKey: string;
  model: string;
  depth: "quick" | "standard" | "deep";
};

export type ImportSource = {
  id: string;
  name: string;
  type: "rankings" | "projections" | "adp" | "values" | "metadata";
  version: string;
  importedAt: number;
  rowCount: number;
  matchedCount: number;
  ambiguousCount: number;
  data: unknown[];
};

export type DiagnosticEvent = {
  id: string;
  timestamp: number;
  level: "warning" | "error";
  code: string;
  safeDetail: string;
};

export class NotSleepingDatabase extends Dexie {
  players!: EntityTable<Player, "id">;
  cacheMetadata!: EntityTable<CacheMetadata, "key">;
  research!: EntityTable<StoredResearch, "cacheKey">;
  watchlist!: EntityTable<StoredWatchlist, "id">;
  usage!: EntityTable<UsageEvent, "id">;
  imports!: EntityTable<ImportSource, "id">;
  diagnostics!: EntityTable<DiagnosticEvent, "id">;

  constructor() {
    super("not-sleeping");
    this.version(1).stores({
      players:
        "id, sleeperId, normalizedName, fullName, team, position, college, [position+team]",
      cacheMetadata: "key, fetchedAt, expiresAt",
      research: "cacheKey, playerId, expiresAt, researchedAt, model, depth",
      watchlist: "id, playerId, leagueId, updatedAt, *tags",
      usage: "id, timestamp, feature, model, status",
      imports: "id, name, type, importedAt",
      diagnostics: "id, timestamp, level, code",
    });
  }
}

export const db = new NotSleepingDatabase();
