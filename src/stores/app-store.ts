import { create } from "zustand";

import { DEMO_FIXTURES } from "@/services/demo/fixtures";
import { rankPlayers } from "@/services/ranking/valuation";
import type { DraftPick, Recommendation, Strategy } from "@/types/domain";

type SimulationAction = {
  type: "draft" | "wait" | "remove";
  label: string;
  playerId?: string;
};

type AppState = {
  demoEnabled: boolean;
  fixtureId: string;
  draftStep: number;
  demoPaused: boolean;
  demoSpeed: number;
  strategy: Strategy;
  riskTolerance: number;
  watchlist: string[];
  hiddenPlayers: string[];
  simulation: SimulationAction[];
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
  draftStep: 0,
  demoPaused: true,
  demoSpeed: 1,
  strategy: "balanced",
  riskTolerance: 0.5,
  watchlist: ["4046", "11565", "11560"],
  hiddenPlayers: [],
  simulation: [],
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
