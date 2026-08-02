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

  it("prefers the current-market quarterback over a later equivalent option", () => {
    const currentQuarterback = player(
      "current-qb",
      "Current Quarterback",
      "QB",
      "BAL",
      90,
    );
    const laterQuarterback = player(
      "later-qb",
      "Later Quarterback",
      "QB",
      "NE",
      1,
    );
    const state = liveState("drafting");
    state.context.currentPick = 41;
    state.context.currentRound = 5;
    state.context.nextUserPick = 60;
    state.format = {
      ...state.format,
      teams: 10,
      mode: "redraft",
      scoring: "standard",
      superflex: false,
      tightEndPremium: false,
      bestBall: false,
      idp: false,
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 },
    };
    state.players = [laterQuarterback, currentQuarterback];
    state.playerValues = {
      "current-qb": { adp: 40.6, projectedPoints: 320 },
      "later-qb": { adp: 49.6, projectedPoints: 320.8 },
    };

    expect(
      getLiveRecommendations(state, "balanced", 0.5, [])[0]!.player.id,
    ).toBe("current-qb");
  });

  it("excludes IDP players and defers a backup QB in a standard one-QB room", () => {
    const quarterback = player(
      "backup-qb",
      "Backup Quarterback",
      "QB",
      "CIN",
      1,
    );
    const receiver = player("starting-wr", "Starting Receiver", "WR", "TB", 2);
    const defender = player(
      "ineligible-dl",
      "Ineligible Defender",
      "DL",
      "DET",
      1,
    );
    const state = liveState("drafting");
    state.context.currentPick = 60;
    state.context.currentRound = 6;
    state.context.nextUserPick = 61;
    state.format = {
      ...state.format,
      teams: 10,
      mode: "redraft",
      scoring: "standard",
      superflex: false,
      twoQuarterback: false,
      tightEndPremium: false,
      bestBall: false,
      idp: false,
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 1, DEF: 1 },
    };
    state.picks = [
      {
        pickNumber: 41,
        round: 5,
        pickInRound: 1,
        playerId: "starter-qb",
        playerName: "Starter Quarterback",
        position: "QB",
        isKeeper: false,
        isUserPick: true,
      },
    ];
    state.players = [quarterback, receiver, defender];
    state.playerValues = {
      "backup-qb": { adp: 60, projectedPoints: 306 },
      "starting-wr": { adp: 60, projectedPoints: 140 },
    };

    const recommendations = getLiveRecommendations(state, "balanced", 0.5, []);

    expect(recommendations.map((entry) => entry.player.id)).not.toContain(
      "ineligible-dl",
    );
    expect(recommendations[0]!.player.id).toBe("starting-wr");
    expect(
      recommendations.find((entry) => entry.player.id === "backup-qb")
        ?.rosterFit,
    ).toBe("weak");
  });

  it("only recommends the missing defense when one final roster slot remains", () => {
    const state = liveState("drafting");
    state.context.currentPick = 141;
    state.context.currentRound = 15;
    delete state.context.nextUserPick;
    state.format = {
      ...state.format,
      teams: 10,
      draftRounds: 15,
      mode: "redraft",
      scoring: "standard",
      superflex: false,
      twoQuarterback: false,
      tightEndPremium: false,
      bestBall: false,
      idp: false,
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 1, DEF: 1 },
      bench: 5,
    };
    const positions = [
      "RB",
      "RB",
      "TE",
      "WR",
      "QB",
      "WR",
      "RB",
      "RB",
      "WR",
      "RB",
      "RB",
      "RB",
      "WR",
      "K",
    ] as const;
    state.picks = positions.map((position, index) => ({
      pickNumber: index % 2 === 0 ? index * 10 + 1 : (index + 1) * 10,
      round: index + 1,
      pickInRound: 1,
      playerId: `${position}-${index}`,
      playerName: `${position} ${index}`,
      position,
      isKeeper: false,
      isUserPick: true,
    }));
    state.players = [
      player("elite-wr", "Elite Receiver", "WR", "BUF", 1),
      player("remaining-defense", "Remaining Defense", "DEF", "LAR", 999),
    ];
    state.playerValues = {
      "elite-wr": { adp: 1, projectedPoints: 300 },
      "remaining-defense": { adp: 200, projectedPoints: 90 },
    };

    const recommendations = getLiveRecommendations(state, "balanced", 0.5, []);

    expect(recommendations.map((entry) => entry.player.id)).toEqual([
      "remaining-defense",
    ]);
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
