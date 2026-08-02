import { describe, expect, it } from "vitest";

import { projectIdpPlayer } from "@/services/idp/idp-service";

describe("IDP projection model", () => {
  it("respects granular stacked tackle and big-play scoring", () => {
    const low = projection({ tkl_solo: 1, tkl_ast: 0.5, sack: 2, int: 3 });
    const high = projection({
      tkl_solo: 2,
      tkl_ast: 1,
      sack: 5,
      qb_hit: 1,
      tkl_loss: 2,
      int: 6,
      ff: 3,
      fum_rec: 3,
      pass_def: 2,
    });

    expect(high.weeklyExpectedPoints).toBeGreaterThan(low.weeklyExpectedPoints);
    expect(high.bigPlayCeiling).toBeGreaterThan(high.tackleFloor);
    expect(Object.keys(high.scoringComponents)).toEqual(
      expect.arrayContaining(["tackles", "sacks", "qbHits", "turnovers"]),
    );
  });

  it("lowers confidence and records assumptions when role data is unavailable", () => {
    const result = projectIdpPlayer({
      role: {
        position: "LB",
        age: null,
        snapShare: null,
        threeDownRole: null,
        tackleOpportunities: null,
        pressureOpportunities: null,
        boxSnapShare: null,
        blitzRate: null,
        injuryPenalty: 0,
        roleStability: null,
      },
      scoring: { tkl_solo: 1.5, tkl_ast: 0.75 },
    });
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.assumptions.length).toBeGreaterThanOrEqual(4);
  });
});

function projection(scoring: Record<string, number>) {
  return projectIdpPlayer({
    role: {
      position: "LB",
      age: 24,
      snapShare: 0.92,
      threeDownRole: true,
      tackleOpportunities: 9,
      pressureOpportunities: 4,
      boxSnapShare: 0.7,
      blitzRate: 0.22,
      injuryPenalty: 0,
      roleStability: 0.9,
    },
    scoring,
  });
}
