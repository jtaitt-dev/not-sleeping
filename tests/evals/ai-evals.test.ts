import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { evaluateDeterministicDecision } from "@/services/intelligence/deterministic-engine";
import type { DecisionInput } from "@/services/intelligence/types";

type Fixture = Omit<DecisionInput, "subject" | "contextSummary"> & {
  id: string;
  expectedRecommendationId: string;
};

const fixtures = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "evals", "decision-fixtures.json"),
    "utf8",
  ),
) as Fixture[];

describe("sanitized Phase 3 AI decision evals", () => {
  for (const fixture of fixtures) {
    it(`${fixture.id} preserves validity and deterministic calibration`, () => {
      const input: DecisionInput = {
        ...fixture,
        subject: fixture.id,
        contextSummary: "Sanitized evaluation context.",
      };
      const first = evaluateDeterministicDecision(input, 1_000);
      const second = evaluateDeterministicDecision(input, 2_000);
      expect(first.recommendationId).toBe(fixture.expectedRecommendationId);
      expect(first.stateHash).toBe(second.stateHash);
      expect(first.confidence).toBeGreaterThanOrEqual(0);
      expect(first.confidence).toBeLessThanOrEqual(1);
      expect(first.ranked.every((candidate) => candidate.legal)).toBe(true);
      expect(
        first.ranked.every(
          (candidate) => candidate.score >= 0 && candidate.score <= 100,
        ),
      ).toBe(true);
    });
  }
});
