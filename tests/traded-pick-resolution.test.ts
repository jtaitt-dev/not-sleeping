import { sleeperDraftSchema, sleeperTradedPickSchema } from "@/schemas/sleeper";
import { ownedDraftPicks } from "@/services/draft/draft-order";
import { resolveLiveDraftTradedPicks } from "@/services/draft/traded-pick-resolution";
import { describe, expect, it } from "vitest";

const draft = sleeperDraftSchema.parse({
  draft_id: "big-bucks-league-mock",
  league_id: null,
  type: "linear",
  status: "drafting",
  season: "2026",
  settings: { teams: 16, rounds: 3 },
  metadata: { league_id: "big-bucks", type: "league_mock" },
  draft_order: { "fixture-user": 10 },
  slot_to_roster_id: Object.fromEntries(
    Array.from({ length: 16 }, (_, index) => [String(index + 1), index + 1]),
  ),
});

describe("live traded-pick resolution", () => {
  it("uses source-league trades when a league mock endpoint is empty", () => {
    const sourceTrade = sleeperTradedPickSchema.parse({
      season: "2026",
      round: 2,
      roster_id: 10,
      previous_owner_id: 10,
      owner_id: 7,
    });
    const tradedPicks = resolveLiveDraftTradedPicks({
      draft,
      draftTradedPicks: [],
      leagueTradedPicks: [sourceTrade],
    });

    expect(
      ownedDraftPicks({
        draft,
        tradedPicks,
        teams: 16,
        rounds: 3,
        userId: "fixture-user",
        rosterId: 8,
      }).picks,
    ).toEqual([10, 42]);
  });

  it("prefers draft-scoped ownership and ignores another season", () => {
    const leaguePick = sleeperTradedPickSchema.parse({
      season: "2026",
      round: 2,
      roster_id: 10,
      previous_owner_id: 10,
      owner_id: 7,
    });
    const draftPick = sleeperTradedPickSchema.parse({
      ...leaguePick,
      owner_id: 12,
    });
    const futurePick = sleeperTradedPickSchema.parse({
      ...leaguePick,
      season: "2027",
    });

    expect(
      resolveLiveDraftTradedPicks({
        draft,
        draftTradedPicks: [draftPick],
        leagueTradedPicks: [leaguePick, futurePick],
      }),
    ).toEqual([draftPick]);
  });
});
