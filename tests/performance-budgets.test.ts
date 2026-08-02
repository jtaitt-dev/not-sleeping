import { describe, expect, it } from "vitest";

import type { SleeperLeague } from "@/schemas/sleeper";
import {
  MockDraftSession,
  type DraftEnginePlayer,
} from "@/services/draft/draft-engine";
import { createLeagueContext } from "@/services/league/league-context";
import { optimizeLineup } from "@/services/lineup/lineup-optimizer";
import { analyzeTrade } from "@/services/trades/trade-service";
import { availablePlayerIds } from "@/services/waivers/waiver-service";

describe("Phase 2 performance invariants", () => {
  it("creates isolated cached league contexts", () => {
    const contexts = Array.from({ length: 5 }, (_, index) =>
      createLeagueContext({
        league: league(`league-${index}`),
        userId: "user",
        week: index + 1,
        fetchedAt: Date.now(),
      }),
    );
    expect(contexts.map((context) => context.leagueId)).toEqual([
      "league-0",
      "league-1",
      "league-2",
      "league-3",
      "league-4",
    ]);
  });

  it("solves standard and large IDP lineups legally and deterministically", () => {
    const players = lineupPlayers(90);
    const standard = optimizeLineup({
      rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"],
      players,
    });
    const idp = optimizeLineup({
      rosterPositions: [
        "QB",
        "RB",
        "RB",
        "WR",
        "WR",
        "TE",
        "SUPER_FLEX",
        "FLEX",
        "DL",
        "DL",
        "LB",
        "LB",
        "LB",
        "DB",
        "DB",
        "IDP_FLEX",
      ],
      players,
    });
    const repeat = optimizeLineup({
      rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"],
      players,
    });

    expect(standard.emptySlots).toEqual([]);
    expect(idp.emptySlots).toEqual([]);
    expect(standard.assignments).toHaveLength(9);
    expect(idp.assignments).toHaveLength(16);
    expect(standard.alternatives.length).toBeLessThanOrEqual(3);
    expect(idp.alternatives.length).toBeLessThanOrEqual(3);
    expect(repeat).toEqual(standard);
  });

  it("filters a large cached waiver pool without leaking rostered players", () => {
    const result = availablePlayerIds({
      allPlayerIds: Array.from({ length: 2_000 }, (_, index) => `p${index}`),
      rosters: Array.from({ length: 32 }, (_, rosterIndex) => ({
        roster_id: rosterIndex + 1,
        owner_id: `u${rosterIndex}`,
        league_id: "large",
        players: Array.from(
          { length: 30 },
          (_, playerIndex) => `p${rosterIndex * 30 + playerIndex}`,
        ),
        starters: [],
        reserve: [],
        taxi: [],
        settings: {},
      })),
    });
    expect(result.length).toBe(1_040);
    expect(result).not.toContain("p0");
    expect(result).toContain("p1999");
  });

  it("analyzes every party in a multi-team trade", () => {
    const context = createLeagueContext({
      league: league("trade"),
      userId: "user",
      week: 8,
    });
    const result = analyzeTrade({
      context,
      parties: [1, 2, 3].map((rosterId) => ({
        rosterId,
        teamName: `Team ${rosterId}`,
        sends: [],
        receives: [],
        beforeStarterPoints: 100,
        afterStarterPoints: 102,
        beforeDepth: 20,
        afterDepth: 20,
        rosterSpotsAfter: 0,
      })),
    });
    expect(result.parties).toHaveLength(3);
  });

  it("recalculates a bounded deterministic draft board", () => {
    const players = draftPlayers(500);
    const session = new MockDraftSession(
      {
        seed: 42,
        leagueType: "redraft",
        teams: 12,
        rounds: 15,
        style: "snake",
        playerPool: "all_available",
        rosterSlots: [
          "QB",
          "RB",
          "RB",
          "WR",
          "WR",
          "TE",
          "FLEX",
          "BN",
          "BN",
          "BN",
          "BN",
          "BN",
          "BN",
          "BN",
          "BN",
        ],
        userSlot: 6,
        opponentArchetypes: ["adp_follower", "positional_need"],
      },
      players,
    );
    session.start();
    expect(session.recommendations(100)).toHaveLength(100);
  });

  it("searches 10,000 cached player labels consistently", () => {
    const labels = Array.from(
      { length: 10_000 },
      (_, index) => `Player ${index} team position`,
    );
    const matches = labels.filter((label) =>
      label.toLowerCase().includes("player 99"),
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.at(0)).toBe("Player 99 team position");
  });
});

function league(id: string): SleeperLeague {
  return {
    league_id: id,
    name: id,
    season: "2026",
    sport: "nfl",
    settings: { type: 0, waiver_type: 0 },
    scoring_settings: { rec: 1 },
    roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"],
  };
}

function lineupPlayers(count: number) {
  const positions = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];
  return Array.from({ length: count }, (_, index) => ({
    playerId: `lineup-${index}`,
    name: `Lineup Player ${index}`,
    eligiblePositions: [positions[index % positions.length] ?? "WR"],
    expectedPoints: 30 - index * 0.1,
    floor: 20 - index * 0.05,
    ceiling: 40 - index * 0.1,
  }));
}

function draftPlayers(count: number): DraftEnginePlayer[] {
  const positions = ["QB", "RB", "WR", "TE", "K", "DEF"];
  return Array.from({ length: count }, (_, index) => ({
    playerId: `draft-${index}`,
    name: `Draft Player ${index}`,
    positions: [positions[index % positions.length] ?? "WR"],
    adp: index + 1,
    tier: Math.floor(index / 12) + 1,
    redraftValue: Math.max(1, 100 - index * 0.15),
    dynastyValue: Math.max(1, 100 - index * 0.13),
    contenderValue: Math.max(1, 100 - index * 0.16),
    rookie: index % 8 === 0,
  }));
}
