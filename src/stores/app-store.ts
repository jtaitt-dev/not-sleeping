import { create } from "zustand";

import { DEMO_FIXTURES } from "@/services/demo/fixtures";
import {
  requestRuntime,
  safeRuntimeError,
  type SafeRuntimeError,
} from "@/services/messaging/runtime-client";
import { deriveRosterNeeds, rankPlayers } from "@/services/ranking/valuation";
import type {
  DraftPick,
  KeyStatus,
  LiveDraftState,
  Player,
  AiProviderId,
  Recommendation,
  Strategy,
} from "@/types/domain";
import {
  isIdpPosition,
  isPlayerEligibleForAnyRosterSlot,
} from "@/services/roster/position-eligibility";
import { resolveRookieEligibility } from "@/services/ranking/rookie-eligibility";

type SimulationAction = {
  type: "draft" | "wait" | "remove";
  label: string;
  playerId?: string;
};

export type DraftScope =
  | { kind: "tab"; draftId: string }
  | { kind: "league"; leagueId: string; draftId: string | null };

type AppState = {
  demoEnabled: boolean;
  fixtureId: string;
  hydrationStatus: "idle" | "loading" | "ready" | "error";
  liveState: LiveDraftState | null;
  tabLiveState: LiveDraftState | null;
  draftScope: DraftScope | null;
  keyStatus: KeyStatus;
  extensionVersion: string | null;
  runtimeError: SafeRuntimeError | null;
  draftStep: number;
  demoPaused: boolean;
  demoSpeed: number;
  strategy: Strategy;
  riskTolerance: number;
  watchlist: string[];
  hiddenPlayers: string[];
  simulation: SimulationAction[];
  hydrate: (tabId?: number) => Promise<void>;
  beginLeagueDraftSwitch: (leagueId: string) => void;
  selectLeagueDraft: (
    leagueId: string,
    draftId: string | null,
  ) => Promise<void>;
  refreshLiveDraft: () => Promise<void>;
  setLiveState: (liveState: LiveDraftState) => void;
  setRuntimeError: (
    runtimeError: SafeRuntimeError | null,
    draftId?: string,
  ) => void;
  setDemoEnabled: (enabled: boolean) => void;
  setFixture: (fixtureId: string) => void;
  nextDemoPick: () => void;
  resetDemo: () => void;
  setDemoPaused: (paused: boolean) => void;
  setDemoSpeed: (speed: number) => void;
  setStrategy: (strategy: Strategy) => void;
  setRiskTolerance: (riskTolerance: number) => void;
  toggleWatch: (playerId: string) => void;
  toggleHidden: (playerId: string) => void;
  addSimulation: (action: SimulationAction) => void;
  undoSimulation: () => void;
  resetSimulation: () => void;
};

let draftSelectionEpoch = 0;

