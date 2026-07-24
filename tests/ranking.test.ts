import { describe, expect, it } from "vitest";

import { DEMO_FIXTURES, DEMO_PLAYERS } from "@/services/demo/fixtures";
import {
  isIdentityMatchCertain,
  matchPlayerIdentity,
  normalizePlayerName,
} from "@/services/ranking/identity";
import {
  detectDraftMode,
  detectLeagueFormat,
} from "@/services/ranking/mode-detection";
import { resolveRookieEligibility } from "@/services/ranking/rookie-eligibility";
import { evaluateTrade, type TradeAsset } from "@/services/ranking/trade";
import {
  calculatePlayerScore,
  calculateReplacementLevels,
  deriveRosterNeeds,
  detectPositionRun,
  estimateAvailability,
  generateTiers,
  rankPlayers,
} from "@/services/ranking/valuation";

describe("draft mode and league format", () => {
  it.each([
    [{ leagueType: 0 }, "redraft"],
    [{ leagueType: 2, taxiSlots: 3 }, "dynasty_startup"],
    [
      { leagueType: 2, playerPool: ["rookies"], existingOwnedPlayerCount: 30 },
      "dynasty_rookie",
    ],
    [{ draftType: "keeper", keepers: ["1"] }, "keeper"],
    [{ leagueSettings: { best_ball: true } }, "best_ball"],
  ])("detects %s as %s", (input, expected) => {
    expect(detectDraftMode(input).mode).toBe(expected);
  });

  it("honors manual overrides and reports ambiguous metadata", () => {
    expect(detectDraftMode({ manualOverride: "keeper" })).toEqual({
      mode: "keeper",
      confidence: 1,
      evidence: ["Manual override"],
      warnings: [],
    });
    expect(detectDraftMode({}).warnings[0]).toContain("insufficient");
    expect(
      detectDraftMode({
        leagueType: 0,
        leagueSettings: { best_ball: true },
      }).warnings,
    ).toHaveLength(0);
  });

  it("derives superflex, TEP, IDP, bench, taxi, and scoring", () => {
    const format = detectLeagueFormat({
      leagueType: 2,
      rosterPositions: [
        "QB",
        "QB",
        "RB",
        "WR",
        "TE",
        "SUPER_FLEX",
        "DL",
        "LB",
        "DB",
        "BN",
        "BN",
        "TAXI",
        "IR",
      ],
      scoringSettings: { rec: 1, bonus_rec_te: 0.5, pass_fd: 0.2 },
      leagueSettings: { num_teams: 10 },
    });
    expect(format).toMatchObject({
      teams: 10,
      scoring: "ppr",
      superflex: true,
      twoQuarterback: true,
      tightEndPremium: true,
      pointsPerFirstDown: true,
      idp: true,
      bench: 2,
      taxi: 1,
      injuredReserve: 1,
    });
  });
});

describe("identity and rookie eligibility", () => {
  it("normalizes accents, punctuation, and suffixes", () => {
    expect(normalizePlayerName("  D'André Swift Jr. ")).toBe("dandreswift");
  });

  it("requires both a strong match and separation from alternatives", () => {
    const player = DEMO_PLAYERS[0]!;
    const exact = matchPlayerIdentity(
      {
        sleeperId: player.sleeperId,
        fullName: player.fullName,
        team: player.team,
        position: player.position,
      },
      DEMO_PLAYERS,
    );
    expect(exact[0]?.score).toBe(1);
    expect(isIdentityMatchCertain(exact)).toBe(true);
    expect(isIdentityMatchCertain([{ player, score: 0.6, evidence: [] }])).toBe(
      false,
    );
    expect(
      isIdentityMatchCertain([
        { player, score: 0.8, evidence: [] },
        { player: DEMO_PLAYERS[1]!, score: 0.7, evidence: [] },
      ]),
    ).toBe(false);
  });

  it("resolves rookie evidence, missing metadata, veterans, and overrides", () => {
    const rookie = DEMO_PLAYERS.find((player) => player.yearsExperience === 0)!;
    expect(resolveRookieEligibility(rookie, 2026).eligible).toBe(true);
    expect(
      resolveRookieEligibility(
        { ...rookie, yearsExperience: 1, nflDraftYear: 2026 },
        2026,
      ).eligible,
    ).toBe(true);
    expect(
      resolveRookieEligibility(
        { ...rookie, yearsExperience: 3, nflDraftYear: 2022 },
        2026,
      ).eligible,
    ).toBe(false);
    expect(
      resolveRookieEligibility(
        { ...rookie, yearsExperience: undefined, nflDraftYear: undefined },
        2026,
      ).ambiguous,
    ).toBe(true);
    expect(resolveRookieEligibility(rookie, 2026, "exclude").confidence).toBe(
      1,
    );
    expect(resolveRookieEligibility(rookie, 2026, "include").eligible).toBe(
      true,
    );
  });
});

