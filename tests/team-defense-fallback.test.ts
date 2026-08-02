import { mergeTeamDefenseFallback } from "@/services/context/team-defense-fallback";
import type { Player } from "@/types/domain";
import { describe, expect, it } from "vitest";

describe("mergeTeamDefenseFallback", () => {
  it("supplies every team defense when Sleeper's index omits specialists", () => {
    const defenses = mergeTeamDefenseFallback([]);

    expect(defenses).toHaveLength(32);
    expect(defenses).toContainEqual(
      expect.objectContaining({
        id: "NE",
        fullName: "New England Patriots",
        position: "DEF",
        team: "NE",
      }),
    );
  });

  it("prefers the current Sleeper record over fallback metadata", () => {
    const indexed: Player = {
      id: "NE",
      sleeperId: "NE",
      firstName: "New England",
      lastName: "Patriots",
      fullName: "Sleeper New England Patriots",
      normalizedName: "sleeper new england patriots",
      position: "DEF",
      team: "NE",
      status: "active",
      fantasyPositions: ["DEF"],
    };

    const defenses = mergeTeamDefenseFallback([indexed]);

    expect(defenses).toHaveLength(32);
    expect(defenses.find((player) => player.id === "NE")).toBe(indexed);
  });
});