export const useAppStore = create<AppState>((set, get) => ({
  demoEnabled: true,
  fixtureId: "startup",
  hydrationStatus: "idle",
  liveState: null,
  tabLiveState: null,
  draftScope: null,
  keyStatus: { available: false, mode: null, masked: null },
  extensionVersion: null,
  runtimeError: null,
  draftStep: 0,
  demoPaused: true,
  demoSpeed: 1,
  strategy: "balanced",
  riskTolerance: 0.5,
  watchlist: ["4046", "11565", "11560"],
  hiddenPlayers: [],
  simulation: [],
  hydrate: async (tabId) => {
    const epoch = ++draftSelectionEpoch;
    set({ hydrationStatus: "loading", runtimeError: null });
    try {
      const status = await requestRuntime<RuntimeStatus>({
        type: "GET_STATUS",
        payload: { ...(tabId === undefined ? {} : { tabId }) },
      });
      const providerKeyStatus = preferredProviderKeyStatus(status);
      const route = asRecord(status.context);
      const draftId =
        typeof route["draftId"] === "string" ? route["draftId"] : undefined;
      const supported = route["supported"] === true;
      // A supported Sleeper draft is always authoritative. Demo mode is a
      // fallback for non-draft pages; a previously persisted demo preference
      // must never mask a real league draft or Sleeper mock.
      if (supported && draftId) {
        const draftScope: DraftScope = { kind: "tab", draftId };
        set({ draftScope, liveState: null, demoEnabled: false });
        try {
          const liveState = await requestRuntime<LiveDraftState>({
            type: "GET_LIVE_DRAFT",
            payload: { draftId },
          });
          set({ tabLiveState: liveState });
          if (
            epoch !== draftSelectionEpoch ||
            !draftMatchesScope(liveState, draftScope)
          )
            return;
          set({
            demoEnabled: false,
            liveState,
            hydrationStatus: "ready",
            keyStatus: providerKeyStatus,
            extensionVersion: status.extensionVersion,
          });
        } catch (error) {
          if (epoch !== draftSelectionEpoch) return;
          set({
            demoEnabled: false,
            liveState: null,
            hydrationStatus: "error",
            runtimeError: safeRuntimeError(error),
            keyStatus: providerKeyStatus,
            extensionVersion: status.extensionVersion,
          });
        }
        return;
      }
      if (epoch !== draftSelectionEpoch) return;
      set({
        demoEnabled: true,
        liveState: null,
        tabLiveState: null,
        draftScope: null,
        fixtureId: status.demo?.fixture ?? "startup",
        hydrationStatus: "ready",
        keyStatus: providerKeyStatus,
        extensionVersion: status.extensionVersion,
      });
    } catch (error) {
      if (epoch !== draftSelectionEpoch) return;
      set({
        demoEnabled: true,
        liveState: null,
        hydrationStatus: "error",
        runtimeError: safeRuntimeError(error),
      });
    }
  },
  beginLeagueDraftSwitch: (leagueId) => {
    draftSelectionEpoch += 1;
    set({
      draftScope: { kind: "league", leagueId, draftId: null },
      liveState: null,
      demoEnabled: false,
      hydrationStatus: "loading",
      runtimeError: null,
    });
  },
  selectLeagueDraft: async (leagueId, draftId) => {
    const epoch = ++draftSelectionEpoch;
    let tabLiveState = get().tabLiveState;
    if (!tabLiveState || !draftBelongsToLeague(tabLiveState, leagueId)) {
      tabLiveState = await loadActiveTabDraftForLeague(leagueId);
      if (epoch !== draftSelectionEpoch) return;
    }
    if (tabLiveState && draftBelongsToLeague(tabLiveState, leagueId)) {
      const tabDraftId = tabLiveState.context.draftId;
      if (tabDraftId) {
        set({
          draftScope: { kind: "league", leagueId, draftId: tabDraftId },
          liveState: tabLiveState,
          tabLiveState,
          demoEnabled: false,
          hydrationStatus: "ready",
          runtimeError: null,
        });
        return;
      }
    }
    const draftScope: DraftScope = {
      kind: "league",
      leagueId,
      draftId,
    };
    set({
      draftScope,
      liveState: null,
      demoEnabled: false,
      hydrationStatus: draftId ? "loading" : "ready",
      runtimeError: null,
    });
    if (!draftId) return;
    try {
      const liveState = await requestRuntime<LiveDraftState>({
        type: "GET_LIVE_DRAFT",
        payload: { draftId },
      });
      if (
        epoch !== draftSelectionEpoch ||
        !draftMatchesScope(liveState, draftScope)
      )
        return;
      set({
        liveState,
        demoEnabled: false,
        hydrationStatus: "ready",
        runtimeError: null,
      });
    } catch (error) {
      if (epoch !== draftSelectionEpoch) return;
      set({
        liveState: null,
        demoEnabled: false,
        hydrationStatus: "error",
        runtimeError: safeRuntimeError(error),
      });
    }
  },
  refreshLiveDraft: async () => {
    const before = useAppStore.getState();
    const draftId = before.liveState?.context.draftId;
    if (!draftId) return;
    const epoch = draftSelectionEpoch;
    try {
      const liveState = await requestRuntime<LiveDraftState>({
        type: "GET_LIVE_DRAFT",
        payload: { draftId },
      });
      const current = useAppStore.getState();
      if (
        epoch !== draftSelectionEpoch ||
        current.liveState?.context.draftId !== draftId ||
        !draftMatchesScope(liveState, current.draftScope)
      )
        return;
      set({
        liveState,
        demoEnabled: false,
        hydrationStatus: "ready",
        runtimeError: null,
      });
    } catch (error) {
      const runtimeError = safeRuntimeError(error);
      set((state) => ({
        runtimeError,
        ...(state.liveState
          ? {
              liveState: {
                ...state.liveState,
                context: { ...state.liveState.context, connected: false },
              },
            }
          : {}),
      }));
    }
  },
  setLiveState: (liveState) =>
    set((state) => {
      const draftId = liveState.context.draftId;
      const tabOnly = { tabLiveState: liveState };
      if (!draftId) return tabOnly;
      if (state.draftScope?.kind === "league") {
        if (!draftBelongsToLeague(liveState, state.draftScope.leagueId)) {
          return tabOnly;
        }
        if (state.draftScope.draftId !== draftId) draftSelectionEpoch += 1;
        return {
          ...tabOnly,
          draftScope: {
            kind: "league",
            leagueId: state.draftScope.leagueId,
            draftId,
          },
          liveState,
          demoEnabled: false,
          hydrationStatus: "ready",
          runtimeError: null,
        };
      }
      if (state.draftScope?.draftId !== draftId) draftSelectionEpoch += 1;
      return {
        ...tabOnly,
        draftScope: { kind: "tab", draftId },
        liveState,
        demoEnabled: false,
        hydrationStatus: "ready",
        runtimeError: null,
      };
    }),
  setRuntimeError: (runtimeError, draftId) =>
    set((state) => {
      if (draftId && !scopeAcceptsDraftId(state.draftScope, draftId)) {
        return state;
      }
      return {
        runtimeError,
        ...(runtimeError && state.liveState
          ? {
              liveState: {
                ...state.liveState,
                context: { ...state.liveState.context, connected: false },
              },
            }
          : {}),
      };
    }),
  setDemoEnabled: (demoEnabled) => set({ demoEnabled }),
  setFixture: (fixtureId) => set({ fixtureId, draftStep: 0 }),
  nextDemoPick: () => set((state) => ({ draftStep: state.draftStep + 1 })),
  resetDemo: () => set({ draftStep: 0, demoPaused: true }),
  setDemoPaused: (demoPaused) => set({ demoPaused }),
  setDemoSpeed: (demoSpeed) => set({ demoSpeed }),
  setStrategy: (strategy) => set({ strategy }),
  setRiskTolerance: (riskTolerance) => set({ riskTolerance }),
  toggleWatch: (playerId) =>
    set((state) => ({
      watchlist: state.watchlist.includes(playerId)
        ? state.watchlist.filter((id) => id !== playerId)
        : [...state.watchlist, playerId],
    })),
  toggleHidden: (playerId) =>
    set((state) => ({
      hiddenPlayers: state.hiddenPlayers.includes(playerId)
        ? state.hiddenPlayers.filter((id) => id !== playerId)
        : [...state.hiddenPlayers, playerId],
    })),
  addSimulation: (action) =>
    set((state) => ({ simulation: [...state.simulation, action] })),
  undoSimulation: () =>
    set((state) => ({ simulation: state.simulation.slice(0, -1) })),
  resetSimulation: () => set({ simulation: [] }),
}));

