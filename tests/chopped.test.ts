import { describe, expect, it } from "vitest";

import {
  detectSleeperCapabilities,
  detectWeeklyElimination,
} from "@/config/sleeper-capabilities";
import { analyzeChoppedLeague } from "@/services/chopped/chopped-service";
import type { SleeperLeague } from "@/schemas/sleeper";

describe("weekly-elimination capability", () => {
  it("uses explicit settings or a manual override without inspecting the league name", () => {
    expect(detectWeeklyElimination({ weekly_elimination: 1 })).toBe(true);
    expect(detectWeeklyElimination({})).toBe(false);

    const league = {
      league_id: "league-1",
      name: "Definitely A Guillotine League",
      season: "2026",
      sport: "nfl",
      settings: {},
      scoring_settings: { rec: 1 },
      roster_positions: ["QB", "RB", "WR", "FLEX", "BN"],
    } satisfies SleeperLeague;
    expect(detectSleeperCapabilities(league).weeklyElimination).toBe(false);
    expect(
      detectSleeperCapabilities(league, null, {
        weeklyElimination: true,
        eliminationTiebreaker: "bench points",
      }),
    ).toMatchObject({
      weeklyElimination: true,
      eliminationTiebreaker: "bench points",
    });
  });
});

describe("chopped survival model", () => {
  it("ranks every active team, excludes eliminated rosters, and identifies urgent survival", () => {
    const analysis = analyzeChoppedLeague({
      userRosterId: 1,
      tradesEnabled: false,
      bestBall: true,
      tiebreaker: null,
      releasedPlayers: [
        { playerId: "star", name: "Released Star", position: "WR", value: 94 },
      ],
      teams: [
        team(1, 62, 22, 13, 39, 80),
        team(2, 91, 31, 21, 45, 55),
        team(3, 86, 25, 16, 38, 62),
        { ...team(4, 0, 0, 0, 0, 0), eliminated: true },
      ],
    });

    expect(analysis.teams).toHaveLength(3);
    expect(analysis.chopZone?.rosterId).toBe(1);
    expect(analysis.user?.probabilityLast).toBeGreaterThan(0.5);
    expect(analysis.lineupApproach).toBe("ceiling_required");
    expect(analysis.faabRecommendation).toContain("urgent");
    expect(analysis.tradeMessage).toContain("disabled");
    expect(analysis.bestBallMessage).toContain("Best Ball hybrid");
    expect(analysis.releasedPlayerTargets[0]?.playerId).toBe("star");
    expect(
      analysis.teams.reduce((sum, row) => sum + row.probabilityLast, 0),
    ).toBeCloseTo(1, 3);
  });

  it("uses floor-first guidance for a clearly safe roster and exposes tiebreak rules", () => {
    const analysis = analyzeChoppedLeague({
      userRosterId: 1,
      tradesEnabled: true,
      bestBall: false,
      tiebreaker: "season points",
      teams: [
        team(1, 140, 35, 25, 50, 120),
        team(2, 78, 20, 12, 30, 75),
        team(3, 92, 25, 16, 37, 64),
      ],
    });

    expect(analysis.lineupApproach).toBe("floor_first");
    expect(analysis.tiebreakerMessage).toContain("season points");
    expect(analysis.tradeMessage).toContain("enabled");
  });
});

function team(
  rosterId: number,
  currentPoints: number,
  projectedRemaining: number,
  floorRemaining: number,
  ceilingRemaining: number,
  faabRemaining: number,
) {
  return {
    rosterId,
    name: `Roster ${rosterId}`,
    currentPoints,
    projectedRemaining,
    floorRemaining,
    ceilingRemaining,
    lockedPoints: currentPoints,
    injuryExposure: 0,
    faabRemaining,
    eliminated: false,
  };
}
