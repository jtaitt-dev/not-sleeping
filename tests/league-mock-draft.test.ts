import { describe, expect, it } from "vitest";

import {
  sleeperDraftSchema,
  sleeperLeagueSchema,
  sleeperLeagueUserSchema,
  sleeperRosterSchema,
  sleeperTradedPickSchema,
} from "@/schemas/sleeper";
import {
  MockDraftSession,
  assertDraftInvariants,
  type DraftEnginePlayer,
} from "@/services/draft/draft-engine";
import {
  buildLeagueMockDraftPlan,
  pickNumberForDraftSlot,
} from "@/services/draft/league-mock-config";
import {
  MOCK_DRAFT_STORAGE_PREFIX,
  loadMockDraft,
  mockDraftPlanFingerprint,
  mockDraftStorageKey,
  saveMockDraft,
} from "@/services/draft/mock-draft-storage";

const users = Array.from({ length: 16 }, (_, index) =>
  sleeperLeagueUserSchema.parse({
    user_id: `user-${index + 1}`,
    username: `manager-${index + 1}`,
    display_name: `Manager ${index + 1}`,
    metadata: { team_name: `Team ${index + 1}` },
  }),
);
const rosters = users.map((user, index) =>
  sleeperRosterSchema.parse({
    roster_id: index + 1,
    owner_id: user.user_id,
    league_id: "big-bucks",
    players: index === 0 ? ["already-owned-rookie"] : [],
    starters: [],
    reserve: [],
    taxi: [],
    settings: {},
  }),
);
const draftOrder = Object.fromEntries(
  users.map((user, index) => [
    user.user_id,
    index === 7 ? 10 : index === 9 ? 5 : index + 1,
  ]),
);
// Keep the fixture a bijection after swapping roster 8 and roster 10.
draftOrder["user-5"] = 8;

const league = sleeperLeagueSchema.parse({
  league_id: "big-bucks",
  name: "Big Bucks",
  season: "2026",
  sport: "nfl",
  status: "pre_draft",
  total_rosters: 16,
  roster_positions: [
    "QB",
    "RB",
    "RB",
    "WR",
    "WR",
    "TE",
    "FLEX",
    "FLEX",
    "K",
    "DEF",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "TAXI",
    "TAXI",
  ],
  settings: { type: 2, taxi_slots: 2, position_limit_qb: 4 },
  scoring_settings: { rec: 0, pass_td: 4 },
});
const draft = sleeperDraftSchema.parse({
  draft_id: "big-bucks-rookie-2026",
  league_id: "big-bucks",
  type: "linear",
  status: "pre_draft",
  season: "2026",
  settings: { teams: 16, rounds: 3, player_type: 1 },
  metadata: { name: "Big Bucks" },
  draft_order: draftOrder,
});
const tradedPicks = [
  sleeperTradedPickSchema.parse({
    season: "2026",
    round: 2,
    roster_id: 8,
    previous_owner_id: 8,
    owner_id: 10,
  }),
];