describe("deterministic valuation", () => {
  const fixture = DEMO_FIXTURES.find((entry) => entry.id === "startup")!;
  const context = {
    format: fixture.format,
    strategy: "balanced" as const,
    riskTolerance: 0.5,
    currentPick: 31,
    nextUserPick: 35,
    rosterNeeds: { QB: 1, WR: 1.5 },
    positionDemand: { QB: 1.2, WR: 1 },
    remainingInTier: { QB: 2, WR: 4 },
  };

  it("scores, ranks, tiers, and explains candidates", () => {
    const result = rankPlayers(fixture.players.slice(0, 8), context);
    expect(result).toHaveLength(8);
    expect(result[0]!.contextualScore).toBeGreaterThanOrEqual(
      result[1]!.contextualScore,
    );
    expect(result[0]!.components.length).toBeGreaterThan(4);
    expect(result[0]!.rationale).toContain(result[0]!.player.fullName);
    expect(result.every((entry) => entry.researchAdjustment <= 8)).toBe(true);
  });

  it("derives snake-slot needs for direct and flexible IDP starters", () => {
    const format = {
      ...fixture.format,
      teams: 12,
      idp: true,
      superflex: true,
      starters: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        FLEX: 1,
        SUPER_FLEX: 1,
        DL: 2,
        LB: 3,
        DB: 2,
        IDP_FLEX: 1,
      },
    };
    const picks = [
      {
        pickNumber: 1,
        round: 1,
        pickInRound: 1,
        playerId: "qb",
        playerName: "Quarterback",
        position: "QB" as const,
        isKeeper: false,
        isUserPick: true,
      },
      {
        pickNumber: 24,
        round: 2,
        pickInRound: 1,
        playerId: "lb",
        playerName: "Linebacker",
        position: "LB" as const,
        isKeeper: false,
        isUserPick: true,
      },
    ];

    const needs = deriveRosterNeeds(format, picks, 25);

    expect(needs.DL).toBeGreaterThanOrEqual(2);
    expect(needs.DB).toBeGreaterThanOrEqual(2);
    expect(needs.LB).toBeGreaterThan(needs.QB ?? 0);
  });

  it("bounds research adjustments, risk, and unknown baselines", () => {
    const player = {
      ...DEMO_PLAYERS[0]!,
      age: undefined,
      nflDraftPick: undefined,
      searchRank: undefined,
      status: "injured" as const,
    };
    const result = calculatePlayerScore(
      player,
      { researchAdjustment: 99, injuryRisk: 8 },
      context,
    );
    expect(result.researchAdjustment).toBe(8);
    expect(result.contextualScore).toBeLessThanOrEqual(100);
    expect(
      result.components.find((part) => part.key === "risk")!.value,
    ).toBeLessThan(0);
  });

  it("generates tier breaks and replacement levels", () => {
    expect(generateTiers([95, 94, 88, 87, 80])).toEqual([1, 1, 2, 2, 3]);
    const levels = calculateReplacementLevels(
      fixture.players
        .slice(0, 10)
        .map(({ player }, index) => ({ player, score: 95 - index })),
      fixture.format,
    );
    expect(levels.size).toBeGreaterThan(2);
  });

  it("estimates next-pick odds with and without ADP", () => {
    const known = estimateAvailability({
      playerScore: 85,
      adp: 36,
      currentPick: 31,
      nextPick: 43,
      positionDemand: 1,
      remainingTier: 2,
    });
    const unknown = estimateAvailability({
      playerScore: 72,
      currentPick: 31,
      nextPick: 43,
      positionDemand: 0.4,
      remainingTier: 8,
    });
    expect(known.probability).toBeGreaterThanOrEqual(2);
    expect(known.confidence).toBeGreaterThan(unknown.confidence);
    expect(unknown.warning).toContain("lower confidence");
  });

  it("detects emerging and strong position runs", () => {
    expect(
      detectPositionRun(["WR", "RB", "WR", "WR", "QB", "WR"]).position,
    ).toBe("WR");
    expect(
      detectPositionRun(["RB", "RB", "RB", "RB", "WR", "RB"]).strength,
    ).toBe("strong");
    expect(detectPositionRun(["QB", "RB"]).strength).toBe("none");
  });
});

describe("trade evaluation", () => {
  const asset = (id: string, value: number, risk = 1): TradeAsset => ({
    id,
    label: id,
    kind: "player",
    dynastyValue: value,
    contenderValue: value + 2,
    rebuilderValue: value - 2,
    risk,
    rosterSpots: 1,
  });

  it("finds fair and lopsided packages", () => {
    expect(
      evaluateTrade([asset("a", 50)], [asset("b", 50)], "balanced").fairness,
    ).toBe("fair");
    expect(
      evaluateTrade([asset("a", 30)], [asset("b", 80)], "contender").fairness,
    ).toBe("strong_b");
    expect(evaluateTrade([], [], "rebuild").confidence).toBe(0.25);
  });

  it("accounts for risk, strategy, consolidation, and roster cost", () => {
    const result = evaluateTrade(
      [asset("a", 60, 0)],
      [asset("b", 25), asset("c", 25), asset("d", 25)],
      "productive_struggle",
    );
    expect(result.sideATotal).not.toBe(result.sideBTotal);
    expect(result.conditions).toHaveLength(3);
  });
});
