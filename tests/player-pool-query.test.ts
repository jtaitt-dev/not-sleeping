import { describe, expect, it } from "vitest";

import { createPlayerPoolPredicate } from "@/services/draft/player-pool-query";
import type { Player, Position } from "@/types/domain";

describe("league-aware player-pool retrieval", () => {
  it("applies league eligibility before the limit for a 336-pick best-ball draft", () => {
    const idp = Array.from({ length: 125 }, (_, index) =>
      player(`idp-${index}`, "LB", index + 1),
    );
    const offense = Array.from({ length: 400 }, (_, index) =>
      player(`wr-${index}`, "WR", index + 126),
    );
    const matches = createPlayerPoolPredicate({
      playerPool: "all_available",
      rosterSlots: ["QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX", "BN"],
    });

    const limited = [...idp, ...offense].filter(matches).slice(0, 456);

    expect(limited).toHaveLength(400);
    expect(
      limited.slice(0, 336).every((candidate) => candidate.position === "WR"),
    ).toBe(true);
  });

  it("filters rookie, veteran, unavailable, and IDP constraints consistently", () => {
    const players = [
      player("rookie-wr", "WR", 1, 0),
      player("veteran-wr", "WR", 2, 4),
      player("rookie-lb", "LB", 3, 0),
    ];

    expect(
      players
        .filter(
          createPlayerPoolPredicate({
            playerPool: "rookies_only",
            rosterSlots: ["WR", "BN"],
            excludePlayerIds: ["rookie-wr"],
          }),
        )
        .map((candidate) => candidate.id),
    ).toEqual([]);
    expect(
      players
        .filter(
          createPlayerPoolPredicate({
            playerPool: "veterans_only",
            rosterSlots: ["WR", "BN"],
          }),
        )
        .map((candidate) => candidate.id),
    ).toEqual(["veteran-wr"]);
    expect(
      players
        .filter(createPlayerPoolPredicate({ idpOnly: true }))
        .map((candidate) => candidate.id),
    ).toEqual(["rookie-lb"]);
  });
});

function player(
  id: string,
  position: Position,
  searchRank: number,
  yearsExperience = 2,
): Player {
  return {
    id,
    firstName: id,
    lastName: "Player",
    fullName: `${id} Player`,
    normalizedName: `${id} player`,
    position,
    status: "active",
    yearsExperience,
    searchRank,
    fantasyPositions: [position],
  };
}
