import { describe, expect, it } from "vitest";

import { evaluateDeterministicDecision } from "@/services/intelligence/deterministic-engine";
import type { DecisionInput } from "@/services/intelligence/types";

const input: DecisionInput = {
  feature: "draft",
  subject: "draft-1",
  contextSummary: "Pick 1.03.",
  strategy: "balanced",
  riskTolerance: 0.5,
  currentPick: 3,
  picksUntilNext: 20,
  candidates: [
    {
      id: "wr-1",
      label: "Some WR",
      position: "WR",
      baseValue: 72,
      adp: 4,
      rosterFit: 0.6,
      scarcity: 0.8,
      risk: 0.2,
      available: true,
      eligible: true,
    },
  ],
};

/**
 * A score with a sentence attached cannot be audited. The engine already
 * computed each addend and then discarded everything but the sum; these lock
 * the parts to the whole so the table can never drift from the number it
 * explains.
 */
describe("deterministic scores expose how they were built", () => {
  const [ranked] = evaluateDeterministicDecision(input).ranked;

  it("returns a factor per contributing term", () => {
    expect(ranked).toBeDefined();
    expect(ranked?.factors.map((factor) => factor.key)).toEqual([
      "base",
      "roster_fit",
      "scarcity",
      "risk",
      "strategy",
      "urgency",
    ]);
  });

  it("gives every factor a human-readable label and note", () => {
    for (const factor of ranked?.factors ?? []) {
      expect(factor.label.length).toBeGreaterThan(0);
      expect(factor.note.length).toBeGreaterThan(0);
    }
  });

  it("sums the factors to the reported score", () => {
    const total = (ranked?.factors ?? []).reduce(
      (sum, factor) => sum + factor.impact,
      0,
    );
    // The score clamps to 0..100, so compare against the clamped sum.
    expect(Math.min(100, Math.max(0, total))).toBeCloseTo(
      ranked?.score ?? -1,
      1,
    );
  });

  it("omits pick urgency outside a draft", () => {
    const [weekly] = evaluateDeterministicDecision({
      ...input,
      feature: "start_sit",
    }).ranked;
    expect(weekly?.factors.map((factor) => factor.key)).not.toContain(
      "urgency",
    );
  });
});
