import { describe, expect, it } from "vitest";

import { todayDecisions } from "@/features/season/full-season-workspaces";

import { tradeContext, tradeSnapshot } from "./fixtures/trade-center-fixture";

describe("Today decision provenance", () => {
  it("shows only decisions supported by the selected league snapshot", () => {
    const decisions = todayDecisions(tradeContext(), tradeSnapshot());

    expect(decisions.map((decision) => decision.id)).toEqual([
      "lineup",
      "draft",
    ]);
    expect(decisions.map((decision) => decision.id)).not.toEqual(
      expect.arrayContaining(["weather", "research", "taxi", "waiver"]),
    );
    expect(decisions.every((decision) => decision.evidence.length === 1)).toBe(
      true,
    );
    expect(decisions[0]).toMatchObject({
      provenance: "Local check",
      decision: "3/3 starters assigned",
      evidence: [
        {
          publisher: "Sleeper public API",
          nature: "fact",
          url: "https://api.sleeper.app/v1/league/trade-league/rosters",
        },
      ],
    });
    expect(decisions[1]).toMatchObject({
      provenance: "Sleeper",
      decision: "pre draft · snake",
      evidence: [
        {
          claimType: "draft_status",
          url: "https://api.sleeper.app/v1/draft/rookie-draft",
        },
      ],
    });
  });

  it("does not invent manual actions for a healthy best-ball roster", () => {
    const context = { ...tradeContext(), lineupType: "best_ball" as const };
    const snapshot = tradeSnapshot();
    snapshot.drafts[0] = { ...snapshot.drafts[0]!, status: "complete" };

    expect(todayDecisions(context, snapshot)).toEqual([]);
  });

  it("adds injury and waiver cards only when Sleeper reports those states", () => {
    const context = tradeContext();
    const snapshot = tradeSnapshot();
    snapshot.players[1] = {
      ...snapshot.players[1]!,
      status: "injured",
      injuryStatus: "Out",
    };
    snapshot.transactions.push({
      transaction_id: "pending-waiver",
      type: "waiver",
      status: "pending",
      creator: context.userId,
      roster_ids: [context.rosterId!],
      consenter_ids: [],
      adds: { "partner-rb": context.rosterId! },
      drops: null,
      draft_picks: [],
      waiver_budget: [],
      settings: {},
      metadata: {},
    });

    const decisions = todayDecisions(context, snapshot);
    expect(decisions.map((decision) => decision.id)).toEqual([
      "lineup",
      "news",
      "waiver",
      "draft",
    ]);
    expect(decisions.find((decision) => decision.id === "news")).toMatchObject({
      provenance: "Sleeper",
      tone: "danger",
      evidence: [
        {
          claimType: "player_status",
          playerIds: ["user-rb"],
        },
      ],
    });
    expect(
      decisions.find((decision) => decision.id === "waiver"),
    ).toMatchObject({
      decision: "1 claim pending",
      pending: "1 submitted",
      evidence: [
        {
          claimType: "waiver_transaction",
          url: "https://api.sleeper.app/v1/league/trade-league/transactions/1",
        },
      ],
    });
  });

  it("never shows pending-waiver guidance when the league disables waivers", () => {
    const context = { ...tradeContext(), waiverType: "disabled" as const };
    const snapshot = tradeSnapshot();
    snapshot.transactions.push({
      transaction_id: "impossible-pending-waiver",
      type: "waiver",
      status: "pending",
      creator: context.userId,
      roster_ids: [context.rosterId!],
      consenter_ids: [],
      adds: null,
      drops: null,
      draft_picks: [],
      waiver_budget: [],
      settings: {},
      metadata: {},
    });

    expect(
      todayDecisions(context, snapshot).map((decision) => decision.id),
    ).toEqual(["lineup", "draft"]);
  });
});
