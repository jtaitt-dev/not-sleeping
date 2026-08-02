import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@/services/storage/settings";
import { useLeagueStore, type LeagueSnapshot } from "@/stores/league-store";
import type { LeagueContext } from "@/types/league";

type Deferred = {
  resolve: (value: unknown) => void;
  promise: Promise<unknown>;
};

describe("rapid five-league isolation", () => {
  beforeEach(() => {
    useLeagueStore.setState({
      catalog: [],
      activeContext: null,
      snapshot: null,
      status: "idle",
      error: null,
      switcherOpen: false,
      query: "",
    });
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      appSettings: { ...DEFAULT_SETTINGS, sleeperUserId: "user-1" },
    } as never);
  });

  it("never commits stale context or snapshot responses under the newest league", async () => {
    const selects = new Map<string, Deferred>();
    const snapshots = new Map<string, Deferred>();
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (message: unknown) => {
        const request = message as {
          type: string;
          payload: { leagueId?: string };
        };
        const leagueId = request.payload.leagueId ?? "";
        if (request.type === "SELECT_LEAGUE") {
          const deferred = createDeferred();
          selects.set(leagueId, deferred);
          return deferred.promise as never;
        }
        if (request.type === "GET_LEAGUE_SNAPSHOT") {
          const deferred = createDeferred();
          snapshots.set(leagueId, deferred);
          return deferred.promise as never;
        }
        if (request.type === "GET_LEAGUES") {
          return Promise.resolve(
            envelope({ catalog: [], activeLeagueId: "league-5" }),
          ) as never;
        }
        throw new Error(`Unexpected message ${request.type}`);
      },
    );

    const requests = [1, 2, 3, 4, 5].map((index) =>
      useLeagueStore.getState().selectLeague(`league-${index}`),
    );
    await nextTask();
    expect(selects.size).toBe(5);

    selects.get("league-5")?.resolve(envelope(context("league-5")));
    await nextTask();
    snapshots.get("league-5")?.resolve(envelope(snapshot("league-5")));
    for (const index of [4, 3, 2, 1]) {
      selects
        .get(`league-${index}`)
        ?.resolve(envelope(context(`league-${index}`)));
    }
    await Promise.all(requests);

    const state = useLeagueStore.getState();
    expect(state.status).toBe("ready");
    expect(state.activeContext?.leagueId).toBe("league-5");
    expect(state.snapshot?.leagueId).toBe("league-5");
    expect(state.snapshot?.league.league_id).toBe(
      state.activeContext?.leagueId,
    );
    expect(snapshots.size).toBe(1);
  });
});

function createDeferred(): Deferred {
  let resolve: Deferred["resolve"] = () => undefined;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}

function envelope(data: unknown) {
  return { ok: true, requestId: crypto.randomUUID(), data };
}

function context(leagueId: string): LeagueContext {
  return {
    leagueId,
    leagueName: leagueId,
    season: "2026",
    week: 1,
    userId: "user-1",
    rosterId: 1,
    leagueType: "redraft",
    lineupType: "classic",
    draftStyle: "snake",
    waiverType: "rolling",
    weeklyElimination: false,
    eliminationTiebreaker: null,
    rosterPositions: ["QB", "RB", "WR", "TE", "BN"],
    scoringSettings: { rec: 1 },
    settings: {},
    strategy: "balanced",
    selectedMatchupId: null,
    dataFreshness: {},
  };
}

function snapshot(leagueId: string): LeagueSnapshot {
  return {
    leagueId,
    week: 1,
    fetchedAt: Date.now(),
    league: {
      league_id: leagueId,
      name: leagueId,
      season: "2026",
      sport: "nfl",
      settings: {},
      scoring_settings: {},
      roster_positions: [],
    },
    users: [],
    rosters: [],
    matchups: [],
    transactions: [],
    winnersBracket: [],
    losersBracket: [],
    tradedPicks: [],
    drafts: [],
    players: [],
    projections: [],
  };
}

async function nextTask(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
