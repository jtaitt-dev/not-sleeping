import { describe, expect, it } from "vitest";

import { sleeperDraftSchema, sleeperTradedPickSchema } from "@/schemas/sleeper";
import {
  draftSlotForPick,
  nextOwnedPick,
  ownedDraftPicks,
} from "@/services/draft/draft-order";

describe("live draft ownership and order", () => {
  it("maps snake, linear, and third-round-reversal coordinates", () => {
    expect(draftSlotForPick(13, 12, "snake")).toBe(12);
    expect(draftSlotForPick(13, 12, "linear")).toBe(1);
    expect(draftSlotForPick(25, 12, "third_round_reversal")).toBe(12);
    expect(draftSlotForPick(37, 12, "third_round_reversal")).toBe(1);
  });

  it("uses traded-pick ownership to find the next actual Big Bucks pick", () => {
    const draft = sleeperDraftSchema.parse({
      draft_id: "big-bucks-rookie-2026",
      league_id: "big-bucks",
      type: "linear",
      status: "drafting",
      season: "2026",
      settings: { teams: 4, rounds: 3 },
      metadata: {},
      draft_order: { user1: 1, user2: 2, user3: 3, user4: 4 },
      slot_to_roster_id: { "1": 1, "2": 2, "3": 3, "4": 4 },
    });
    const tradedPicks = [
      sleeperTradedPickSchema.parse({
        season: "2026",
        round: 2,
        roster_id: 3,
        previous_owner_id: 3,
        owner_id: 1,
      }),
    ];

    const result = ownedDraftPicks({
      draft,
      tradedPicks,
      teams: 4,
      rounds: 3,
      userId: "user1",
      rosterId: 1,
    });

    expect(result).toEqual({ style: "linear", picks: [1, 5, 7, 9] });
    expect(nextOwnedPick(result.picks, 6)).toBe(7);
  });

  it("prefers the draft slot mapping when a league mock renumbers rosters", () => {
    const draft = sleeperDraftSchema.parse({
      draft_id: "big-bucks-league-mock",
      league_id: "big-bucks",
      type: "linear",
      status: "pre_draft",
      season: "2026",
      settings: { teams: 16, rounds: 3 },
      metadata: { type: "league_mock" },
      draft_order: { "fixture-user": 10 },
      slot_to_roster_id: Object.fromEntries(
        Array.from({ length: 16 }, (_, index) => [
          String(index + 1),
          index + 1,
        ]),
      ),
    });

    const result = ownedDraftPicks({
      draft,
      teams: 16,
      rounds: 3,
      userId: "fixture-user",
      // This is the source-league roster ID, not this mock's roster ID.
      rosterId: 8,
    });

    expect(result).toEqual({ style: "linear", picks: [10, 26, 42] });
    expect(nextOwnedPick(result.picks, 1)).toBe(10);
  });
});