type RuntimeStatus = {
  extensionVersion: string;
  context: unknown;
  keyStatus: KeyStatus;
  providerKeyStatuses?: Record<AiProviderId, KeyStatus>;
  demo?: { enabled?: boolean; fixture?: string };
};

function preferredProviderKeyStatus(status: RuntimeStatus): KeyStatus {
  return status.providerKeyStatuses?.openai.available
    ? status.providerKeyStatuses.openai
    : status.providerKeyStatuses?.anthropic.available
      ? status.providerKeyStatuses.anthropic
      : status.keyStatus;
}

export function getActiveFixture(fixtureId: string) {
  const fixture =
    DEMO_FIXTURES.find((entry) => entry.id === fixtureId) ?? DEMO_FIXTURES[0];
  if (!fixture) throw new Error("At least one demo fixture is required.");
  return fixture;
}

export function getVisiblePicks(
  fixtureId: string,
  draftStep: number,
): DraftPick[] {
  const fixture = getActiveFixture(fixtureId);
  if (draftStep === 0) return fixture.picks;
  const extra = fixture.players
    .filter(
      ({ player }) =>
        !fixture.picks.some((pick) => pick.playerId === player.id),
    )
    .slice(0, draftStep)
    .map(({ player }, index): DraftPick => {
      const pickNumber = fixture.context.currentPick + index;
      return {
        pickNumber,
        round: Math.ceil(pickNumber / fixture.format.teams),
        pickInRound: ((pickNumber - 1) % fixture.format.teams) + 1,
        playerId: player.id,
        playerName: player.fullName,
        position: player.position,
        team: player.team,
        pickedBy: `Demo Team ${index + 1}`,
        isKeeper: false,
        isUserPick: false,
        timestamp: Date.now() + index * 1000,
      };
    });
  return [...fixture.picks, ...extra];
}

