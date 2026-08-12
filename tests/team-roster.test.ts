import { describe, expect, it } from "vitest";

import { buildTeamRosterSections } from "@/features/workspaces/team-roster";
import type { Player } from "@/types/domain";

const player = (id: string, position: Player["position"]): Player => ({
  id,
  sleeperId: id,
  firstName: id,
  lastName: position,
  fullName: `${id} ${position}`,
  normalizedName: `${id} ${position}`.toLowerCase(),
  position,
  team: "BUF",
  status: "active",
  fantasyPositions: [position],
});

const players = [
  player("qb", "QB"),
  player("rb", "RB"),
  player("wr", "WR"),
  player("bench", "TE"),
  player("taxi", "WR"),
  player("reserve", "RB"),
];

describe("team roster sections", () => {
  it("preserves exact starter slot and player order", () => {
    const sections = buildTeamRosterSections({
      rosterPositions: ["QB", "RB", "WR", "BN", "BN"],
      playerIds: ["qb", "rb", "wr"],
      starterIds: ["wr", "0", "qb"],
      players,
    });

    expect(sections[0]?.rows.map((row) => [row.slot, row.playerId])).toEqual([
      ["QB", "wr"],
      ["RB", null],
      ["WR", "qb"],
    ]);
  });

  it("isolates bench, taxi, and reserve players without duplicates", () => {
    const sections = buildTeamRosterSections({
      rosterPositions: ["QB", "RB", "WR", "BN", "TAXI", "IR"],
      playerIds: ["qb", "rb", "wr", "bench", "taxi", "reserve"],
      starterIds: ["qb", "rb", "wr"],
      taxiIds: ["taxi"],
      reserveIds: ["reserve"],
      players,
    });

    expect(
      sections
        .find((section) => section.key === "bench")
        ?.rows.map((row) => row.playerId),
    ).toEqual(["bench"]);
    expect(
      sections
        .find((section) => section.key === "taxi")
        ?.rows.map((row) => row.playerId),
    ).toEqual(["taxi"]);
    expect(
      sections
        .find((section) => section.key === "reserve")
        ?.rows.map((row) => row.playerId),
    ).toEqual(["reserve"]);

    const ids = sections.flatMap((section) =>
      section.rows.flatMap((row) => (row.playerId ? [row.playerId] : [])),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not let a reserved player leak into a starter or bench row", () => {
    const sections = buildTeamRosterSections({
      rosterPositions: ["QB", "BN", "IR"],
      playerIds: ["reserve", "bench"],
      starterIds: ["reserve"],
      reserveIds: ["reserve"],
      players,
    });

    expect(sections[0]?.rows[0]).toMatchObject({
      slot: "QB",
      playerId: null,
    });
    expect(
      sections
        .find((section) => section.key === "bench")
        ?.rows.map((row) => row.playerId),
    ).toEqual(["bench"]);
    expect(
      sections.find((section) => section.key === "reserve")?.rows[0]?.playerId,
    ).toBe("reserve");
  });

  it("keeps configured empty bench, taxi, and reserve slots visible", () => {
    const sections = buildTeamRosterSections({
      rosterPositions: ["QB", "BN", "BN", "TAXI", "TAXI", "IR", "IR"],
      playerIds: ["qb", "bench", "taxi", "reserve"],
      starterIds: ["qb"],
      taxiIds: ["taxi"],
      reserveIds: ["reserve"],
      players,
    });

    expect(
      sections
        .find((section) => section.key === "bench")
        ?.rows.map((row) => row.playerId),
    ).toEqual(["bench", null]);
    expect(
      sections
        .find((section) => section.key === "taxi")
        ?.rows.map((row) => row.playerId),
    ).toEqual(["taxi", null]);
    expect(
      sections
        .find((section) => section.key === "reserve")
        ?.rows.map((row) => row.playerId),
    ).toEqual(["reserve", null]);
  });

  it("uses one ordered roster section for best-ball leagues", () => {
    const sections = buildTeamRosterSections({
      rosterPositions: ["QB", "RB", "WR", "BN"],
      playerIds: ["wr", "qb", "rb", "wr"],
      starterIds: [],
      reserveIds: ["rb"],
      taxiIds: ["wr"],
      players,
      rosterOnly: true,
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Roster");
    expect(sections[0]?.rows.map((row) => row.playerId)).toEqual([
      "wr",
      "qb",
      "rb",
    ]);
  });

  it("falls back to one roster section when no starter slots exist", () => {
    const sections = buildTeamRosterSections({
      rosterPositions: ["BN", "BN", "TAXI", "IR"],
      playerIds: ["bench", "taxi"],
      starterIds: [],
      players,
    });

    expect(sections.map((section) => section.key)).toEqual(["roster"]);
    expect(sections[0]?.rows.map((row) => row.playerId)).toEqual([
      "bench",
      "taxi",
    ]);
  });
});
