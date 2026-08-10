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

  it("marks filled singleton positions as weak bench needs", () => {
    const format = {
      ...fixture.format,
      teams: 10,
      superflex: false,
      twoQuarterback: false,
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 1, DEF: 1 },
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
    ];

    expect(deriveRosterNeeds(format, picks, 20).QB).toBe(-1);
    expect(deriveRosterNeeds(format, picks, 20).WR).toBeGreaterThan(0);
  });

  it("includes the verified source roster without double-counting live picks", () => {
    const format = {
      ...fixture.format,
      teams: 16,
      draftRounds: 3,
      mode: "dynasty_rookie" as const,
      superflex: false,
      twoQuarterback: false,
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 },
    };
    const rosterPlayers = [
      { ...DEMO_PLAYERS[0]!, id: "existing-qb", position: "QB" as const },
      { ...DEMO_PLAYERS[1]!, id: "existing-rb-1", position: "RB" as const },
      { ...DEMO_PLAYERS[2]!, id: "existing-rb-2", position: "RB" as const },
      { ...DEMO_PLAYERS[3]!, id: "existing-wr-1", position: "WR" as const },
      { ...DEMO_PLAYERS[4]!, id: "live-rookie", position: "WR" as const },
      { ...DEMO_PLAYERS[5]!, id: "existing-te", position: "TE" as const },
    ];
    const picks = [
      {
        pickNumber: 3,
        round: 1,
        pickInRound: 3,
        playerId: "live-rookie",
        playerName: "Live Rookie",
        position: "WR" as const,
        isKeeper: false,
        isUserPick: true,
      },
    ];

    const needs = deriveRosterNeeds(format, picks, 19, rosterPlayers);
    const needsWithoutDuplicate = deriveRosterNeeds(
      format,
      [],
      19,
      rosterPlayers,
    );

    expect(needs).toEqual(needsWithoutDuplicate);
    expect(needs.QB ?? 0).toBeLessThanOrEqual(0);
    expect(needs.TE ?? 0).toBeLessThanOrEqual(0);
    expect(needs.RB ?? 0).toBeLessThan(10);
    expect(needs.WR ?? 0).toBeLessThan(10);
  });

  it("steers an overstocked late-round bench toward the thinner flex position", () => {
    const format = {
      ...fixture.format,
      teams: 10,
      bench: 4,
      draftRounds: 15,
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 1, DEF: 1 },
    };
    const positions = [
      "QB",
      "RB",
      "RB",
      "RB",
      "RB",
      "RB",
      "RB",
      "RB",
      "WR",
      "WR",
      "WR",
      "TE",
    ] as const;
    const picks = positions.map((position, index) => ({
      pickNumber: index * 10 + 1,
      round: index + 1,
      pickInRound: 1,
      playerId: `${position}-${index}`,
      playerName: `${position} ${index}`,
      position,
      isKeeper: false,
      isUserPick: true,
    }));

    const needs = deriveRosterNeeds(format, picks, 121);

    expect(needs.RB).toBe(-1);
    expect(needs.WR).toBe(1);
    expect(needs.K).toBeLessThan(10);
    expect(needs.DEF).toBeLessThan(10);
  });

  it("forces unfilled direct starters when every remaining roster slot is required", () => {
    const format = {
      ...fixture.format,
      teams: 10,
      bench: 5,
      draftRounds: 15,
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 1, DEF: 1 },
    };
    const positions = [
      "QB",
      "RB",
      "RB",
      "RB",
      "RB",
      "RB",
      "RB",
      "RB",
      "WR",
      "WR",
      "WR",
      "WR",
      "TE",
    ] as const;
    const picks = positions.map((position, index) => ({
      pickNumber: index * 10 + 1,
      round: index + 1,
      pickInRound: 1,
      playerId: `${position}-${index}`,
      playerName: `${position} ${index}`,
      position,
      isKeeper: false,
      isUserPick: true,
    }));
    const needs = deriveRosterNeeds(format, picks, 140);
    const kicker = {
      ...DEMO_PLAYERS[0]!,
      id: "kicker",
      fullName: "Required Kicker",
      position: "K" as const,
      fantasyPositions: ["K" as const],
    };

    expect(needs.K).toBeGreaterThanOrEqual(3);
    expect(needs.DEF).toBeGreaterThanOrEqual(3);
    expect(
      calculatePlayerScore(
        kicker,
        { adp: 145 },
        {
          ...context,
          format,
          currentPick: 140,
          nextUserPick: 141,
          rosterNeeds: needs,
        },
      ).components.find((component) => component.key === "roster_completion")
        ?.value,
    ).toBe(40);
  });

  it("forces defense on the final pick after kicker is filled", () => {
    const format = {
      ...fixture.format,
      teams: 10,
      bench: 5,
      draftRounds: 15,
      starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 1, DEF: 1 },
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
    const picks = positions.map((position, index) => ({
      pickNumber: index % 2 === 0 ? index * 10 + 1 : (index + 1) * 10,
      round: index + 1,
      pickInRound: 1,
      playerId: `${position}-${index}`,
      playerName: `${position} ${index}`,
      position,
      isKeeper: false,
      isUserPick: true,
    }));

    const needs = deriveRosterNeeds(format, picks, 141);

    expect(needs.K).toBe(-1);
    expect(needs.DEF).toBeGreaterThanOrEqual(10);
  });

  it("discounts early quarterbacks in one-QB drafts and premiums them in superflex", () => {
    const quarterback = {
      ...DEMO_PLAYERS[0]!,
      id: "quarterback",
      fullName: "Elite Quarterback",
      position: "QB" as const,
      searchRank: 1,
      fantasyPositions: ["QB" as const],
    };
    const runningBack = {
      ...DEMO_PLAYERS[1]!,
      id: "running-back",
      fullName: "Elite Running Back",
      position: "RB" as const,
      searchRank: 2,
      fantasyPositions: ["RB" as const],
    };
    const tightEnd = {
      ...DEMO_PLAYERS[2]!,
      id: "tight-end",
      fullName: "Elite Tight End",
      position: "TE" as const,
      searchRank: 1,
      fantasyPositions: ["TE" as const],
    };
    const baseContext = {
      ...context,
      currentPick: 1,
      nextUserPick: 20,
      format: {
        ...context.format,
        teams: 10,
        scoring: "standard" as const,
        superflex: false,
        twoQuarterback: false,
        tightEndPremium: false,
        starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 },
      },
      rosterNeeds: { QB: 1, RB: 3, WR: 3, TE: 2 },
      positionDemand: {},
      remainingInTier: { QB: 3, RB: 10 },
    };
    const candidates = [
      { player: quarterback, inputs: { importedRank: 1, adp: 1 } },
      { player: runningBack, inputs: { importedRank: 2, adp: 2 } },
      { player: tightEnd, inputs: { importedRank: 1, adp: 1 } },
    ];

    expect(rankPlayers(candidates, baseContext)[0]!.player.id).toBe(
      "running-back",
    );
    expect(
      rankPlayers(candidates, {
        ...baseContext,
        format: { ...baseContext.format, superflex: true },
      })[0]!.player.id,
    ).toBe("quarterback");
  });

  it("uses ADP timing to avoid reaching past an equivalent same-position option", () => {
    const laterQuarterback = {
      ...DEMO_PLAYERS[0]!,
      id: "later-quarterback",
      fullName: "Later Quarterback",
      position: "QB" as const,
      fantasyPositions: ["QB" as const],
    };
    const currentQuarterback = {
      ...laterQuarterback,
      id: "current-quarterback",
      fullName: "Current Quarterback",
    };
    const roundFiveContext = {
      ...context,
      currentPick: 41,
      nextUserPick: 60,
      format: {
        ...context.format,
        teams: 10,
        scoring: "standard" as const,
        superflex: false,
        twoQuarterback: false,
      },
      rosterNeeds: { QB: 1 },
      positionDemand: { QB: 0.8 },
      remainingInTier: { QB: 5 },
    };

    const result = rankPlayers(
      [
        {
          player: laterQuarterback,
          inputs: { importedRank: 42, adp: 49.6, projectedPoints: 320.8 },
        },
        {
          player: currentQuarterback,
          inputs: { importedRank: 42, adp: 40.6, projectedPoints: 320 },
        },
      ],
      roundFiveContext,
    );

    expect(result[0]!.player.id).toBe("current-quarterback");
    expect(
      result[1]!.components.find((part) => part.key === "draft_timing")!.value,
    ).toBeLessThan(0);
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
      playerId: "known",
      position: "WR",
      adp: 36,
      currentPick: 31,
      nextPick: 43,
      positionDemand: 1,
      remainingTier: 2,
    });
    const unknown = estimateAvailability({
      playerId: "unknown",
      position: "WR",
      currentPick: 31,
      nextPick: 43,
      positionDemand: 0.4,
      remainingTier: 8,
    });
    expect(known.probability).toBeGreaterThanOrEqual(2);
    expect(known.confidence).toBeGreaterThan(unknown.confidence);
    expect(unknown.warning).toContain("ADP");
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
