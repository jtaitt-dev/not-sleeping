import { describe, expect, it } from "vitest";

import {
  buildTradeCenterView,
  buildTradeScenario,
} from "@/features/season/trade-center";

import {
  tradeContext as context,
  tradePlayer as player,
  tradeSnapshot as snapshot,
} from "./fixtures/trade-center-fixture";

describe("selected-league trade center", () => {
  it("uses legal optimized lineups, actual capacity, and traded-pick ownership", () => {
    const view = buildTradeCenterView(context(), snapshot(), 2);

    expect(view).not.toBeNull();
    expect(view?.leagueId).toBe("trade-league");
    expect(view?.user.projectedStarterPoints).toBe(30);
    expect(view?.selectedPartner.projectedStarterPoints).toBe(22);
    expect(view?.user).toMatchObject({
      teamName: "Night Shift",
      ownerName: "Joshua",
      playerCount: 3,
      totalCapacity: 4,
      openSpots: 1,
    });
    expect(
      view?.user.assets.find((asset) => asset.id === "pick:2026:1:2"),
    ).toMatchObject({
      kind: "pick",
      label: "2026 1st Rd - 1.02",
      detail: "via Trade Partner",
      ownerRosterId: 1,
    });
    expect(
      view?.selectedPartner.assets.some(
        (asset) => asset.id === "pick:2026:1:2",
      ),
    ).toBe(false);
    expect(view?.projectionCoverageLabel).toBe(
      "0 league-scored · 6 imported fallback · 0 rank proxy across 6 rostered players",
    );

    const scenario = buildTradeScenario(
      context(),
      snapshot(),
      2,
      ["player:user-wr"],
      ["player:partner-te"],
    );

    expect(scenario).not.toBeNull();
    expect(scenario).toMatchObject({
      userBefore: 30,
      userAfter: 24,
      partnerBefore: 22,
      partnerAfter: 28,
      userOpenSpotsAfter: 1,
      partnerOpenSpotsAfter: 1,
    });
    expect(scenario?.analysis.parties).toEqual([
      expect.objectContaining({
        rosterId: 1,
        teamName: "Night Shift",
        weeklyPointsChange: -6,
        rosterSpaceIssue: false,
      }),
      expect.objectContaining({
        rosterId: 2,
        teamName: "Trade Partner",
        weeklyPointsChange: 6,
        rosterSpaceIssue: false,
      }),
    ]);
    expect(
      scenario?.analysis.parties.some(
        (party) => party.weeklyPointsChange === 100 || party.netValue === 100,
      ),
    ).toBe(false);
  });

  it("reports a legal-cut requirement from configured roster capacity", () => {
    const overfull = snapshot();
    overfull.rosters[1]?.players?.push("partner-extra");
    overfull.players.push(player("partner-extra", "Extra Receiver", "WR", 85));
    overfull.projections.push({
      player_id: "partner-extra",
      stats: { pts_ppr: 85 },
    });

    const scenario = buildTradeScenario(
      context(),
      overfull,
      2,
      [],
      ["player:partner-extra"],
    );

    expect(scenario?.userOpenSpotsAfter).toBe(0);
    expect(scenario?.partnerOpenSpotsAfter).toBe(1);
    expect(scenario?.analysis.parties[0]?.rosterSpaceIssue).toBe(false);

    const twoForZero = buildTradeScenario(
      context(),
      overfull,
      2,
      [],
      ["player:partner-extra", "player:partner-te"],
    );
    expect(twoForZero?.userOpenSpotsAfter).toBe(-1);
    expect(twoForZero?.analysis.parties[0]?.rosterSpaceIssue).toBe(true);
    expect(twoForZero?.analysis.conditions).toContain(
      "At least one roster must make an additional legal cut.",
    );
  });

  it("rejects stale snapshots from any other league or user", () => {
    expect(
      buildTradeCenterView(
        { ...context(), leagueId: "different-league" },
        snapshot(),
        2,
      ),
    ).toBeNull();
    expect(
      buildTradeCenterView(
        { ...context(), userId: "different-user" },
        snapshot(),
        2,
      ),
    ).toBeNull();
    const mismatchedLeague = snapshot();
    mismatchedLeague.league.league_id = "different-league";
    expect(buildTradeCenterView(context(), mismatchedLeague, 2)).toBeNull();
  });

  it("does not offer already-spent current-season picks after the draft", () => {
    const completed = snapshot();
    const draft = completed.drafts[0];
    if (draft) draft.status = "complete";

    const view = buildTradeCenterView(context(), completed, 2);

    expect(
      view?.user.assets.some(
        (asset) => asset.kind === "pick" && asset.label.startsWith("2026"),
      ),
    ).toBe(false);
    expect(
      view?.user.assets.some(
        (asset) => asset.kind === "pick" && asset.label.startsWith("2027"),
      ),
    ).toBe(true);
  });
});