describe("league-derived local mock drafts", () => {
  it("uses verified rookie, order, owner, roster, and position-limit data", () => {
    const plan = buildLeagueMockDraftPlan({
      league,
      draft,
      rosters,
      users,
      tradedPicks,
      userId: "user-8",
    });

    expect(plan).toMatchObject({
      source: "verified_sleeper",
      draftOrderAssigned: true,
      userSlotSource: "sleeper_draft_order",
    });
    expect(plan.config).toMatchObject({
      leagueType: "dynasty",
      teams: 16,
      rounds: 3,
      style: "linear",
      playerPool: "rookies_only",
      userSlot: 10,
      manualAllTeams: true,
      positionLimits: { QB: 4 },
    });
    expect(plan.config.unavailablePlayerIds).toContain("already-owned-rookie");
    expect(plan.pickOwnership[0]).toMatchObject({
      pickNumber: 26,
      originalRosterId: 8,
      currentRosterId: 10,
      originalDraftSlot: 10,
      currentOwnerSlot: 5,
    });
    expect(plan.config.tradedPickOwners?.[26]).toBe(5);
  });

  it("does not invent traded-pick placement before Sleeper assigns the order", () => {
    const plan = buildLeagueMockDraftPlan({
      league,
      draft: sleeperDraftSchema.parse({ ...draft, draft_order: null }),
      rosters,
      users,
      tradedPicks,
      userId: "user-8",
      userSlotOverride: 7,
    });
    expect(plan.draftOrderAssigned).toBe(false);
    expect(plan.userSlotSource).toBe("local_choice_required");
    expect(plan.config.userSlot).toBe(7);
    expect(plan.config.tradedPickOwners).toEqual({});
    expect(plan.pickOwnership[0]).toMatchObject({
      originalDraftSlot: null,
      currentOwnerSlot: null,
      pickNumber: 0,
    });
    expect(plan.warnings.join(" ")).toContain("not assigned");
  });

  it("records every manual entry without an autopick and restores valid state", () => {
    const plan = buildLeagueMockDraftPlan({
      league,
      draft,
      rosters,
      users,
      tradedPicks,
      userId: "user-8",
    });
    const players = rookiePlayers(60);
    const session = new MockDraftSession(plan.config, players);
    expect(session.start().picks).toHaveLength(0);
    const afterOne = session.makePick("rookie-1");
    expect(afterOne.picks).toHaveLength(1);
    expect(afterOne.picks[0]).toMatchObject({
      pickNumber: 1,
      playerId: "rookie-1",
    });
    expect(afterOne.currentPick).toBe(2);
    expect(assertDraftInvariants(plan.config, afterOne, players).passed).toBe(
      true,
    );

    const restored = MockDraftSession.restore(plan.config, players, afterOne);
    expect(restored.snapshot()).toEqual(afterOne);
    expect(restored.makePick("rookie-2").picks).toHaveLength(2);
  });

  it("maps snake and third-round-reversal slots to exact overall picks", () => {
    expect(pickNumberForDraftSlot("snake", 12, 2, 1)).toBe(24);
    expect(pickNumberForDraftSlot("third_round_reversal", 12, 3, 1)).toBe(36);
    expect(pickNumberForDraftSlot("third_round_reversal", 12, 4, 1)).toBe(37);
  });

  it("uses an account/league/draft namespace and validates persisted state", async () => {
    const plan = buildLeagueMockDraftPlan({
      league,
      draft,
      rosters,
      users,
      tradedPicks,
      userId: "user-8",
    });
    const players = rookiePlayers(60);
    const session = new MockDraftSession(plan.config, players);
    session.start();
    const state = session.makePick("rookie-1");
    const identity = {
      accountId: "user-8",
      leagueId: plan.leagueId,
      draftId: plan.draftId,
    };
    const fingerprint = mockDraftPlanFingerprint(plan.config);
    const saved = await saveMockDraft({
      ...identity,
      planFingerprint: fingerprint,
      state,
      now: 1_000,
    });
    const key = mockDraftStorageKey(identity);
    expect(key).toContain(MOCK_DRAFT_STORAGE_PREFIX);
    expect(key).toContain("6.user-8:9.big-bucks:21.big-bucks-rookie-2026");
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ [key]: saved });

    const storageGet = chrome.storage.local.get as unknown as {
      mockResolvedValueOnce(value: Record<string, unknown>): void;
    };
    storageGet.mockResolvedValueOnce({ [key]: saved });
    await expect(
      loadMockDraft({ ...identity, planFingerprint: fingerprint }),
    ).resolves.toEqual(saved);
    storageGet.mockResolvedValueOnce({ [key]: saved });
    await expect(
      loadMockDraft({ ...identity, planFingerprint: "changed" }),
    ).resolves.toBeNull();
    expect(
      mockDraftStorageKey({
        accountId: "a:b",
        leagueId: "league",
        draftId: "draft",
      }),
    ).not.toBe(
      mockDraftStorageKey({
        accountId: "a/b",
        leagueId: "league",
        draftId: "draft",
      }),
    );
    storageGet.mockResolvedValueOnce({
      [key]: { ...saved, accountId: "different-account" },
    });
    await expect(
      loadMockDraft({ ...identity, planFingerprint: fingerprint }),
    ).resolves.toBeNull();
  });
});

function rookiePlayers(count: number): DraftEnginePlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `rookie-${index + 1}`,
    name: `Rookie ${index + 1}`,
    positions: index % 4 === 0 ? ["QB"] : index % 3 === 0 ? ["RB"] : ["WR"],
    team: "FA",
    adp: index + 1,
    tier: Math.floor(index / 12) + 1,
    redraftValue: 100 - index,
    dynastyValue: 100 - index / 2,
    contenderValue: 90 - index,
    rookie: true,
    age: 21,
  }));
}
