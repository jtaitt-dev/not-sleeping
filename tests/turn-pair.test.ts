import { describe, expect, it } from "vitest";

import { optimizeTurnPair } from "@/services/draft/turn-pair";
import { getActiveFixture, getRecommendations } from "@/stores/app-store";

describe("turn-pick pair optimization", () => {
  it("optimizes consecutive traded picks as a two-player plan", () => {
    const fixture = getActiveFixture("big-bucks");
    const recommendations = getRecommendations(
      "big-bucks",
      0,
      "balanced",
      0.5,
      [],
    );
    const plan = optimizeTurnPair(recommendations, {
      ...fixture.context,
      currentPick: 10,
      nextUserPick: 10,
      ownedPickNumbers: [10, 11, 26],
      isUserOnClock: true,
    });

    expect(plan).not.toBeNull();
    expect(plan).toMatchObject({
      firstPickNumber: 10,
      secondPickNumber: 11,
    });
    expect(plan?.pickBOptions.length).toBeGreaterThanOrEqual(1);
    expect(plan?.pickBOptions.map((entry) => entry.player.id)).not.toContain(
      plan?.pickA.player.id,
    );
  });

  it("does not show a pair plan when owned picks are far apart or auctioned", () => {
    const fixture = getActiveFixture("big-bucks");
    const recommendations = getRecommendations(
      "big-bucks",
      0,
      "balanced",
      0.5,
      [],
    );
    expect(
      optimizeTurnPair(recommendations, {
        ...fixture.context,
        currentPick: 10,
        ownedPickNumbers: [10, 26],
      }),
    ).toBeNull();
    expect(
      optimizeTurnPair(recommendations, {
        ...fixture.context,
        currentPick: 10,
        draftStyle: "auction",
        ownedPickNumbers: [10, 11],
      }),
    ).toBeNull();
  });
});
