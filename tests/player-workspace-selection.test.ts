import { describe, expect, it } from "vitest";

import { resolvePlayerSelection } from "@/features/workspaces/all-workspaces";
import type { Player } from "@/types/domain";

function player(id: string): Player {
  return {
    id,
    firstName: id,
    lastName: "Player",
    fullName: `${id} Player`,
    normalizedName: `${id} player`,
    position: "WR",
    status: "active",
    fantasyPositions: ["WR"],
  };
}

describe("player workspace selection", () => {
  it("retains the selected player while that player remains filtered in", () => {
    const current = player("current");
    expect(resolvePlayerSelection(current, [player("first"), current])).toBe(
      current,
    );
  });

  it("selects the first visible result when the previous player is filtered out", () => {
    const first = player("first");
    expect(resolvePlayerSelection(player("old"), [first, player("next")])).toBe(
      first,
    );
  });

  it("clears the detail view when no results remain", () => {
    expect(resolvePlayerSelection(player("old"), [])).toBeNull();
  });
});