export function getRecommendations(
  fixtureId: string,
  draftStep: number,
  strategy: Strategy,
  riskTolerance: number,
  hiddenPlayers: string[],
): Recommendation[] {
  const fixture = getActiveFixture(fixtureId);
  const picks = getVisiblePicks(fixtureId, draftStep);
  const picked = new Set(picks.map((pick) => pick.playerId));
  const candidates = fixture.players.filter(
    ({ player }) =>
      !picked.has(player.id) && !hiddenPlayers.includes(player.id),
  );
  return rankPlayers(candidates, {
    format: fixture.format,
    strategy,
    riskTolerance,
    currentPick: fixture.context.currentPick + draftStep,
    nextUserPick:
      (fixture.context.nextUserPick ?? fixture.context.currentPick + 4) +
      draftStep,
    draftStyle: fixture.context.draftStyle,
    rosterNeeds: { QB: 1, RB: 0.5, WR: 1.5, TE: 2, FLEX: 0.5 },
    positionDemand: { QB: 0.8, RB: 0.7, WR: 1.1, TE: 0.65 },
    remainingInTier: { QB: 3, RB: 4, WR: 2, TE: 2 },
  });
}

export function getLiveRecommendations(
  liveState: LiveDraftState,
  strategy: Strategy,
  riskTolerance: number,
  hiddenPlayers: string[],
): Recommendation[] {
  if (liveState.context.status === "complete") return [];
  const recent = liveState.picks.slice(-8);
  const positionDemand = recent.reduce<
    Partial<Record<Player["position"], number>>
  >((demand, pick) => {
    demand[pick.position] = (demand[pick.position] ?? 0) + 1 / 4;
    return demand;
  }, {});
  const remainingInTier = liveState.players
    .slice(0, 36)
    .reduce<Partial<Record<Player["position"], number>>>(
      (remaining, player) => {
        remaining[player.position] = (remaining[player.position] ?? 0) + 1;
        return remaining;
      },
      {},
    );
  const candidates = liveState.players
    .filter(
      (player) =>
        Boolean(player.team && player.team !== "FA") &&
        (liveState.format.mode !== "dynasty_rookie" ||
          resolveRookieEligibility(
            player,
            liveState.context.season ?? new Date().getFullYear(),
          ).eligible) &&
        isEligibleForFormat(player, liveState.format) &&
        !hiddenPlayers.includes(player.id),
    )
    .map((player) => {
      const liveValue = liveState.playerValues?.[player.id];
      const marketRank = liveValue?.adp ?? player.searchRank;
      return {
        player,
        inputs: {
          ...(marketRank === undefined
            ? {}
            : {
                importedRank: marketRank,
                adp: marketRank,
              }),
          ...(liveValue?.projectedPoints === undefined
            ? {}
            : { projectedPoints: liveValue.projectedPoints }),
        },
      };
    });
  return rankPlayers(candidates, {
    format: liveState.format,
    strategy,
    riskTolerance,
    currentPick: liveState.context.currentPick,
    nextUserPick:
      liveState.context.nextUserPick ??
      liveState.context.currentPick + liveState.format.teams,
    draftStyle: liveState.context.draftStyle,
    rosterNeeds: deriveRosterNeeds(
      liveState.format,
      liveState.picks,
      liveState.context.currentPick,
      liveState.rosterPlayers,
    ),
    positionDemand,
    remainingInTier,
  });
}

