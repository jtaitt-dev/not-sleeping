import { describe, expect, it } from "vitest";

import {
  MockDraftSession,
  assertDraftInvariants,
  pickCoordinates,
  type DraftEngineConfig,
  type DraftEnginePlayer,
} from "@/services/draft/draft-engine";

const players: DraftEnginePlayer[] = Array.from(
  { length: 320 },
  (_, index) => ({
    playerId: `p${index + 1}`,
    name: `Player ${index + 1}`,
    positions: [["QB", "RB", "WR", "TE", "DL", "LB", "DB"][index % 7] ?? "WR"],
    team: ["BUF", "KC", "DAL", "PHI"][index % 4],
    adp: index + 1,
    tier: Math.floor(index / 12) + 1,
    redraftValue: 100 - index * 0.45,
    dynastyValue: 100 - index * 0.38,
    contenderValue: 100 - index * 0.5,
    rookie: index % 5 === 0,
    age: 21 + (index % 12),
    auctionValue: Math.max(1, 60 - index),
  }),
);

const config: DraftEngineConfig = {
  seed: 42,
  leagueType: "dynasty",
  teams: 10,
  rounds: 8,
  style: "third_round_reversal",
  playerPool: "all_available",
  rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "SUPER_FLEX", "BN"],
  userSlot: 3,
  opponentArchetypes: [
    "adp_follower",
    "zero_rb",
    "hero_rb",
    "early_qb",
    "late_qb",
    "te_premium",
    "superflex_qb_hoarder",
    "dynasty_youth",
    "idp_early",
    "random_within_tier",
  ],
  superflex: true,
  idp: true,
  tradedPickOwners: { 12: 7 },
  keepers: { 5: "p120" },
};

