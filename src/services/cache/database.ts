import Dexie, { type EntityTable } from "dexie";

import type { Player, PlayerResearch, UsageEvent } from "@/types/domain";
import type {
  EvidenceItem,
  LeagueContext,
  LeagueWorkspaceState,
  ManualLeagueOverrides,
} from "@/types/league";

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

export type StoredLeague = {
  id: string;
  leagueId: string;
  season: string;
  name: string;
  userId: string;
  rosterId: number | null;
  favorite: boolean;
  lastUsedAt: number;
  updatedAt: number;
  context: LeagueContext;
  overrides: ManualLeagueOverrides;
};

export type StoredLeagueWorkspace = LeagueWorkspaceState & {
  id: string;
};

export type StoredEvidence = EvidenceItem & {
  cacheKey: string;
  leagueId: string;
  week: number;
};

export class NotSleepingDatabase extends Dexie {
  players!: EntityTable<Player, "id">;
  cacheMetadata!: EntityTable<CacheMetadata, "key">;
  research!: EntityTable<StoredResearch, "cacheKey">;
  watchlist!: EntityTable<StoredWatchlist, "id">;
  usage!: EntityTable<UsageEvent, "id">;
  imports!: EntityTable<ImportSource, "id">;
  diagnostics!: EntityTable<DiagnosticEvent, "id">;
  leagues!: EntityTable<StoredLeague, "id">;
  leagueWorkspaces!: EntityTable<StoredLeagueWorkspace, "id">;
  evidence!: EntityTable<StoredEvidence, "cacheKey">;

  constructor(name = "not-sleeping") {
    super(name);
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
    this.version(2).stores({
      players:
        "id, sleeperId, normalizedName, fullName, team, position, college, searchRank, [position+team]",
    });
    this.version(3).stores({
      leagues:
        "leagueId, season, name, userId, favorite, lastUsedAt, updatedAt",
      leagueWorkspaces:
        "id, leagueId, workspace, updatedAt, [leagueId+workspace]",
      evidence:
        "cacheKey, leagueId, week, sourceClass, expiresAt, [leagueId+week], *playerIds, *teamIds",
    });
    // IndexedDB cannot change a primary key in place. Version 3 keyed leagues
    // by leagueId; delete only these rebuildable public-data tables first.
    this.version(4).stores({
      leagues: null,
      leagueWorkspaces: null,
    });
    // Recreate them in a separate upgrade with account-scoped primary keys.
    // Existing version-4 installs that already have this shape simply advance
    // to version 5 without dropping their data.
    this.version(5).stores({
      leagues:
        "id, [userId+leagueId], userId, leagueId, season, name, favorite, lastUsedAt, updatedAt",
      leagueWorkspaces:
        "id, [userId+leagueId+season], userId, leagueId, season, workspace, updatedAt",
    });
  }
}

export const db = new NotSleepingDatabase();