function isEligibleForFormat(
  player: Player,
  format: LiveDraftState["format"],
): boolean {
  if (player.position === "FLEX") return false;
  if (isIdpPosition(player.position) && !format.idp) return false;
  if (["K", "DEF"].includes(player.position)) {
    return (format.starters[player.position] ?? 0) > 0;
  }
  const starterSlots = Object.entries(format.starters).flatMap(
    ([slot, count]) => Array.from({ length: Math.max(0, count) }, () => slot),
  );
  return isPlayerEligibleForAnyRosterSlot(
    starterSlots,
    player.fantasyPositions.length
      ? player.fantasyPositions
      : [player.position],
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function draftMatchesScope(
  liveState: LiveDraftState,
  scope: DraftScope | null,
): boolean {
  const draftId = liveState.context.draftId;
  if (!scope) return true;
  if (!draftId || !scopeAcceptsDraftId(scope, draftId)) return false;
  if (scope.kind === "tab") return true;
  return (
    (liveState.context.sourceLeagueId ?? liveState.context.leagueId) ===
    scope.leagueId
  );
}

function draftBelongsToLeague(
  liveState: LiveDraftState,
  leagueId: string,
): boolean {
  return (
    (liveState.context.sourceLeagueId ?? liveState.context.leagueId) ===
    leagueId
  );
}

function scopeAcceptsDraftId(
  scope: DraftScope | null,
  draftId: string,
): boolean {
  if (!scope) return true;
  return scope.draftId === draftId;
}

async function loadActiveTabDraftForLeague(
  leagueId: string,
): Promise<LiveDraftState | null> {
  if (typeof chrome === "undefined") return null;
  const tabsApi = (
    chrome as unknown as { tabs?: Pick<typeof chrome.tabs, "query"> }
  ).tabs;
  if (typeof tabsApi?.query !== "function") return null;
  try {
    const [tab] = await tabsApi.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id === undefined || !tab.url?.startsWith("https://sleeper.com/"))
      return null;
    const status = await requestRuntime<RuntimeStatus>({
      type: "GET_STATUS",
      payload: { tabId: tab.id },
    });
    const route = asRecord(status.context);
    const routeDraftId =
      typeof route["draftId"] === "string" ? route["draftId"] : null;
    if (route["supported"] !== true || !routeDraftId) return null;
    const liveState = await requestRuntime<LiveDraftState>({
      type: "GET_LIVE_DRAFT",
      payload: { draftId: routeDraftId },
    });
    return draftBelongsToLeague(liveState, leagueId) ? liveState : null;
  } catch {
    return null;
  }
}
