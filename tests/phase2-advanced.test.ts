import { describe, expect, it } from "vitest";

import type { SleeperLeague } from "@/schemas/sleeper";
import {
  analyzeDispersalPool,
  analyzeOrphanRoster,
} from "@/services/dynasty/dynasty-service";
import {
  effectiveFreshnessPolicies,
  parseFreshnessOverrides,
} from "@/services/freshness/freshness-settings";
import { createLeagueContext } from "@/services/league/league-context";
import { projectMatchup } from "@/services/matchups/matchup-model";
import {
  decideResearchRefresh,
  groupResearchBatches,
} from "@/services/research/refresh-strategy";
import {
  calibrateLeagueTradeMarket,
  findTradeTargets,
  type TradeAsset,
} from "@/services/trades/trade-service";

describe("transparent matchup model", () => {
  it("produces bounded probabilities, distributions, comparisons, and fragile assumptions", () => {
    const user = {
      rosterId: 1,
      name: "User",
      currentPoints: 40,
      starters: [
        player("qb", "QB", 24, 12, "BUF"),
        player("wr", "WR", 18, 4, "BUF", "questionable"),
      ],
    };
    const opponent = {
      rosterId: 2,
      name: "Opponent",
      currentPoints: 38,
      starters: [
        player("qb2", "QB", 21, 10, "KC"),
        player("wr2", "WR", null, 7, "KC"),
      ],
    };
    const result = projectMatchup({
      user,
      opponent,
      leagueTeams: [user, opponent],
    });
    expect(result.headToHeadWinProbability).toBeGreaterThan(0);
    expect(result.headToHeadWinProbability).toBeLessThan(1);
    expect(result.user.floor).toBeLessThan(result.user.ceiling);
    expect(result.user.correlationPairs).toBe(1);
    expect(result.positionComparisons.map((entry) => entry.position)).toEqual(
      expect.arrayContaining(["QB", "WR"]),
    );
    expect(result.fragileAssumptions.join(" ")).toMatch(/projection|Injury/);
  });

  it("supports a week with no assigned opponent", () => {
    const result = projectMatchup({
      user: {
        rosterId: 1,
        name: "Bye",
        currentPoints: 0,
        starters: [],
      },
      opponent: null,
    });
    expect(result.headToHeadWinProbability).toBeNull();
    expect(result.fragileAssumptions.join(" ")).toMatch(/No head-to-head/);
  });
});

