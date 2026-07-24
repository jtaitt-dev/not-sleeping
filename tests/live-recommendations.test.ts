import { describe, expect, it } from "vitest";

import { getLiveRecommendations } from "@/stores/app-store";
import type { LiveDraftState, Player } from "@/types/domain";

const activeDefender = player("defender", "Active Defender", "DL", "DET", 20);
const retiredFreeAgent = player("retired", "Retired Star", "RB", undefined, 1);

describe("live recommendations", () => {
  it("excludes teamless players and prioritizes an unfilled IDP starter", () => {
    const recommendations = getLiveRecommendations(
      liveState("drafting"),
      "balanced",
      0.5,
      [],
    );

    expect(recommendations.map((entry) => entry.player.id)).toEqual([
      "defender",
    ]);
    expect(recommendations[0]!.rosterFit).toBe("strong");
  });

  it("returns no actionable recommendations after draft completion", () => {
    expect(
      getLiveRecommendations(liveState("complete"), "balanced", 0.5, []),
    ).toEqual([]);
  });
});

function liveState(
  status: LiveDraftState["context"]["status"],
): LiveDraftState {
  return {
    context: {
      supported: true,
      source: "sleeper",
      mode: "best_ball",
      modeConfidence: 1,
      modeEvidence: ["Best ball setting is enabled"],
      currentPick: 1,
      currentRound: 1,
      status,
      lastUpdatedAt: 1,
      connected: true,
    },
    format: {
      teams: 12,
      mode: "best_ball",
      scoring: "ppr",
      superflex: true,
      twoQuarterback: false,
      tightEndPremium: true,
      pointsPerFirstDown: false,
      bestBall: true,
      idp: true,
      starters: { QB: 1, DL: 2, LB: 3, DB: 2, IDP_FLEX: 1 },
      bench: 11,
      taxi: 0,
      injuredReserve: 0,
    },
    picks: [],
    players: [retiredFreeAgent, activeDefender],
    fetchedAt: 1,
    playerIndexStale: false,
  };
}

function player(
  id: string,
  fullName: string,
  position: Player["position"],
  team: string | undefined,
  searchRank: number,
): Player {
  const [firstName = "", lastName = ""] = fullName.split(" ");
  return {
    id,
    sleeperId: id,
    firstName,
    lastName,
    fullName,
    normalizedName: fullName.toLowerCase().replaceAll(" ", ""),
    position,
    ...(team ? { team } : {}),
    status: "active",
    searchRank,
    fantasyPositions: [position],
  };
}
