import { describe, expect, it } from "vitest";

import {
  isIdpPosition,
  isPlayerEligibleForAnyRosterSlot,
  isPlayerEligibleForRosterSlot,
  normalizeSleeperPosition,
} from "@/services/roster/position-eligibility";

describe("Sleeper position eligibility", () => {
  it.each([
    ["FLEX", ["RB"]],
    ["FLEX", ["WR"]],
    ["SUPER_FLEX", ["QB"]],
    ["REC_FLEX", ["TE"]],
    ["DL", ["DE"]],
    ["DL", ["DT"]],
    ["LB", ["EDGE"]],
    ["DB", ["CB"]],
    ["DB", ["S"]],
    ["IDP_FLEX", ["ILB"]],
    ["DEF_FLEX", ["FS"]],
  ])("allows %s for %s", (slot, positions) => {
    expect(isPlayerEligibleForRosterSlot(slot, positions)).toBe(true);
  });

  it("rejects illegal cross-family assignments", () => {
    expect(isPlayerEligibleForRosterSlot("QB", ["WR"])).toBe(false);
    expect(isPlayerEligibleForRosterSlot("IDP_FLEX", ["RB"])).toBe(false);
    expect(isPlayerEligibleForRosterSlot("FLEX", ["LB"])).toBe(false);
    expect(isPlayerEligibleForAnyRosterSlot(["QB", "RB"], ["CB"])).toBe(false);
  });

  it("normalizes Sleeper aliases without overwriting legal eligibility", () => {
    expect(normalizeSleeperPosition("dst")).toBe("DEF");
    expect(normalizeSleeperPosition("nt")).toBe("DL");
    expect(isIdpPosition("EDGE")).toBe(true);
    expect(isIdpPosition("WR")).toBe(false);
  });
});