describe("Mock Draft Lab engine", () => {
  it("generates correct 3RR order beginning in round three", () => {
    expect(pickCoordinates(config, 1).draftSlot).toBe(1);
    expect(pickCoordinates(config, 10).draftSlot).toBe(10);
    expect(pickCoordinates(config, 11).draftSlot).toBe(10);
    expect(pickCoordinates(config, 20).draftSlot).toBe(1);
    expect(pickCoordinates(config, 21).draftSlot).toBe(10);
    expect(pickCoordinates(config, 30).draftSlot).toBe(1);
    expect(pickCoordinates(config, 31).draftSlot).toBe(1);
  });

  it("completes reproducibly with legal keepers, traded picks, and no duplicates", () => {
    const first = new MockDraftSession(structuredClone(config), players);
    const second = new MockDraftSession(structuredClone(config), players);
    const firstState = first.autoComplete();
    const secondState = second.autoComplete();
    expect(firstState.picks).toEqual(secondState.picks);
    expect(firstState.picks[4]).toMatchObject({
      playerId: "p120",
      isKeeper: true,
    });
    expect(firstState.picks[11]?.ownerSlot).toBe(7);
    expect(assertDraftInvariants(config, firstState, players)).toEqual({
      passed: true,
      errors: [],
    });
    expect(firstState.recommendationLatencyMs).toBeLessThan(500);
  });

  it("supports pause, resume, undo, redo, and injected future trades", () => {
    const session = new MockDraftSession(structuredClone(config), players);
    session.start();
    session.makePick("p1");
    session.pause();
    expect(session.snapshot().status).toBe("paused");
    session.resume();
    session.injectTrade(3, 9);
    session.makePick("p2");
    expect(session.snapshot().picks).toHaveLength(2);
    session.undo();
    expect(session.snapshot().picks).toHaveLength(1);
    session.redo();
    expect(session.snapshot().picks).toHaveLength(2);
  });

  it("completes a 15-round mock with every user selection made manually from a legal recommendation", () => {
    const manualConfig: DraftEngineConfig = {
      ...structuredClone(config),
      teams: 10,
      rounds: 15,
      style: "snake",
      userSlot: 3,
      keepers: {},
      tradedPickOwners: {},
      idp: false,
      rosterSlots: [
        "QB",
        "RB",
        "RB",
        "WR",
        "WR",
        "WR",
        "TE",
        "FLEX",
        "SUPER_FLEX",
        "BN",
        "BN",
        "BN",
        "BN",
        "BN",
        "BN",
      ],
    };
    const session = new MockDraftSession(manualConfig, players);
    session.start();
    let manualPicks = 0;
    while (session.snapshot().status === "drafting") {
      session.simulateOpponentsToUserTurn();
      if (session.snapshot().status === "complete") break;
      expect(session.isUserOnClock()).toBe(true);
      const recommendation = session.recommendations(8)[0];
      expect(recommendation).toBeDefined();
      if (!recommendation) throw new Error("Expected a legal recommendation.");
      expect(session.snapshot().availablePlayerIds).toContain(
        recommendation.playerId,
      );
      session.makeUserPick(recommendation.playerId);
      manualPicks += 1;
    }
    const state = session.snapshot();
    expect(manualPicks).toBe(15);
    expect(state.picks).toHaveLength(150);
    expect(new Set(state.picks.map((pick) => pick.playerId)).size).toBe(150);
    expect(assertDraftInvariants(manualConfig, state, players)).toEqual({
      passed: true,
      errors: [],
    });
  });

  it("never accepts a manual user pick while an opponent owns the clock", () => {
    const session = new MockDraftSession(structuredClone(config), players);
    session.start();
    expect(session.isUserOnClock()).toBe(false);
    expect(() => session.makeUserPick("p1")).toThrow(/user is on the clock/);
  });

  it("never recommends or accepts a pick that makes the final roster impossible", () => {
    const constrainedPlayers: DraftEnginePlayer[] = [
      ...Array.from({ length: 4 }, (_, index) => ({
        ...players[index]!,
        playerId: `qb-${index + 1}`,
        positions: ["QB"],
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        ...players[index + 4]!,
        playerId: `rb-${index + 1}`,
        positions: ["RB"],
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        ...players[index + 8]!,
        playerId: `wr-${index + 1}`,
        positions: ["WR"],
      })),
    ];
    const constrainedConfig: DraftEngineConfig = {
      ...structuredClone(config),
      teams: 2,
      rounds: 3,
      style: "linear",
      rosterSlots: ["QB", "RB", "WR"],
      userSlot: 1,
      keepers: {},
      tradedPickOwners: {},
    };
    const session = new MockDraftSession(constrainedConfig, constrainedPlayers);
    session.start();
    session.makePick("qb-1");
    session.makePick("qb-2");

    expect(session.isLegalPick("qb-3")).toBe(false);
    expect(
      session.recommendations(12).map((entry) => entry.playerId),
    ).not.toContain("qb-3");
    expect(() => session.makePick("qb-3")).toThrow(/legal position slots/);
    expect(session.makePick("rb-1").picks).toHaveLength(3);
  });

  it("prevents rookie and veteran leakage", () => {
    const rookieSession = new MockDraftSession(
      {
        ...structuredClone(config),
        rounds: 2,
        playerPool: "rookies_only",
        keepers: {},
      },
      players,
    );
    const rookieState = rookieSession.autoComplete();
    expect(
      rookieState.picks.every(
        (pick) =>
          players.find((player) => player.playerId === pick.playerId)?.rookie,
      ),
    ).toBe(true);
    expect(
      assertDraftInvariants(
        { ...config, rounds: 2, playerPool: "rookies_only", keepers: {} },
        rookieState,
        players,
      ).passed,
    ).toBe(true);
  });

  it("enforces auction budgets and maximum bids", () => {
    const auctionConfig: DraftEngineConfig = {
      ...structuredClone(config),
      teams: 4,
      rounds: 3,
      style: "auction",
      auctionBudget: 20,
      minimumAuctionBid: 1,
      tradedPickOwners: {},
      keepers: {},
    };
    const session = new MockDraftSession(auctionConfig, players);
    session.start();
    expect(() => session.makePick("p1", 19)).toThrow(/between 1 and 18/);
    session.makePick("p1", 18);
    expect(session.snapshot().budgets[1]).toBe(2);
  });
});
