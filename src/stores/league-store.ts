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
  SleeperTradedPick,
} from "@/schemas/sleeper";
import type { Player } from "@/types/domain";
import type { LeagueCatalogItem } from "@/services/league/league-service";
import { resolveLeagueDraftId } from "@/services/draft/league-draft-selection";
import {
  requestRuntime,
  safeRuntimeError,
  type SafeRuntimeError,
} from "@/services/messaging/runtime-client";
import { getSettings } from "@/services/storage/settings";
import type { LeagueContext, ManualLeagueOverrides } from "@/types/league";
import { useAppStore } from "@/stores/app-store";

export type LeagueSnapshot = {
  userId: string;
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
  tradedPicks: SleeperTradedPick[];
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
  selectLeague: (
    leagueId: string,
    options?: { syncDraft?: boolean },
  ) => Promise<void>;
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
        payload: { userId: settings.sleeperUserId },
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
      if (selected) await get().selectLeague(selected, { syncDraft: false });
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
      // Season and week are omitted on purpose: the worker resolves them from
      // Sleeper's live NFL state. The calendar year is the wrong season during
      // the offseason, and week 1 was simply wrong for most of the year.
      const catalog = await requestRuntime<LeagueCatalogItem[]>({
        type: "SYNC_LEAGUES",
        payload: { userId: settings.sleeperUserId },
      });
      set({ catalog, status: "ready" });
      if (!get().activeContext && catalog[0])
        await get().selectLeague(catalog[0].leagueId, { syncDraft: false });
    } catch (error) {
      set({ status: "error", error: safeRuntimeError(error) });
    }
  },
  selectLeague: async (leagueId, options) => {
    const epoch = ++selectionEpoch;
    const syncDraft = options?.syncDraft ?? true;
    if (syncDraft) useAppStore.getState().beginLeagueDraftSwitch(leagueId);
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
        payload: {
          userId: context.userId,
          leagueId: context.leagueId,
          week: context.week,
        },
      });
      if (
        epoch !== selectionEpoch ||
        snapshot.userId !== context.userId ||
        snapshot.leagueId !== context.leagueId ||
        snapshot.league.league_id !== context.leagueId ||
        snapshot.rosters.some(
          (roster) => roster.league_id !== context.leagueId,
        ) ||
        snapshot.drafts.some((draft) => draft.league_id !== context.leagueId)
      )
        return;
      const catalog = await requestRuntime<CatalogResponse>({
        type: "GET_LEAGUES",
        payload: { userId: settings.sleeperUserId },
      });
      set({
        activeContext: context,
        snapshot,
        catalog: catalog.catalog,
        status: "ready",
        error: null,
      });
      if (syncDraft) {
        void useAppStore.getState().selectLeagueDraft(
          context.leagueId,
          resolveLeagueDraftId({
            league: snapshot.league,
            drafts: snapshot.drafts,
          }),
        );
      }
    } catch (error) {
      if (epoch !== selectionEpoch) return;
      set({ status: "error", error: safeRuntimeError(error) });
    }
  },
  favoriteLeague: async (leagueId, favorite) => {
    const prior = get().catalog;
    const userId = get().activeContext?.userId;
    if (!userId) {
      set({
        error: safeRuntimeError(
          new Error("Select an account league before changing favorites."),
        ),
      });
      return;
    }
    set({
      catalog: prior.map((league) =>
        league.leagueId === leagueId ? { ...league, favorite } : league,
      ),
    });
    try {
      await requestRuntime({
        type: "FAVORITE_LEAGUE",
        payload: {
          userId,
          leagueId,
          favorite,
        },
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
