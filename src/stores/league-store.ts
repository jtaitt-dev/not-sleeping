import { create } from "zustand";

import type {
  SleeperBracketMatch,
  SleeperDraft,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperProjection,
  SleeperRoster,
  SleeperTransaction,
} from "@/schemas/sleeper";
import type { Player } from "@/types/domain";
import type { LeagueCatalogItem } from "@/services/league/league-service";
import {
  requestRuntime,
  safeRuntimeError,
  type SafeRuntimeError,
} from "@/services/messaging/runtime-client";
import { getSettings } from "@/services/storage/settings";
import type { LeagueContext, ManualLeagueOverrides } from "@/types/league";

export type LeagueSnapshot = {
  leagueId: string;
  week: number;
  fetchedAt: number;
  league: SleeperLeague;
  users: SleeperLeagueUser[];
  rosters: SleeperRoster[];
  matchups: SleeperMatchup[];
  transactions: SleeperTransaction[];
  winnersBracket: SleeperBracketMatch[];
  losersBracket: SleeperBracketMatch[];
  tradedPicks: unknown[];
  drafts: SleeperDraft[];
  players: Player[];
  projections: SleeperProjection[];
};

type CatalogResponse = {
  catalog: LeagueCatalogItem[];
  activeLeagueId: string | null;
};

type LeagueState = {
  catalog: LeagueCatalogItem[];
  activeContext: LeagueContext | null;
  snapshot: LeagueSnapshot | null;
  status: "idle" | "loading" | "switching" | "ready" | "error";
  error: SafeRuntimeError | null;
  switcherOpen: boolean;
  query: string;
  hydrate: () => Promise<void>;
  sync: () => Promise<void>;
  selectLeague: (leagueId: string) => Promise<void>;
  favoriteLeague: (leagueId: string, favorite: boolean) => Promise<void>;
  setOverrides: (overrides: ManualLeagueOverrides) => Promise<void>;
  setSwitcherOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
};

let selectionEpoch = 0;

export const useLeagueStore = create<LeagueState>((set, get) => ({
  catalog: [],
  activeContext: null,
  snapshot: null,
  status: "idle",
  error: null,
  switcherOpen: false,
  query: "",
  hydrate: async () => {
    set({ status: "loading", error: null });
    try {
      const settings = await getSettings();
      if (!settings.sleeperUserId) {
        set({ status: "ready" });
        return;
      }
      const response = await requestRuntime<CatalogResponse>({
        type: "GET_LEAGUES",
        payload: {},
      });
      set({ catalog: response.catalog });
      if (response.catalog.length === 0) {
        await get().sync();
        return;
      }
      const selected =
        response.activeLeagueId &&
        response.catalog.some(
          (league) => league.leagueId === response.activeLeagueId,
        )
          ? response.activeLeagueId
          : response.catalog[0]?.leagueId;
      if (selected) await get().selectLeague(selected);
      else set({ status: "ready" });
    } catch (error) {
      set({ status: "error", error: safeRuntimeError(error) });
    }
  },
  sync: async () => {
    set({ status: "loading", error: null });
    try {
      const settings = await getSettings();
      if (!settings.sleeperUserId) {
        set({ status: "ready" });
        return;
      }
      const currentSeason = new Date().getFullYear();
      const catalog = await requestRuntime<LeagueCatalogItem[]>({
        type: "SYNC_LEAGUES",
        payload: {
          userId: settings.sleeperUserId,
          seasons: [currentSeason, currentSeason - 1, currentSeason - 2].map(
            String,
          ),
          week: 1,
        },
      });
      set({ catalog, status: "ready" });
      if (!get().activeContext && catalog[0])
        await get().selectLeague(catalog[0].leagueId);
    } catch (error) {
      set({ status: "error", error: safeRuntimeError(error) });
    }
  },
  selectLeague: async (leagueId) => {
    const epoch = ++selectionEpoch;
    set({ status: "switching", error: null, switcherOpen: false });
    try {
      const settings = await getSettings();
      if (!settings.sleeperUserId)
        throw new Error("Connect a Sleeper account in Settings first.");
      const context = await requestRuntime<LeagueContext>({
        type: "SELECT_LEAGUE",
        payload: { leagueId, userId: settings.sleeperUserId },
      });
      if (epoch !== selectionEpoch) return;
      const snapshot = await requestRuntime<LeagueSnapshot>({
        type: "GET_LEAGUE_SNAPSHOT",
        payload: { leagueId: context.leagueId, week: context.week },
      });
      if (epoch !== selectionEpoch || snapshot.leagueId !== context.leagueId)
        return;
      const catalog = await requestRuntime<CatalogResponse>({
        type: "GET_LEAGUES",
        payload: {},
      });
      set({
        activeContext: context,
        snapshot,
        catalog: catalog.catalog,
        status: "ready",
        error: null,
      });
    } catch (error) {
      if (epoch !== selectionEpoch) return;
      set({ status: "error", error: safeRuntimeError(error) });
    }
  },
  favoriteLeague: async (leagueId, favorite) => {
    const prior = get().catalog;
    set({
      catalog: prior.map((league) =>
        league.leagueId === leagueId ? { ...league, favorite } : league,
      ),
    });
    try {
      await requestRuntime({
        type: "FAVORITE_LEAGUE",
        payload: { leagueId, favorite },
      });
    } catch (error) {
      set({ catalog: prior, error: safeRuntimeError(error) });
    }
  },
  setOverrides: async (overrides) => {
    const context = get().activeContext;
    if (!context) throw new Error("Select a league before saving overrides.");
    set({ status: "switching", error: null });
    try {
      const updated = await requestRuntime<LeagueContext>({
        type: "SET_LEAGUE_OVERRIDES",
        payload: {
          leagueId: context.leagueId,
          userId: context.userId,
          overrides,
        },
      });
      set({ activeContext: updated, status: "ready", error: null });
    } catch (error) {
      const safe = safeRuntimeError(error);
      set({ status: "error", error: safe });
      throw error;
    }
  },
  setSwitcherOpen: (switcherOpen) => set({ switcherOpen }),
  setQuery: (query) => set({ query }),
}));
