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

describe("Phase 2 local performance budgets", () => {
  it("switches cached league context in under 250ms", () => {
    const started = performance.now();
    for (let index = 0; index < 5; index += 1) {
      createLeagueContext({
        league: league(`league-${index}`),
        userId: "user",
        week: index + 1,
        fetchedAt: Date.now(),
      });
    }
    expect(performance.now() - started).toBeLessThan(250);
  });

  it("solves standard and large IDP lineups within their budgets", () => {
    const players = lineupPlayers(90);
    const standardStarted = performance.now();
    optimizeLineup({
      rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"],
      players,
    });
    expect(performance.now() - standardStarted).toBeLessThan(100);

    const idpStarted = performance.now();
    optimizeLineup({
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
    expect(performance.now() - idpStarted).toBeLessThan(300);
  });

  it("filters a cached waiver pool in under 150ms", () => {
    const started = performance.now();
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
    expect(performance.now() - started).toBeLessThan(150);
  });

  it("simulates a typical trade in under 300ms", () => {
    const context = createLeagueContext({
      league: league("trade"),
      userId: "user",
      week: 8,
    });
    const started = performance.now();
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
    expect(performance.now() - started).toBeLessThan(300);
  });

  it("recalculates a typical draft board in under 500ms", () => {
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
    const started = performance.now();
    expect(session.recommendations(100)).toHaveLength(100);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("searches 10,000 cached player labels in under 100ms", () => {
    const labels = Array.from(
      { length: 10_000 },
      (_, index) => `Player ${index} team position`,
    );
    const started = performance.now();
    const matches = labels.filter((label) =>
      label.toLowerCase().includes("player 99"),
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(performance.now() - started).toBeLessThan(100);
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
