import { describe, expect, it } from "vitest";

import { assignStarterSlots } from "@/features/workspaces/all-workspaces";

const p = (position: string, id = position) => ({ player: { position, id } });

const ELIGIBLE: Record<string, string[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  FLEX: ["RB", "WR", "TE"],
  SF: ["QB", "RB", "WR", "TE"],
};

/**
 * The projected-starters list used to zip a score-ordered roster against the
 * slot array by index, so the highest-scoring player was labelled QB whatever
 * they played and a quarterback could land in a running-back slot.
 */
describe("starter slots respect position eligibility", () => {
  it("never places a player in a slot its position cannot fill", () => {
    const assigned = assignStarterSlots([
      p("WR", "wr1"),
      p("WR", "wr2"),
      p("RB", "rb1"),
      p("QB", "qb1"),
      p("TE", "te1"),
    ]);
    for (const { slot, entry } of assigned) {
      if (!entry) continue;
      expect(ELIGIBLE[slot]).toContain(entry.player.position);
    }
  });

  it("puts the quarterback in the quarterback slot regardless of rank", () => {
    // The QB ranks last here; index-zipping would have handed slot QB to a WR.
    const assigned = assignStarterSlots([
      p("WR", "wr1"),
      p("RB", "rb1"),
      p("QB", "qb1"),
    ]);
    expect(
      assigned.find((entry) => entry.slot === "QB")?.entry?.player.id,
    ).toBe("qb1");
  });

  it("leaves a slot open rather than filling it with an ineligible player", () => {
    const assigned = assignStarterSlots([p("WR", "wr1")]);
    expect(assigned.find((entry) => entry.slot === "QB")?.entry).toBeNull();
  });

  it("uses each player at most once", () => {
    const assigned = assignStarterSlots([p("RB", "rb1"), p("RB", "rb2")]);
    const ids = assigned
      .map((entry) => entry.entry?.player.id)
      .filter((id): id is string => id !== undefined);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("spills an eligible extra into FLEX", () => {
    const assigned = assignStarterSlots([
      p("RB", "rb1"),
      p("RB", "rb2"),
      p("RB", "rb3"),
    ]);
    expect(
      assigned.find((entry) => entry.slot === "FLEX")?.entry?.player.id,
    ).toBe("rb3");
  });
});
