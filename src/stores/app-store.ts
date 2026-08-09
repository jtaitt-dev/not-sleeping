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

type SimulationAction = {
  type: "draft" | "wait" | "remove";
  label: string;
  playerId?: string;
};

type AppState = {
  demoEnabled: boolean;
  fixtureId: string;
  hydrationStatus: "idle" | "loading" | "ready" | "error";
  liveState: LiveDraftState | null;
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
  refreshLiveDraft: () => Promise<void>;
  setLiveState: (liveState: LiveDraftState) => void;
  setRuntimeError: (runtimeError: SafeRuntimeError | null) => void;
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

export const useAppStore = create<AppState>((set) => ({
  demoEnabled: true,
  fixtureId: "startup",
  hydrationStatus: "idle",
  liveState: null,
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
      const explicitDemo = status.demo?.enabled === true;
      if (supported && draftId && !explicitDemo) {
        try {
          const liveState = await requestRuntime<LiveDraftState>({
            type: "GET_LIVE_DRAFT",
            payload: { draftId },
          });
          set({
            demoEnabled: false,
            liveState,
            hydrationStatus: "ready",
            keyStatus: providerKeyStatus,
            extensionVersion: status.extensionVersion,
          });
        } catch (error) {
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
      set({
        demoEnabled: true,
        liveState: null,
        fixtureId: status.demo?.fixture ?? "startup",
        hydrationStatus: "ready",
        keyStatus: providerKeyStatus,
        extensionVersion: status.extensionVersion,
      });
    } catch (error) {
      set({
        demoEnabled: true,
        liveState: null,
        hydrationStatus: "error",
        runtimeError: safeRuntimeError(error),
      });
    }
  },
  refreshLiveDraft: async () => {
    const draftId = useAppStore.getState().liveState?.context.draftId;
    if (!draftId) return;
    try {
      const liveState = await requestRuntime<LiveDraftState>({
        type: "GET_LIVE_DRAFT",
        payload: { draftId },
      });
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
    set({
      liveState,
      demoEnabled: false,
      hydrationStatus: "ready",
      runtimeError: null,
    }),
  setRuntimeError: (runtimeError) =>
    set((state) => ({
      runtimeError,
      ...(runtimeError && state.liveState
        ? {
            liveState: {
              ...state.liveState,
              context: { ...state.liveState.context, connected: false },
            },
          }
        : {}),
    })),
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
    rosterNeeds: deriveRosterNeeds(
      liveState.format,
      liveState.picks,
      liveState.context.currentPick,
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
