import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  reconcileHydratedLeagueDraft,
  selectSleeperRouteLeague,
} from "@/components/root-providers";
import { resolveLeagueDraftId } from "@/services/draft/league-draft-selection";
import { useAppStore } from "@/stores/app-store";
import { useLeagueStore } from "@/stores/league-store";
import type { LiveDraftState } from "@/types/domain";

describe("selected-league draft isolation", () => {
  beforeEach(() => {
    Object.defineProperty(chrome, "tabs", {
      configurable: true,
      value: undefined,
    });
    useAppStore.setState({
      demoEnabled: true,
      hydrationStatus: "idle",
      liveState: null,
      tabLiveState: null,
      draftScope: null,
      runtimeError: null,
    });
  });

  it("clears a completed mock immediately and rejects its later tab refresh", async () => {
    const beers = liveState("beers-draft", "beers-league", "pre_draft");
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(
      envelope(beers) as never,
    );

    useAppStore.getState().beginLeagueDraftSwitch("beers-league");
    useAppStore
      .getState()
      .setLiveState(liveState("big-bucks-mock", "big-bucks", "complete"));

    expect(useAppStore.getState().liveState).toBeNull();
    expect(useAppStore.getState().draftScope).toEqual({
      kind: "league",
      leagueId: "beers-league",
      draftId: null,
    });

    await useAppStore
      .getState()
      .selectLeagueDraft("beers-league", "beers-draft");
    expect(useAppStore.getState().liveState?.context).toMatchObject({
      draftId: "beers-draft",
      leagueId: "beers-league",
      status: "pre_draft",
    });

    useAppStore
      .getState()
      .setLiveState(liveState("big-bucks-mock", "big-bucks", "complete"));
    expect(useAppStore.getState().liveState?.context.draftId).toBe(
      "beers-draft",
    );
  });

  it("ignores a stale league draft response after a second league switch", async () => {
    const bigBucks = deferred<unknown>();
    const beers = deferred<unknown>();
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (message: unknown) => {
        const request = message as {
          type: string;
          payload: { draftId?: string };
        };
        if (request.payload.draftId === "big-bucks-draft")
          return bigBucks.promise as never;
        return beers.promise as never;
      },
    );

    const first = useAppStore
      .getState()
      .selectLeagueDraft("big-bucks", "big-bucks-draft");
    const second = useAppStore
      .getState()
      .selectLeagueDraft("beers-league", "beers-draft");

    beers.resolve(
      envelope(liveState("beers-draft", "beers-league", "drafting")),
    );
    await second;
    bigBucks.resolve(
      envelope(liveState("big-bucks-draft", "big-bucks", "complete")),
    );
    await first;

    expect(useAppStore.getState().liveState?.context).toMatchObject({
      draftId: "beers-draft",
      leagueId: "beers-league",
      status: "drafting",
    });
  });

  it("follows a new draft on the same tab and prefers that open league mock", async () => {
    const bigBucks = liveState("big-bucks-mock", "big-bucks", "complete");
    const beersMock = liveState("beers-open-mock", "beers-league", "drafting");
    useAppStore.setState({
      draftScope: { kind: "tab", draftId: "big-bucks-mock" },
      liveState: bigBucks,
      tabLiveState: bigBucks,
      demoEnabled: false,
    });

    useAppStore.getState().setLiveState(beersMock);
    expect(useAppStore.getState().draftScope).toEqual({
      kind: "tab",
      draftId: "beers-open-mock",
    });
    expect(useAppStore.getState().liveState).toBe(beersMock);

    useAppStore.getState().beginLeagueDraftSwitch("big-bucks");
    useAppStore.getState().setLiveState(beersMock);
    expect(useAppStore.getState().liveState).toBeNull();
    expect(useAppStore.getState().tabLiveState).toBe(beersMock);

    vi.mocked(chrome.runtime.sendMessage).mockClear();
    await useAppStore
      .getState()
      .selectLeagueDraft("beers-league", "beers-main-draft");
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(useAppStore.getState().draftScope).toEqual({
      kind: "league",
      leagueId: "beers-league",
      draftId: "beers-open-mock",
    });
    expect(useAppStore.getState().liveState).toBe(beersMock);
  });

  it("rechecks the active Sleeper route before falling back to the league board", async () => {
    const beersMock = liveState("beers-open-mock", "beers-league", "drafting");
    Object.defineProperty(chrome, "tabs", {
      configurable: true,
      value: {
        query: vi.fn(async () => [
          {
            id: 17,
            url: "https://sleeper.com/draft/nfl/beers-open-mock",
          },
        ]),
      },
    });
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      (message: unknown) => {
        const request = message as { type: string };
        if (request.type === "GET_STATUS") {
          return Promise.resolve(
            envelope({
              extensionVersion: "0.8.1",
              context: {
                supported: true,
                draftId: "beers-open-mock",
              },
              keyStatus: { available: false, mode: null, masked: null },
            }),
          ) as never;
        }
        if (request.type === "GET_LIVE_DRAFT") {
          return Promise.resolve(envelope(beersMock)) as never;
        }
        throw new Error(`Unexpected request ${request.type}`);
      },
    );

    await useAppStore
      .getState()
      .selectLeagueDraft("beers-league", "beers-main-draft");

    expect(chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(useAppStore.getState().draftScope).toEqual({
      kind: "league",
      leagueId: "beers-league",
      draftId: "beers-open-mock",
    });
    expect(useAppStore.getState().liveState).toBe(beersMock);
  });
});

