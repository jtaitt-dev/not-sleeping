import { describe, expect, it } from "vitest";

import {
  analyzeManualParlayScenario,
  americanImpliedProbability,
  buildResponsibleParlayCandidates,
  deViggedProbability,
  marketHold,
  type ManualOddsLeg,
} from "@/features/labs/parlay-analysis";

const now = Date.UTC(2026, 8, 10, 18, 0, 0);

describe("Labs-only responsible scenario analysis", () => {
  it("shows a watchlist instead of constructing from missing prices", () => {
    const result = buildResponsibleParlayCandidates([blankLeg("1")], { now });
    expect(result).toMatchObject({
      outcome: "watchlist",
      message: "Prop Research Watchlist",
      candidates: [],
    });
  });

  it("rejects stale supplied prices", () => {
    const stale = suppliedLeg("1", {
      recordedAt: new Date(now - 31 * 60 * 1_000).toISOString(),
    });
    const result = buildResponsibleParlayCandidates([stale], { now });
    expect(result.outcome).toBe("watchlist");
    expect(result.watchlist[0]?.reason).toContain("stale");
  });

  it("builds only positive-value profiles from current manual inputs", () => {
    const legs = [
      suppliedLeg("1", {
        americanOdds: -110,
        oppositeAmericanOdds: -110,
        estimatedProbability: 0.6,
      }),
      suppliedLeg("2", {
        label: "Player B receiving yards",
        americanOdds: 120,
        oppositeAmericanOdds: -140,
        estimatedProbability: 0.54,
      }),
    ];
    const result = buildResponsibleParlayCandidates(legs, {
      now,
      correlationPenalty: 0.08,
    });
    expect(result.outcome).toBe("candidates");
    expect(result.candidates.map((candidate) => candidate.profile)).toContain(
      "conservative",
    );
    expect(
      result.candidates.every((candidate) => candidate.expectedReturnIndex > 1),
    ).toBe(true);
    expect(result).not.toHaveProperty("stake");
    expect(JSON.stringify(result)).not.toMatch(/sportsbook|affiliate/i);
  });

  it("calculates de-vigged probability and market hold when both sides exist", () => {
    expect(deViggedProbability(-110, -110)).toBeCloseTo(0.5, 6);
    expect(marketHold(-110, -110)).toBeCloseTo(0.0476, 4);
    expect(americanImpliedProbability(50)).toBe(0);
  });

  it("reduces joint probability for correlated legs", () => {
    const legs = [suppliedLeg("1"), suppliedLeg("2")];
    const independent = analyzeManualParlayScenario(legs, 0);
    const adjusted = analyzeManualParlayScenario(legs, 0.15);
    expect(adjusted.correlationAdjustedProbability).toBeLessThan(
      independent.correlationAdjustedProbability,
    );
  });

  it("returns no responsible candidate for negative expected value", () => {
    const result = buildResponsibleParlayCandidates(
      [
        suppliedLeg("1", { estimatedProbability: 0.42 }),
        suppliedLeg("2", { estimatedProbability: 0.4 }),
      ],
      { now },
    );
    expect(result).toMatchObject({
      outcome: "no_responsible_parlay",
      message: "No responsible parlay found",
      candidates: [],
    });
  });

  it("invalidates an unavailable player leg", () => {
    const result = buildResponsibleParlayCandidates(
      [suppliedLeg("1", { availability: "out" }), suppliedLeg("2")],
      { now },
    );
    expect(result.outcome).toBe("no_responsible_parlay");
    expect(result.rejectedLegs[0]?.reason).toContain("invalidates");
  });

  it("invalidates a leg when the selected legal lineup changes", () => {
    const result = buildResponsibleParlayCandidates(
      [
        suppliedLeg("1", { playerId: "starter-1" }),
        suppliedLeg("2", { playerId: "removed-starter" }),
      ],
      { now, allowedPlayerIds: ["starter-1"] },
    );
    expect(result.outcome).toBe("no_responsible_parlay");
    expect(result.rejectedLegs[0]?.reason).toContain("no longer");
  });
});

function blankLeg(id: string): ManualOddsLeg {
  return {
    id,
    label: "",
    market: "",
    line: null,
    americanOdds: null,
    oppositeAmericanOdds: null,
    estimatedProbability: null,
    uncertainty: 0.05,
    sourceType: "manual",
    sourceName: "",
    bookOrConsensus: "",
    recordedAt: "",
    availability: "unknown",
  };
}

function suppliedLeg(
  id: string,
  patch: Partial<ManualOddsLeg> = {},
): ManualOddsLeg {
  return {
    id,
    playerId: `player-${id}`,
    label: `Player ${id} receiving yards`,
    market: "receiving_yards",
    line: 64.5,
    americanOdds: -110,
    oppositeAmericanOdds: -110,
    estimatedProbability: 0.59,
    uncertainty: 0.02,
    sourceType: "manual",
    sourceName: "User supplied",
    bookOrConsensus: "Manual consensus note",
    recordedAt: new Date(now - 5 * 60 * 1_000).toISOString(),
    availability: "active",
    ...patch,
  };
}
