import { describe, expect, it } from "vitest";

import {
  buildRookieProfile,
  compareRookiePickScenarios,
} from "@/services/rookies/rookie-service";
import type { Player } from "@/types/domain";

const context = {
  strategy: "rebuild" as const,
  lineupType: "classic" as const,
  rosterPositions: ["QB", "RB", "WR", "TE", "SUPER_FLEX", "BN", "TAXI"],
  scoringSettings: { rec: 1, bonus_rec_te: 0.5 },
  settings: { taxi_slots: 4 },
};

describe("rookie profiles and pick scenarios", () => {
  it("uses real identity fields and marks unavailable prospect data instead of inventing it", () => {
    const profile = buildRookieProfile(player({ position: "QB" }), context);

    expect(profile.identity).toMatchObject({
      sleeperId: "rookie-1",
      team: "NYG",
      nflRound: 1,
      nflOverallPick: 7,
    });
    expect(profile.longTermProjection).toBeGreaterThan(0);
    expect(profile.ceiling).toBeGreaterThan(profile.floor);
    expect(profile.missingFields).toContain("licensed athletic data");
    expect(profile.missingFields).toContain("early-declare status");
  });

  it("compares all required pick-return families with bounded uncertainty", () => {
    const profile = buildRookieProfile(player(), context);
    const rows = compareRookiePickScenarios({
      pickNumber: 4,
      profile,
      strategy: "rebuild",
      futurePickCount: 3,
      taxiOpenSlots: 2,
      rosterCutPressure: 1,
    });

    expect(rows.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        "player_now",
        "trade_down",
        "trade_up",
        "future_pick",
        "later_picks",
        "veteran_return",
      ]),
    );
    expect(rows.every((row) => row.floor <= row.expectedValue)).toBe(true);
    expect(rows.every((row) => row.ceiling >= row.expectedValue)).toBe(true);
  });
});

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "rookie-1",
    sleeperId: "rookie-1",
    firstName: "Rookie",
    lastName: "One",
    fullName: "Rookie One",
    normalizedName: "rookie one",
    position: "WR",
    team: "NYG",
    age: 21,
    yearsExperience: 0,
    status: "active",
    college: "Example State",
    nflDraftYear: 2026,
    nflDraftRound: 1,
    nflDraftPick: 7,
    searchRank: 35,
    fantasyPositions: ["WR"],
    ...overrides,
  };
}