describe("league draft selection", () => {
  const league = {
    league_id: "beers-league",
    name: "Beers BB $50",
    season: "2026",
    sport: "nfl",
    draft_id: null,
    settings: {},
    scoring_settings: {},
    roster_positions: [],
  };

  it("uses Sleeper's league draft id when it is present", () => {
    expect(
      resolveLeagueDraftId({
        league: { ...league, draft_id: "authoritative-draft" },
        drafts: [],
      }),
    ).toBe("authoritative-draft");
  });

  it("prefers an active same-season board and excludes another league", () => {
    expect(
      resolveLeagueDraftId({
        league,
        drafts: [
          draft("other-live", "other-league", "drafting", 30),
          draft("beers-complete", "beers-league", "complete", 20),
          draft("beers-pre", "beers-league", "pre_draft", 10),
        ],
      }),
    ).toBe("beers-pre");
  });
});

describe("initial league draft reconciliation", () => {
  it("replaces an unrelated demo fixture with the selected league draft", async () => {
    const originalSelectLeagueDraft = useAppStore.getState().selectLeagueDraft;
    const selectLeagueDraft = vi.fn(async () => undefined);
    useAppStore.setState({ demoEnabled: true, selectLeagueDraft });
    useLeagueStore.setState({
      activeContext: { leagueId: "beers-league" } as never,
      snapshot: {
        league: {
          league_id: "beers-league",
          draft_id: "beers-authoritative",
        },
        drafts: [draft("beers-fallback", "beers-league", "pre_draft", 10)],
      } as never,
    });

    try {
      await reconcileHydratedLeagueDraft();
      expect(selectLeagueDraft).toHaveBeenCalledWith(
        "beers-league",
        "beers-authoritative",
      );
    } finally {
      useAppStore.setState({ selectLeagueDraft: originalSelectLeagueDraft });
      useLeagueStore.setState({ activeContext: null, snapshot: null });
    }
  });

  it("does not replace an authoritative tab draft", async () => {
    const originalSelectLeagueDraft = useAppStore.getState().selectLeagueDraft;
    const selectLeagueDraft = vi.fn(async () => undefined);
    useAppStore.setState({ demoEnabled: false, selectLeagueDraft });
    useLeagueStore.setState({
      activeContext: { leagueId: "beers-league" } as never,
      snapshot: {
        league: { league_id: "beers-league", draft_id: "beers-draft" },
        drafts: [],
      } as never,
    });

    try {
      await reconcileHydratedLeagueDraft();
      expect(selectLeagueDraft).not.toHaveBeenCalled();
    } finally {
      useAppStore.setState({ selectLeagueDraft: originalSelectLeagueDraft });
      useLeagueStore.setState({ activeContext: null, snapshot: null });
    }
  });
});

describe("Sleeper route league binding", () => {
  it("selects the league visible in the authenticated Sleeper tab", async () => {
    const originalSelectLeague = useLeagueStore.getState().selectLeague;
    const selectLeague = vi.fn(async () => undefined);
    useLeagueStore.setState({
      catalog: [
        { leagueId: "beers-league" },
        { leagueId: "big-bucks" },
      ] as never,
      activeContext: { leagueId: "beers-league" } as never,
      selectLeague,
    });

    try {
      await selectSleeperRouteLeague("big-bucks");
      expect(selectLeague).toHaveBeenCalledWith("big-bucks", {
        syncDraft: false,
      });
    } finally {
      useLeagueStore.setState({
        catalog: [],
        activeContext: null,
        snapshot: null,
        selectLeague: originalSelectLeague,
      });
    }
  });

  it("ignores an unknown or already-selected route league", async () => {
    const originalSelectLeague = useLeagueStore.getState().selectLeague;
    const selectLeague = vi.fn(async () => undefined);
    useLeagueStore.setState({
      catalog: [{ leagueId: "beers-league" }] as never,
      activeContext: { leagueId: "beers-league" } as never,
      selectLeague,
    });

    try {
      await selectSleeperRouteLeague("beers-league");
      await selectSleeperRouteLeague("not-in-account");
      await selectSleeperRouteLeague(null);
      expect(selectLeague).not.toHaveBeenCalled();
    } finally {
      useLeagueStore.setState({
        catalog: [],
        activeContext: null,
        snapshot: null,
        selectLeague: originalSelectLeague,
      });
    }
  });
});

function draft(
  draftId: string,
  leagueId: string,
  status: string,
  startTime: number,
) {
  return {
    draft_id: draftId,
    league_id: leagueId,
    type: "snake",
    status,
    season: "2026",
    sport: "nfl",
    start_time: startTime,
    settings: {},
    metadata: {},
  };
}

function liveState(
  draftId: string,
  leagueId: string,
  status: LiveDraftState["context"]["status"],
): LiveDraftState {
  return {
    context: {
      supported: true,
      source: "sleeper",
      leagueId,
      sourceLeagueId: leagueId,
      leagueName: leagueId,
      draftId,
      sessionKind: "league_draft",
      sessionKindConfidence: 1,
      sessionKindEvidence: ["League isolation test"],
      sessionKindOverride: false,
      draftStyle: "snake",
      mode: "redraft",
      modeConfidence: 1,
      modeEvidence: ["League isolation test"],
      status,
      currentPick: 1,
      currentRound: 1,
      ownedPickNumbers: [1],
      isUserOnClock: false,
      lastUpdatedAt: Date.now(),
      connected: true,
    },
    format: {
      mode: "redraft",
      scoring: "ppr",
      teams: 12,
      starters: {},
      bench: 0,
      taxi: 0,
      injuredReserve: 0,
      superflex: false,
      twoQuarterback: false,
      tightEndPremium: false,
      pointsPerFirstDown: false,
      idp: false,
      bestBall: true,
    },
    picks: [],
    players: [],
    fetchedAt: Date.now(),
    playerIndexStale: false,
  };
}

function envelope(data: unknown) {
  return { ok: true, requestId: crypto.randomUUID(), data };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