describe("trade finder and league market calibration", () => {
  it("finds a reciprocal surplus-for-need offer without protected cornerstone assets", () => {
    const context = createLeagueContext({
      league: league(),
      userId: "user",
      week: 8,
    });
    const userAssets = [
      asset("qb", "QB", 95),
      asset("te", "TE", 90),
      asset("rb1", "RB", 85),
      asset("rb2", "RB", 70),
      asset("rb3", "RB", 50),
    ];
    const opponentAssets = [
      asset("oqb", "QB", 95),
      asset("ote", "TE", 90),
      asset("wr1", "WR", 70),
      asset("wr2", "WR", 55),
      asset("wr3", "WR", 50),
    ];
    const targets = findTradeTargets({
      context,
      user: { rosterId: 1, teamName: "User", assets: userAssets },
      opponents: [{ rosterId: 2, teamName: "Partner", assets: opponentAssets }],
      fairnessBand: 0.5,
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.send[0]?.position).toBe("RB");
    expect(targets[0]?.receive[0]?.position).toBe("WR");
    expect(targets[0]?.assetsNotToInclude).toEqual(
      expect.arrayContaining(["qb", "te"]),
    );
  });

  it("does not invent manager tendencies from a tiny trade sample", () => {
    const market = calibrateLeagueTradeMarket([
      {
        transaction_id: "trade-1",
        type: "trade",
        status: "complete",
        roster_ids: [1, 2],
        consenter_ids: [1, 2],
        adds: { p1: 1, p2: 2 },
        drops: {},
        draft_picks: [],
        waiver_budget: [],
        settings: {},
        metadata: {},
      },
    ]);
    expect(market.activity).toBe("insufficient_data");
    expect(market.completedTrades).toBe(1);
  });
});

describe("dynasty takeover and dispersal scenarios", () => {
  it("keeps orphan and dispersal outputs bounded and explicitly manual", () => {
    const assets = [
      {
        id: "young",
        label: "Young Player",
        type: "player" as const,
        position: "WR",
        marketValue: 88,
        productionValue: 70,
        age: 23,
      },
      {
        id: "pick",
        label: "2027 round 1",
        type: "pick" as const,
        marketValue: 80,
        productionValue: 45,
      },
    ];
    const orphan = analyzeOrphanRoster({
      assets,
      requiredRosterSize: 4,
      futurePickYears: 2,
    });
    expect(orphan.immediateCompetitiveness).toBeGreaterThanOrEqual(0);
    expect(orphan.futureFlexibility).toBeLessThanOrEqual(100);
    expect(orphan.noWriteBoundary).toMatch(/manual/);
    const dispersal = analyzeDispersalPool({ assets, teamCount: 3 });
    expect(dispersal.assetsPerTeam).toBe(0.67);
    expect(dispersal.warnings.length).toBeGreaterThan(0);
  });
});

describe("cost-aware research and configurable freshness", () => {
  it("refreshes material events, denies polling and fresh-cache duplication, and batches by league/week", () => {
    const allowed = decideResearchRefresh({
      trigger: "starter_ruled_out",
      automaticResearchEnabled: true,
      hasEquivalentFreshResearch: false,
      budgetRemaining: true,
      cacheKey: "player:p1",
      leagueId: "league",
      week: 9,
    });
    const poll = decideResearchRefresh({
      trigger: "poll_cycle",
      automaticResearchEnabled: true,
      hasEquivalentFreshResearch: false,
      budgetRemaining: true,
      cacheKey: "player:p1",
      leagueId: "league",
      week: 9,
    });
    const cached = decideResearchRefresh({
      trigger: "trade_stale_player",
      automaticResearchEnabled: true,
      hasEquivalentFreshResearch: true,
      budgetRemaining: true,
      cacheKey: "player:p1",
      leagueId: "league",
      week: 9,
    });
    expect(allowed.refresh).toBe(true);
    expect(allowed.estimatedOutputTokens).toBeGreaterThan(0);
    expect(poll.refresh).toBe(false);
    expect(cached.refresh).toBe(false);
    expect(groupResearchBatches([allowed, poll, cached])).toHaveLength(1);
  });

  it("sanitizes per-domain freshness overrides and applies them", () => {
    const overrides = parseFreshnessOverrides({
      matchup: 12_000,
      draft_picks: -1,
      historical_data: 4_000,
      bogus: 5_000,
    });
    expect(overrides).toEqual({ matchup: 12_000, draft_picks: 1_000 });
    const policies = effectiveFreshnessPolicies(overrides);
    expect(policies.matchup.ttlMs).toBe(12_000);
    expect(policies.historical_data.ttlMs).toBeNull();
  });
});

function player(
  playerId: string,
  position: string,
  projectedPoints: number | null,
  currentPoints: number,
  team: string,
  status?: string,
) {
  return {
    playerId,
    name: playerId,
    position,
    team,
    projectedPoints,
    currentPoints,
    ...(status ? { status } : {}),
  };
}

function asset(id: string, position: string, value: number): TradeAsset {
  return {
    id,
    label: id,
    type: "player",
    position,
    marketValue: value,
    productionValue: value,
    dynastyValue: value,
  };
}

function league(): SleeperLeague {
  return {
    league_id: "league",
    name: "League",
    season: "2026",
    sport: "nfl",
    settings: { type: 2, waiver_type: 2 },
    scoring_settings: { rec: 1 },
    roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
  };
}
