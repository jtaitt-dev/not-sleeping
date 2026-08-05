import { describe, expect, it } from "vitest";

import { recommendWaiver } from "@/services/waivers/waiver-service";
import type { WaiverPlayer } from "@/services/waivers/waiver-service";
import type { LeagueContext } from "@/types/league";

const context = {
  leagueId: "1",
  season: "2026",
  week: 5,
  waiverType: "faab",
  leagueType: "redraft",
  lineupType: "standard",
  rosterId: 1,
  settings: {},
  scoringSettings: {},
} as unknown as LeagueContext;

const player: WaiverPlayer = {
  playerId: "p1",
  name: "Some Player",
  positions: ["WR"],
  team: "DET",
  shortTermValue: 62,
  restOfSeasonValue: 58,
  dynastyValue: 55,
  contenderValue: 60,
  rebuildValue: 48,
  breakoutProbability: 0.4,
  stashValue: 35,
  risk: 0.3,
};

/**
 * The row now draws the spread as a track instead of printing each bid, so the
 * band is positioned from conservative to aggressive and the tick from
 * expected. If any of those ever ordered differently the band would be given a
 * negative width and silently vanish, taking the only spread cue with it.
 */
describe("faab bids stay ordered so the range bar can be drawn", () => {
  const budgets = [0, 1, 7, 43, 100, 1000];
  const urgencies = [0, 0.35, 1];
  const scarcities = [0, 0.5, 1];

  it("never inverts conservative, expected, aggressive and max", () => {
    let checked = 0;
    for (const budget of budgets) {
      for (const urgency of urgencies) {
        for (const positionScarcity of scarcities) {
          for (const zeroDollarAllowed of [true, false]) {
            const { faab } = recommendWaiver({
              context,
              player,
              roster: [],
              budget,
              startingBudget: 100,
              otherBudgets: [budget, Math.floor(budget / 2)],
              historicalWinningBids: [3, 14, 27],
              leagueSize: 12,
              positionNeed: 0.55,
              positionScarcity,
              urgency,
              zeroDollarAllowed,
            });
            if (!faab) continue;
            checked += 1;
            expect(faab.conservativeBid).toBeLessThanOrEqual(
              faab.expectedWinningBid,
            );
            expect(faab.expectedWinningBid).toBeLessThanOrEqual(
              faab.aggressiveBid,
            );
            expect(faab.aggressiveBid).toBeLessThanOrEqual(
              faab.maximumRationalBid,
            );
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("respects a league that forbids a zero-dollar claim", () => {
    const { faab } = recommendWaiver({
      context,
      player,
      roster: [],
      budget: 100,
      startingBudget: 100,
      otherBudgets: [100],
      historicalWinningBids: [],
      leagueSize: 12,
      positionNeed: 0.55,
      positionScarcity: 0.5,
      urgency: 0.5,
      zeroDollarAllowed: false,
    });
    expect(faab?.conservativeBid).toBeGreaterThanOrEqual(1);
  });
});
